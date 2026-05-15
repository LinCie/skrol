import { Elysia } from "elysia";
import { LinksModule } from "@/modules/links/links.module";
import { ResolveRedirectUseCase } from "./application/resolve-redirect.use-case";
import { ClickEventRepositoryImpl } from "./infrastructure/adapters/click-event.repository.impl";
import { registerPublicRedirectRoute } from "./presentation/routes/public-redirect-route";
import { logger } from "@/shared/presentation/logging/logger";

export interface RedirectModuleDependencies {
  linksModule?: LinksModule;
  resolveRedirectUseCase?: ResolveRedirectUseCase;
}

export class RedirectModule {
  readonly resolveRedirectUseCase: ResolveRedirectUseCase;

  constructor(deps: RedirectModuleDependencies = {}) {
    if (deps.resolveRedirectUseCase) {
      this.resolveRedirectUseCase = deps.resolveRedirectUseCase;
      return;
    }

    const linksModule = deps.linksModule ?? new LinksModule();

    this.resolveRedirectUseCase = new ResolveRedirectUseCase({
      lookup: linksModule.repository,
      clickEventRepository: new ClickEventRepositoryImpl(),
      clock: {
        now: () => new Date(),
      },
      logger: {
        info: (payload, message) => logger.info(payload, message),
        warn: (payload, message) => logger.warn(payload, message),
      },
    });
  }

  registerPublicRoutes(app: Elysia): Elysia {
    registerPublicRedirectRoute(app, {
      resolveRedirectUseCase: this.resolveRedirectUseCase,
    });

    return app;
  }
}
