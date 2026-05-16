import { ClickEvent } from "../domain/click-event.entity";

export interface AnalyticsTimeSeriesRow {
	bucket_start: string;
	clicks: number;
}

export interface AnalyticsDimensionRow {
	clicks: number;
}

export interface AnalyticsReferrerRow extends AnalyticsDimensionRow {
	referrer_domain: string;
}

export interface AnalyticsBrowserRow extends AnalyticsDimensionRow {
	browser: string;
}

export interface AnalyticsDeviceRow extends AnalyticsDimensionRow {
	device: string;
}

export interface AnalyticsCountryRow extends AnalyticsDimensionRow {
	country: string;
}

export interface CreateClickEventInput {
	linkId: string;
	clickedAt: Date;
	referrerDomain: string | null;
	country: string | null;
	browser: string | null;
	os: string | null;
	device: string | null;
	isBot: boolean;
}

export interface AnalyticsRepository {
	createClickEvent(input: CreateClickEventInput): Promise<ClickEvent>;
	getTotalClicks(input: { linkId: string }): Promise<number>;
	getClicksOverTime(input: {
		linkId: string;
		startInclusiveUtc: Date;
		endExclusiveUtc: Date;
	}): Promise<AnalyticsTimeSeriesRow[]>;
	getTopReferrers(input: { linkId: string; limit: number }): Promise<
		AnalyticsReferrerRow[]
	>;
	getTopBrowsers(input: { linkId: string; limit: number }): Promise<
		AnalyticsBrowserRow[]
	>;
	getDevices(input: { linkId: string }): Promise<AnalyticsDeviceRow[]>;
	getTopCountries?(input: {
		linkId: string;
		limit: number;
	}): Promise<AnalyticsCountryRow[]>;
}
