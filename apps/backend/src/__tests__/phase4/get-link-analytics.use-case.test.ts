import { describe, expect, it } from "bun:test";
import { GetLinkAnalyticsUseCase } from "@/modules/analytics/application/get-link-analytics.use-case";

describe("GetLinkAnalyticsUseCase", () => {
	it("returns snake_case analytics DTO for owned active link", async () => {
		const useCase = new GetLinkAnalyticsUseCase({
			linksRepository: {
				findOwnedLinkForRead: async () => ({
					id: "link_1",
					userId: "user_1",
					deletedAt: null,
				}),
			},
			analyticsRepository: {
				getTotalClicks: async () => 3,
				getClicksOverTime: async () => [
					{ bucket_start: "2026-05-01T00:00:00.000Z", clicks: 1 },
					{ bucket_start: "2026-05-02T00:00:00.000Z", clicks: 0 },
					{ bucket_start: "2026-05-03T00:00:00.000Z", clicks: 2 },
				],
				getTopReferrers: async () => [{ referrer_domain: "direct", clicks: 2 }],
				getTopBrowsers: async () => [{ browser: "unknown", clicks: 2 }],
				getDevices: async () => [{ device: "desktop", clicks: 3 }],
			},
			clock: { now: () => new Date("2026-05-16T12:00:00.000Z") },
			countryAnalyticsEnabled: false,
		});

		const result = await useCase.execute({
			principalUserId: "user_1",
			linkId: "link_1",
		});

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.data).toEqual({
			link_id: "link_1",
			total_clicks: 3,
			clicks_over_time: [
				{ bucket_start: "2026-05-01T00:00:00.000Z", clicks: 1 },
				{ bucket_start: "2026-05-02T00:00:00.000Z", clicks: 0 },
				{ bucket_start: "2026-05-03T00:00:00.000Z", clicks: 2 },
			],
			referrers: [{ referrer_domain: "direct", clicks: 2 }],
			browsers: [{ browser: "unknown", clicks: 2 }],
			devices: [{ device: "desktop", clicks: 3 }],
		});

		expect("countries" in result.data).toBe(false);
	});
});
