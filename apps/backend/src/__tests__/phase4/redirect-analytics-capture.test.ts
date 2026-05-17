import { describe, expect, it } from "bun:test";
import { Link } from "@/modules/links/domain/link.entity";
import { ResolveRedirectUseCase } from "@/modules/redirect/application/resolve-redirect.use-case";

describe("redirect analytics capture", () => {
	it("captures normalized metadata via real resolve use case call", async () => {
		let capturedInput:
			| {
				linkId: string;
				clickedAt: Date;
				referrerDomain: string | null;
				country: string | null;
				browser: string | null;
				os: string | null;
				device: string | null;
				isBot: boolean;
				userAgent?: string;
				rawIp?: string;
			}
			| null = null;

		const useCase = new ResolveRedirectUseCase({
			lookup: {
				findByCode: async () =>
					Link.create({
						id: "link_1",
						code: "docs",
						destinationUrl: "https://example.com/docs",
						status: "active",
						deletedAt: null,
						expiresAt: null,
						userId: "user_1",
						createdViaApiKeyId: null,
						title: null,
						createdAt: new Date("2026-05-16T00:00:00.000Z"),
						updatedAt: new Date("2026-05-16T00:00:00.000Z"),
					}),
			},
			clickEventRepository: {
				create: async (input) => {
					capturedInput = input;
					return {
						id: "click_1",
						linkId: input.linkId,
						isBot: input.isBot,
						browser: input.browser,
						country: input.country,
						device: input.device,
						os: input.os,
						referrerDomain: input.referrerDomain,
						clickedAt: input.clickedAt,
					};
				},
			},
			clock: {
				now: () => new Date("2026-05-16T12:00:00.000Z"),
			},
			logger: {
				info: () => {},
				warn: () => {},
			},
		});

		const result = await useCase.execute({
			code: "docs",
			request: new Request("https://example.com/api/v1/redirect/docs", {
				headers: {
					referer: "https://news.ycombinator.com/item?id=1",
					"user-agent":
						"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
				},
			}),
		});

		expect(result.status).toBe(302);
		expect(capturedInput).not.toBeNull();
		expect(capturedInput).toEqual({
			linkId: "link_1",
			clickedAt: new Date("2026-05-16T12:00:00.000Z"),
			referrerDomain: "news.ycombinator.com",
			country: null,
			browser: "Chrome",
			os: "Windows",
			device: "desktop",
			isBot: false,
		});
		expect(capturedInput).not.toHaveProperty("userAgent");
		expect(capturedInput).not.toHaveProperty("rawIp");
	});

	it("detects iPhone browser and iPadOS tablet families", async () => {
		const capturedInputs: Array<{
			browser: string | null;
			os: string | null;
			device: string | null;
		}> = [];

		const useCase = new ResolveRedirectUseCase({
			lookup: {
				findByCode: async () =>
					Link.create({
						id: "link_1",
						code: "docs",
						destinationUrl: "https://example.com/docs",
						status: "active",
						deletedAt: null,
						expiresAt: null,
						userId: "user_1",
						createdViaApiKeyId: null,
						title: null,
						createdAt: new Date("2026-05-16T00:00:00.000Z"),
						updatedAt: new Date("2026-05-16T00:00:00.000Z"),
					}),
			},
			clickEventRepository: {
				create: async (input) => {
					capturedInputs.push({
						browser: input.browser,
						os: input.os,
						device: input.device,
					});

					return {
						id: "click_1",
						linkId: input.linkId,
						isBot: input.isBot,
						browser: input.browser,
						country: input.country,
						device: input.device,
						os: input.os,
						referrerDomain: input.referrerDomain,
						clickedAt: input.clickedAt,
					};
				},
			},
			clock: {
				now: () => new Date("2026-05-16T12:00:00.000Z"),
			},
			logger: {
				info: () => {},
				warn: () => {},
			},
		});

		const iphoneResult = await useCase.execute({
			code: "docs",
			request: new Request("https://example.com/api/v1/redirect/docs", {
				headers: {
					"user-agent":
						"Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.0.0 Mobile/15E148 Safari/604.1",
				},
			}),
		});

		const ipadResult = await useCase.execute({
			code: "docs",
			request: new Request("https://example.com/api/v1/redirect/docs", {
				headers: {
					"user-agent":
						"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
				},
			}),
		});

		expect(iphoneResult.status).toBe(302);
		expect(ipadResult.status).toBe(302);
		expect(capturedInputs).toEqual([
			{ browser: "Chrome", os: "iOS", device: "mobile" },
			{ browser: "Safari", os: "iOS", device: "tablet" },
		]);
	});

	it("preserves existing successful redirect decision when analytics write fails", async () => {
		const useCase = new ResolveRedirectUseCase({
			lookup: {
				findByCode: async () =>
					Link.create({
						id: "link_1",
						code: "docs",
						destinationUrl: "https://example.com/docs",
						status: "active",
						deletedAt: null,
						expiresAt: null,
						userId: "user_1",
						createdViaApiKeyId: null,
						title: null,
						createdAt: new Date("2026-05-16T00:00:00.000Z"),
						updatedAt: new Date("2026-05-16T00:00:00.000Z"),
					}),
			},
			clickEventRepository: {
				create: async () => {
					throw new Error("analytics failed");
				},
			},
			clock: {
				now: () => new Date("2026-05-16T12:00:00.000Z"),
			},
			logger: {
				info: () => {},
				warn: () => {},
			},
		});

		const result = await useCase.execute({
			code: "docs",
			request: new Request("https://example.com/api/v1/redirect/docs", {
				headers: {
					"user-agent":
						"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
				},
			}),
		});

		expect(result.status).toBe(302);
		expect(result.location).toBe("https://example.com/docs");
	});
});
