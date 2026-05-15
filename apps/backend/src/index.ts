/**
 * Backend application bootstrap
 * Deterministic startup sequence: config -> logger -> dependencies -> routes -> server
 */

import { Elysia } from "elysia";
import config from "@/shared/config";
import { logger } from "@/shared/presentation/logging/logger";
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
import type { AuthSessionService } from "@/modules/auth/application/auth-session.service";
import {
  mountBetterAuthRoutes,
  type BetterAuthHandler,
} from "@/modules/auth/presentation/routes/mount-better-auth";
import { LinksModule } from "@/modules/links/links.module";
import { linksApiRoutes } from "@/modules/links/presentation/routes/links-api.routes";
import { UserProfilesRepository } from "@/modules/users/infrastructure/user-profiles.repository";

export interface CreateAppDependencies {
  getHealthStatus?: (databaseUrl: string) => Promise<HealthStatus>;
  resolveRedirectUseCase?: ResolveRedirectUseCase;
  betterAuthHandler?: BetterAuthHandler;
  authSessionService?: AuthSessionService;
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
  const linksModule = deps.linksModule ??
    (betterAuthInstance ? new LinksModule() : createUnconfiguredLinksModule());
  const redirectModule = new RedirectModule({
    resolveRedirectUseCase: deps.resolveRedirectUseCase,
  });

  const app = new Elysia();

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

function createUnconfiguredLinksModule(): Pick<
  LinksModule,
  "createLinkUseCase" | "listLinksUseCase" | "getLinkDetailUseCase"
> {
  const fail = async () => {
    throw new Error("Links module is not configured.");
  };

  return {
    createLinkUseCase: { execute: fail },
    listLinksUseCase: { execute: fail },
    getLinkDetailUseCase: { execute: fail },
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
