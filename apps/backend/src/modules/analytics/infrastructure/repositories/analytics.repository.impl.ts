import { getDatabase, PostgresClient } from "@/shared/infrastructure/database";
import {
	AnalyticsRepository,
	CreateClickEventInput,
	type AnalyticsBrowserRow,
	type AnalyticsCountryRow,
	type AnalyticsDeviceRow,
	type AnalyticsReferrerRow,
	type AnalyticsTimeSeriesRow,
} from "../../application/analytics.repository";
import { ClickEvent } from "../../domain/click-event.entity";
import { sql } from "kysely";

export class AnalyticsRepositoryImpl implements AnalyticsRepository {
	private readonly db: PostgresClient | null;

	constructor(db?: PostgresClient) {
		this.db = db ?? null;
	}

	private get database(): PostgresClient {
		return this.db ?? getDatabase();
	}

	async createClickEvent(input: CreateClickEventInput): Promise<ClickEvent> {
		const returning = await this.database
			.insertInto("clickEvents")
			.values(input)
			.returningAll()
			.executeTakeFirstOrThrow();

		return ClickEvent.create(returning);
	}

	async getTotalClicks(input: { linkId: string }): Promise<number> {
		const row = await this.database
			.selectFrom("clickEvents")
			.select(sql<number>`count(*)::int`.as("clicks"))
			.where("linkId", "=", input.linkId)
			.executeTakeFirstOrThrow();

		return row.clicks;
	}

	async getClicksOverTime(input: {
		linkId: string;
		startInclusiveUtc: Date;
		endExclusiveUtc: Date;
	}): Promise<AnalyticsTimeSeriesRow[]> {
		const rows = await this.database
			.selectFrom("clickEvents")
			.select(({ eb }) => [
				sql<string>`to_char(date_trunc('day', timezone('UTC', ${eb.ref("clickedAt")})), 'YYYY-MM-DD"T"00:00:00.000Z')`.as(
					"bucketStart",
				),
				sql<number>`count(*)::int`.as("clicks"),
			])
			.where("linkId", "=", input.linkId)
			.where("clickedAt", ">=", input.startInclusiveUtc)
			.where("clickedAt", "<", input.endExclusiveUtc)
			.groupBy("bucketStart")
			.orderBy("bucketStart", "asc")
			.execute();

		const byBucket = new Map<string, number>(rows.map((row) => [row.bucketStart, row.clicks]));
		const buckets: AnalyticsTimeSeriesRow[] = [];
		const current = new Date(input.startInclusiveUtc);
		while (current < input.endExclusiveUtc) {
			const bucketStart = current.toISOString();
			buckets.push({
				bucket_start: bucketStart,
				clicks: byBucket.get(bucketStart) ?? 0,
			});
			current.setUTCDate(current.getUTCDate() + 1);
		}

		return buckets;
	}

	async getTopReferrers(input: {
		linkId: string;
		limit: number;
	}): Promise<AnalyticsReferrerRow[]> {
		return this.selectBreakdownRows<AnalyticsReferrerRow>({
			column: "referrerDomain",
			alias: "referrer_domain",
			fallback: "direct",
			input,
		});
	}

	async getTopBrowsers(input: {
		linkId: string;
		limit: number;
	}): Promise<AnalyticsBrowserRow[]> {
		return this.selectBreakdownRows<AnalyticsBrowserRow>({
			column: "browser",
			alias: "browser",
			fallback: "unknown",
			input,
		});
	}

	async getDevices(input: { linkId: string }): Promise<AnalyticsDeviceRow[]> {
		return this.selectBreakdownRows<AnalyticsDeviceRow>({
			column: "device",
			alias: "device",
			fallback: "unknown",
			input,
		});
	}

	async getTopCountries(input: {
		linkId: string;
		limit: number;
	}): Promise<AnalyticsCountryRow[]> {
		const rows = await this.database
			.selectFrom("clickEvents")
			.select(({ eb }) => [
				sql<string>`trim(${eb.ref("country")})`.as("country"),
				sql<number>`count(*)::int`.as("clicks"),
			])
			.where("linkId", "=", input.linkId)
			.where("country", "is not", null)
			.where(({ eb }) => sql<boolean>`length(trim(${eb.ref("country")})) > 0`)
			.groupBy(({ eb }) => sql<string>`trim(${eb.ref("country")})`)
			.orderBy("clicks", "desc")
			.orderBy("country", "asc")
			.limit(input.limit)
			.execute();

		return rows as unknown as AnalyticsCountryRow[];
	}

	private async selectBreakdownRows<T extends { clicks: number }>(input: {
		column: "referrerDomain" | "browser" | "device" | "country";
		alias: "referrer_domain" | "browser" | "device" | "country";
		fallback: string;
		input: { linkId: string; limit?: number };
	}): Promise<T[]> {
		const rowsQuery = this.database
			.selectFrom("clickEvents")
			.select(({ eb }) => [
				sql<string>`coalesce(nullif(trim(${eb.ref(input.column)}), ''), ${input.fallback})`.as(
					input.alias,
				),
				sql<number>`count(*)::int`.as("clicks"),
			])
			.where("linkId", "=", input.input.linkId)
			.groupBy(({ eb }) =>
				sql<string>`coalesce(nullif(trim(${eb.ref(input.column)}), ''), ${input.fallback})`,
			)
			.orderBy("clicks", "desc")
			.orderBy(input.alias, "asc");

		const rows = input.input.limit === undefined
			? await rowsQuery.execute()
			: await rowsQuery.limit(input.input.limit).execute();

		return rows as unknown as T[];
	}
}
