import { describe, expect, it } from "bun:test";
import type { AnalyticsRepository } from "@/modules/analytics/application/analytics.repository";
import { GetLinkAnalyticsUseCase } from "@/modules/analytics/application/get-link-analytics.use-case";
import type { LinksRepository } from "@/modules/links/application/links.repository";

describe("GetLinkAnalyticsUseCase", () => {
	it("returns snake_case analytics DTO for owned active link", async () => {
		const useCase = new GetLinkAnalyticsUseCase({
			linksRepository: makeLinksRepository({
				findOwnedLinkForRead: async () => ({
					id: "link_1",
					userId: "user_1",
					deletedAt: null,
				}),
			}),
			analyticsRepository: makeAnalyticsRepository({
				getTotalClicks: async () => 3,
				getClicksOverTime: async () => [
					{ bucket_start: "2026-05-01T00:00:00.000Z", clicks: 1 },
					{ bucket_start: "2026-05-02T00:00:00.000Z", clicks: 0 },
					{ bucket_start: "2026-05-03T00:00:00.000Z", clicks: 2 },
				],
				getTopReferrers: async () => [{ referrer_domain: "direct", clicks: 2 }],
				getTopBrowsers: async () => [{ browser: "unknown", clicks: 2 }],
				getDevices: async () => [{ device: "desktop", clicks: 3 }],
			}),
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

	it("passes deterministic last-30-day UTC window to repository", async () => {
		let capturedInput:
			| {
				linkId: string;
				startInclusiveUtc: Date;
				endExclusiveUtc: Date;
			}
			| null = null;

		const useCase = new GetLinkAnalyticsUseCase({
			linksRepository: makeLinksRepository({
				findOwnedLinkForRead: async () => ({
					id: "link_1",
					userId: "user_1",
					deletedAt: null,
				}),
			}),
			analyticsRepository: makeAnalyticsRepository({
				getTotalClicks: async () => 0,
				getClicksOverTime: async (input) => {
					capturedInput = input;
					return [];
				},
				getTopReferrers: async () => [],
				getTopBrowsers: async () => [],
				getDevices: async () => [],
			}),
			clock: { now: () => new Date("2026-05-16T12:00:00.000Z") },
			countryAnalyticsEnabled: false,
		});

		await useCase.execute({
			principalUserId: "user_1",
			linkId: "link_1",
		});

		expect(capturedInput).toEqual({
			linkId: "link_1",
			startInclusiveUtc: new Date("2026-04-17T00:00:00.000Z"),
			endExclusiveUtc: new Date("2026-05-17T00:00:00.000Z"),
		});
	});

	it("returns not_found for missing or deleted owned link", async () => {
		const missingUseCase = new GetLinkAnalyticsUseCase({
			linksRepository: makeLinksRepository({
				findOwnedLinkForRead: async () => null,
			}),
			analyticsRepository: makeAnalyticsRepository(),
			clock: { now: () => new Date("2026-05-16T12:00:00.000Z") },
			countryAnalyticsEnabled: false,
		});

		expect(
			await missingUseCase.execute({ principalUserId: "user_1", linkId: "missing" }),
		).toEqual({ kind: "not_found" });

		const deletedUseCase = new GetLinkAnalyticsUseCase({
			linksRepository: makeLinksRepository({
				findOwnedLinkForRead: async () => ({
					id: "link_1",
					userId: "user_1",
					deletedAt: new Date("2026-05-01T00:00:00.000Z"),
				}),
			}),
			analyticsRepository: makeAnalyticsRepository(),
			clock: { now: () => new Date("2026-05-16T12:00:00.000Z") },
			countryAnalyticsEnabled: false,
		});

		expect(
			await deletedUseCase.execute({ principalUserId: "user_1", linkId: "link_1" }),
		).toEqual({ kind: "not_found" });
	});

	it("includes countries only when feature enabled and rows exist", async () => {
		const useCase = new GetLinkAnalyticsUseCase({
			linksRepository: makeLinksRepository({
				findOwnedLinkForRead: async () => ({
					id: "link_1",
					userId: "user_1",
					deletedAt: null,
				}),
			}),
			analyticsRepository: makeAnalyticsRepository({
				getTotalClicks: async () => 1,
				getClicksOverTime: async () => [],
				getTopReferrers: async () => [],
				getTopBrowsers: async () => [],
				getDevices: async () => [],
				getTopCountries: async () => [{ country: "ID", clicks: 1 }],
			}),
			clock: { now: () => new Date("2026-05-16T12:00:00.000Z") },
			countryAnalyticsEnabled: true,
		});

		const result = await useCase.execute({
			principalUserId: "user_1",
			linkId: "link_1",
		});

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.data).toMatchObject({
			link_id: "link_1",
			countries: [{ country: "ID", clicks: 1 }],
		});
	});

	it("omits countries when feature enabled but no rows", async () => {
		const useCase = new GetLinkAnalyticsUseCase({
			linksRepository: makeLinksRepository({
				findOwnedLinkForRead: async () => ({
					id: "link_1",
					userId: "user_1",
					deletedAt: null,
				}),
			}),
			analyticsRepository: makeAnalyticsRepository({
				getTotalClicks: async () => 1,
				getClicksOverTime: async () => [],
				getTopReferrers: async () => [],
				getTopBrowsers: async () => [],
				getDevices: async () => [],
				getTopCountries: async () => [],
			}),
			clock: { now: () => new Date("2026-05-16T12:00:00.000Z") },
			countryAnalyticsEnabled: true,
		});

		const result = await useCase.execute({
			principalUserId: "user_1",
			linkId: "link_1",
		});

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect("countries" in result.data).toBe(false);
	});
});

function makeLinksRepository(
	overrides: Partial<LinksRepository> = {},
): LinksRepository {
	return {
		codeExists: async () => false,
		findByCode: async () => null,
		createLink: async () => {
			throw new Error("not used");
		},
		listByOwner: async () => ({ items: [], nextCursor: null }),
		findByIdForOwner: async () => null,
		findOwnedLinkForRead: async () => null,
		updateLinkForOwner: async () => null,
		softDeleteLinkForOwner: async () => null,
		createAuditLog: async () => {},
		...overrides,
	};
}

function makeAnalyticsRepository(
	overrides: Partial<AnalyticsRepository> = {},
): AnalyticsRepository {
	return {
		createClickEvent: async () => {
			throw new Error("not used");
		},
		getTotalClicks: async () => 0,
		getClicksOverTime: async () => [],
		getTopReferrers: async () => [],
		getTopBrowsers: async () => [],
		getDevices: async () => [],
		...overrides,
	};
}
