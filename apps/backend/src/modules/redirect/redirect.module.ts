import { LinksModule } from "@/modules/links/links.module";
import { ResolveRedirectUseCase } from "./application/resolve-redirect.use-case";
import { ClickEventRepositoryImpl } from "./infrastructure/adapters/click-event.repository.impl";
import { logger } from "@/shared/presentation/logging/logger";

export class RedirectModule {
  readonly resolveRedirectUseCase: ResolveRedirectUseCase;

  constructor(linksModule: LinksModule = new LinksModule()) {
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
}
