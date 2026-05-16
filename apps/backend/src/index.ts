/**
 * Backend application bootstrap
 * Deterministic startup sequence: config -> logger -> dependencies -> routes -> server
 */

import { Elysia } from "elysia";
import config from "@/shared/config";
import { logger } from "@/shared/presentation/logging/logger";
import { registerCredentialedCors } from "@/shared/presentation/cors";
import {
  initializeDatabase,
  closeDatabase,
} from "@/shared/infrastructure/database";
import {
  initializeRedis,
  closeRedis,
} from "@/shared/infrastructure/caching/redis";
import { getHealthStatus, type HealthStatus } from "@/health";
import { RedirectModule } from "@/modules/redirect/redirect.module";
import type { ResolveRedirectUseCase } from "@/modules/redirect/application/resolve-redirect.use-case";
import { createDefaultBetterAuthInstance } from "@/modules/auth/infrastructure/better-auth.server";
import { BetterAuthSessionService } from "@/modules/auth/infrastructure/auth-session.service.impl";
import { BetterAuthApiKeyService } from "@/modules/auth/infrastructure/better-auth-api-key.service";
import type { AuthSessionService } from "@/modules/auth/application/auth-session.service";
import type { ApiKeyService } from "@/modules/auth/application/api-key.service";
import {
  mountBetterAuthRoutes,
  type BetterAuthHandler,
} from "@/modules/auth/presentation/routes/mount-better-auth";
import { apiKeyRoutes } from "@/modules/auth/presentation/routes/api-key-routes";
import { LinksModule } from "@/modules/links/links.module";
import { linksApiRoutes } from "@/modules/links/presentation/routes/links-api.routes";
import type { CreateLinkInput } from "@/modules/links/application/create-link.use-case";
import type { ListLinksInput } from "@/modules/links/application/list-links.use-case";
import type { GetLinkDetailInput } from "@/modules/links/application/get-link-detail.use-case";
import { UserProfilesRepository } from "@/modules/users/infrastructure/user-profiles.repository";

export interface CreateAppDependencies {
  getHealthStatus?: (databaseUrl: string) => Promise<HealthStatus>;
  resolveRedirectUseCase?: ResolveRedirectUseCase;
  betterAuthHandler?: BetterAuthHandler;
  authSessionService?: AuthSessionService;
  apiKeyService?: ApiKeyService;
  linksModule?: Pick<
    LinksModule,
    "createLinkUseCase" | "listLinksUseCase" | "getLinkDetailUseCase"
  >;
}

export function createApp(deps: CreateAppDependencies = {}): Elysia {
  const healthStatusResolver = deps.getHealthStatus ?? getHealthStatus;
  const betterAuthInstance = deps.betterAuthHandler
    ? null
    : createDefaultBetterAuthInstance();
  const betterAuthHandler = deps.betterAuthHandler ?? betterAuthInstance?.handler;
  if (!betterAuthHandler) {
    throw new Error("Better Auth handler is not configured.");
  }
  const authSessionService =
    deps.authSessionService ??
    (betterAuthInstance
      ? new BetterAuthSessionService(
          async (request) =>
            (await betterAuthInstance.api.getSession({ headers: request.headers })) ??
            null,
          async (userId) => {
            await new UserProfilesRepository().ensure(userId);
          },
        )
      : { resolveFromRequest: async () => null });
  const apiKeyService =
    deps.apiKeyService ??
    (betterAuthInstance
      ? new BetterAuthApiKeyService(
          betterAuthInstance.api as Parameters<typeof BetterAuthApiKeyService>[0],
        )
      : createNoopApiKeyService());
  const linksModule = deps.linksModule ?? createLazyLinksModule();
  const redirectModule = new RedirectModule({
    resolveRedirectUseCase: deps.resolveRedirectUseCase,
  });

  const app = new Elysia();
  registerCredentialedCors(app, { allowedOrigins: config.frontendOrigins });

  app.get("/health", async () => {
    const health = await healthStatusResolver(config.databaseUrl);
    return new Response(JSON.stringify(health), {
      status: health.status === "healthy" ? 200 : 503,
      headers: { "Content-Type": "application/json" },
    });
  });

  app.get("/", () => ({
    message: "Backend service is running",
    version: "1.0.0",
  }));

  app.use(
    mountBetterAuthRoutes({
      handler: betterAuthHandler,
    }),
  );
  app.use(
    apiKeyRoutes({
      authSessionService,
      apiKeyService,
      allowedOrigins: config.frontendOrigins,
    }),
  );
  app.use(
    linksApiRoutes({
      authSessionService,
      linksModule,
    }),
  );

  redirectModule.registerPublicRoutes(app);

  app.onRequest(({ request }) => {
    const url = new URL(request.url);
    logger.info(
      { method: request.method, path: url.pathname },
      "Incoming request",
    );
  });

  app.onError(({ error, request }) => {
    const url = new URL(request.url);
    logger.error(
      { error, method: request.method, path: url.pathname },
      "Request error",
    );
  });

  return app;
}

function createNoopApiKeyService(): ApiKeyService {
  return {
    create: async () => {
      throw new Error("API key service is not configured.");
    },
    list: async () => [],
    revoke: async () => false,
    verify: async () => ({ valid: false }),
  };
}

function createLazyLinksModule(): Pick<
  LinksModule,
  "createLinkUseCase" | "listLinksUseCase" | "getLinkDetailUseCase"
> {
  let module: LinksModule | null = null;
  const getModule = () => {
    module ??= new LinksModule();
    return module;
  };

  return {
    createLinkUseCase: {
      execute: async (input: CreateLinkInput) =>
        getModule().createLinkUseCase.execute(input),
    },
    listLinksUseCase: {
      execute: async (input: ListLinksInput) =>
        getModule().listLinksUseCase.execute(input),
    },
    getLinkDetailUseCase: {
      execute: async (input: GetLinkDetailInput) =>
        getModule().getLinkDetailUseCase.execute(input),
    },
  } as never;
}

async function bootstrap() {
  try {
    // Step 1: Config is already loaded (imported at top)
    logger.info({ env: config.env, port: config.port }, "Configuration loaded");

    // Step 2: Logger is already initialized
    logger.info("Logger initialized");

    // Step 3: Initialize dependencies
    logger.info("Initializing dependencies...");
    await initializeDatabase(config.databaseUrl);
    await initializeRedis(config.redisUrl);
    logger.info("Dependencies initialized");

    // Step 4: Create app and register routes
    const app = createApp();

    // Step 5: Start server
    app.listen(config.port);
    logger.info(
      { port: config.port },
      `🦊 Backend is running at http://localhost:${config.port}`,
    );

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info({ signal }, "Shutdown signal received");
      await closeDatabase();
      await closeRedis();
      process.exit(0);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    logger.error({ error }, "Failed to bootstrap application");
    process.exit(1);
  }
}

const entrypoint = process.argv[1] ?? "";
const shouldBootstrap =
  entrypoint.endsWith("/src/index.ts") ||
  entrypoint.endsWith("\\src\\index.ts") ||
  entrypoint.endsWith("/dist/server") ||
  entrypoint.endsWith("\\dist\\server");

if (shouldBootstrap) {
  void bootstrap();
}
