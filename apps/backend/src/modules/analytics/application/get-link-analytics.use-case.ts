import type {
	AnalyticsBrowserRow,
	AnalyticsCountryRow,
	AnalyticsDeviceRow,
	AnalyticsRepository,
	AnalyticsReferrerRow,
	AnalyticsTimeSeriesRow,
} from "./analytics.repository";
import type { LinksRepository } from "@/modules/links/application/links.repository";

export interface GetLinkAnalyticsInput {
	principalUserId: string;
	linkId: string;
}

export type GetLinkAnalyticsResult =
	| { kind: "not_found" }
	| {
		kind: "ok";
		data: GetLinkAnalyticsResponseData;
	};

export interface GetLinkAnalyticsResponseData {
	link_id: string;
	total_clicks: number;
	clicks_over_time: AnalyticsTimeSeriesRow[];
	referrers: AnalyticsReferrerRow[];
	browsers: AnalyticsBrowserRow[];
	devices: AnalyticsDeviceRow[];
	countries?: AnalyticsCountryRow[];
}

export interface GetLinkAnalyticsUseCaseDependencies {
	linksRepository: Pick<LinksRepository, "findOwnedLinkForRead">;
	analyticsRepository: AnalyticsRepository;
	clock: { now(): Date };
	countryAnalyticsEnabled: boolean;
}

const DEFAULT_DAYS = 30;
const TOP_BREAKDOWN_LIMIT = 20;

export class GetLinkAnalyticsUseCase {
	constructor(private readonly deps: GetLinkAnalyticsUseCaseDependencies) {}

	async execute(input: GetLinkAnalyticsInput): Promise<GetLinkAnalyticsResult> {
		const link = await this.deps.linksRepository.findOwnedLinkForRead({
			userId: input.principalUserId,
			linkId: input.linkId,
		});

		if (!link || link.deletedAt) {
			return { kind: "not_found" };
		}

		const { startInclusiveUtc, endExclusiveUtc } = this.getThirtyDayWindow();
		const [totalClicks, clicksOverTime, referrers, browsers, devices] =
			await Promise.all([
				this.deps.analyticsRepository.getTotalClicks({ linkId: input.linkId }),
				this.deps.analyticsRepository.getClicksOverTime({
					linkId: input.linkId,
					startInclusiveUtc,
					endExclusiveUtc,
				}),
				this.deps.analyticsRepository.getTopReferrers({
					linkId: input.linkId,
					limit: TOP_BREAKDOWN_LIMIT,
				}),
				this.deps.analyticsRepository.getTopBrowsers({
					linkId: input.linkId,
					limit: TOP_BREAKDOWN_LIMIT,
				}),
				this.deps.analyticsRepository.getDevices({ linkId: input.linkId }),
			]);

		const data: GetLinkAnalyticsResponseData = {
			link_id: input.linkId,
			total_clicks: totalClicks,
			clicks_over_time: clicksOverTime,
			referrers,
			browsers,
			devices,
		};

		if (this.deps.countryAnalyticsEnabled && this.deps.analyticsRepository.getTopCountries) {
			const countries = await this.deps.analyticsRepository.getTopCountries({
				linkId: input.linkId,
				limit: TOP_BREAKDOWN_LIMIT,
			});
			if (countries.length > 0) {
				data.countries = countries;
			}
		}

		return { kind: "ok", data };
	}

	private getThirtyDayWindow(): {
		startInclusiveUtc: Date;
		endExclusiveUtc: Date;
	} {
		const now = this.deps.clock.now();
		const endExclusiveUtc = new Date(Date.UTC(
			now.getUTCFullYear(),
			now.getUTCMonth(),
			now.getUTCDate() + 1,
		));
		const startInclusiveUtc = new Date(endExclusiveUtc);
		startInclusiveUtc.setUTCDate(startInclusiveUtc.getUTCDate() - DEFAULT_DAYS);
		return { startInclusiveUtc, endExclusiveUtc };
	}
}
