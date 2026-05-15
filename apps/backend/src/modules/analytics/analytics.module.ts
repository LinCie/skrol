import { AnalyticsRepository } from "./application/analytics.repository";
import { AnalyticsRepositoryImpl } from "./infrastructure/repositories/analytics.repository.impl";

export class AnalyticsModule {
	constructor(
		readonly repository: AnalyticsRepository = new AnalyticsRepositoryImpl(),
	) {}
}
