import { describe, expect, it } from "bun:test";
import type { PostgresClient } from "@/shared/infrastructure/database";
import { AnalyticsRepositoryImpl } from "@/modules/analytics/infrastructure/repositories/analytics.repository.impl";

describe("AnalyticsRepositoryImpl", () => {
	it("normalizes timezone-shifted bucket rows to UTC day keys", async () => {
		const repository = new AnalyticsRepositoryImpl(
			makeFakeDb([
				{ bucketStart: "2026-05-01T00:00:00.000Z", clicks: 1 },
				{ bucketStart: "2026-05-03T00:00:00.000Z", clicks: 2 },
			]),
		);

		const result = await repository.getClicksOverTime({
			linkId: "link_1",
			startInclusiveUtc: new Date("2026-05-01T00:00:00.000Z"),
			endExclusiveUtc: new Date("2026-05-04T00:00:00.000Z"),
		});

		expect(result).toEqual([
			{ bucket_start: "2026-05-01T00:00:00.000Z", clicks: 1 },
			{ bucket_start: "2026-05-02T00:00:00.000Z", clicks: 0 },
			{ bucket_start: "2026-05-03T00:00:00.000Z", clicks: 2 },
		]);
	});
});

function makeFakeDb(rows: Array<Record<string, unknown>>): PostgresClient {
	const query = {
		select: () => query,
		where: () => query,
		groupBy: () => query,
		orderBy: () => query,
		limit: () => query,
		execute: async () => rows,
		executeTakeFirstOrThrow: async () => rows[0] ?? { clicks: 0 },
	};

	return {
		selectFrom: () => query,
	} as unknown as PostgresClient;
}
