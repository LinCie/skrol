import type { ClockPort } from "@/modules/redirect/application/clock.port";
import type { LinksRepository } from "@/modules/links/application/links.repository";
import { GetLinkAnalyticsUseCase } from "./application/get-link-analytics.use-case";
import { AnalyticsRepository } from "./application/analytics.repository";
import { AnalyticsRepositoryImpl } from "./infrastructure/repositories/analytics.repository.impl";

export class AnalyticsModule {
	readonly repository: AnalyticsRepository;
	readonly getLinkAnalyticsUseCase: GetLinkAnalyticsUseCase;

	constructor(deps: {
		linksRepository: LinksRepository;
		clock?: ClockPort;
		countryAnalyticsEnabled?: boolean;
		repository?: AnalyticsRepository;
	}) {
		this.repository = deps.repository ?? new AnalyticsRepositoryImpl();
		this.getLinkAnalyticsUseCase = new GetLinkAnalyticsUseCase({
			linksRepository: deps.linksRepository,
			analyticsRepository: this.repository,
			clock: deps.clock ?? { now: () => new Date() },
			countryAnalyticsEnabled: deps.countryAnalyticsEnabled ?? false,
		});
	}
}
