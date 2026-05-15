import { describe, expect, it } from "bun:test";
import { createApp } from "@/index";
import { Link } from "@/modules/links/domain/link.entity";
import type { AuthSessionService } from "@/modules/auth/application/auth-session.service";
import type { CreateLinkInput } from "@/modules/links/application/create-link.use-case";
import type { ListLinksInput } from "@/modules/links/application/list-links.use-case";
import type { GetLinkDetailInput } from "@/modules/links/application/get-link-detail.use-case";

const ownerA = "user_aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const ownerB = "user_bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
const ownerAId = "11111111-1111-4111-8111-111111111111";
const ownerBId = "22222222-2222-4222-8222-222222222222";

describe("Phase 2 links API routes", () => {
	it("returns the product unauthorized envelope for unauthenticated links requests", async () => {
		const fakes = createLinksApiTestApp({ principalUserId: null });

		const response = await fakes.app.handle(
			new Request("http://localhost/api/v1/links"),
		);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({
			error: {
				code: "unauthorized",
				message: "Authentication is required.",
			},
		});
	});

	it("creates a link from documented body fields for the session principal", async () => {
		const fakes = createLinksApiTestApp({ principalUserId: ownerA });
		const expiresAt = "2999-12-31T23:59:59.000Z";

		const response = await fakes.app.handle(
			new Request("http://localhost/api/v1/links", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					url: "https://example.com/docs",
					alias: "Docs",
					title: "Docs",
					expires_at: expiresAt,
					ownerUserId: ownerB,
				}),
			}),
		);

		expect(response.status).toBe(201);
		expect(fakes.createInputs).toEqual([
			{
				ownerUserId: ownerA,
				actorApiKeyId: null,
				destinationUrl: "https://example.com/docs",
				alias: "docs",
				title: "Docs",
				expiresAt: new Date(expiresAt),
			},
		]);
		const responseBody = await response.json();
		expect(responseBody).toEqual({
			id: ownerAId,
			short_url: "http://localhost/docs",
			code: "docs",
			destination_url: "https://example.com/docs",
			title: "Docs",
			status: "active",
			expires_at: expiresAt,
			created_at: "2026-05-15T00:00:00.000Z",
		});
		expect(responseBody.userId).toBeUndefined();
		expect(responseBody.createdViaApiKeyId).toBeUndefined();
		expect(responseBody.deletedAt).toBeUndefined();
		expect(responseBody.updatedAt).toBeUndefined();
	});

	it("rejects invalid or non-future expires_at before creating a link", async () => {
		const fakes = createLinksApiTestApp({ principalUserId: ownerA });

		for (const expiresAt of [
			"not-a-date",
			"2000-01-01T00:00:00.000Z",
			"2999-02-30T00:00:00.000Z",
		]) {
			const response = await fakes.app.handle(
				new Request("http://localhost/api/v1/links", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						url: "https://example.com/docs",
						expires_at: expiresAt,
					}),
				}),
			);

			expect(response.status).toBe(400);
			expect(await response.json()).toEqual({
				error: {
					code: "validation_error",
					message: "Invalid link request.",
				},
			});
		}

		expect(fakes.createInputs).toEqual([]);
	});

	it("rejects invalid aliases before creating a link", async () => {
		const fakes = createLinksApiTestApp({ principalUserId: ownerA });

		for (const alias of [123, "", "no", "bad alias"]) {
			const response = await fakes.app.handle(
				new Request("http://localhost/api/v1/links", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						url: "https://example.com/docs",
						alias,
					}),
				}),
			);

			expect(response.status).toBe(400);
			expect(await response.json()).toEqual({
				error: {
					code: "validation_error",
					message: "Invalid link request.",
				},
			});
		}

		expect(fakes.createInputs).toEqual([]);
	});

	it("accepts future RFC3339 expires_at offsets and fractional seconds", async () => {
		const fakes = createLinksApiTestApp({ principalUserId: ownerA });

		for (const expiresAt of [
			"2999-12-31T18:59:59-05:00",
			"2999-12-31T23:59:59.0Z",
		]) {
			const response = await fakes.app.handle(
				new Request("http://localhost/api/v1/links", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						url: "https://example.com/docs",
						expires_at: expiresAt,
					}),
				}),
			);

			expect(response.status).toBe(201);
		}

		expect(fakes.createInputs.map((input) => input.expiresAt)).toEqual([
			new Date("2999-12-31T23:59:59.000Z"),
			new Date("2999-12-31T23:59:59.000Z"),
		]);
	});

	it("lists only links owned by the session principal", async () => {
		const fakes = createLinksApiTestApp({ principalUserId: ownerA });

		const response = await fakes.app.handle(
			new Request("http://localhost/api/v1/links?limit=150&cursor=abc"),
		);

		expect(response.status).toBe(200);
		expect(fakes.listInputs).toEqual([
			{ ownerUserId: ownerA, limit: 100, cursor: "abc" },
		]);
		expect(await response.json()).toEqual({
			items: [
				{
					id: ownerAId,
					short_url: "http://localhost/owner-a",
					code: "owner-a",
					destination_url: "https://example.com/owner-a",
					title: "owner-a",
					status: "active",
					expires_at: null,
					created_at: "2026-05-15T00:00:00.000Z",
				},
			],
			nextCursor: null,
		});
	});

	it("returns not_found for cross-user link detail", async () => {
		const fakes = createLinksApiTestApp({ principalUserId: ownerA });

		const response = await fakes.app.handle(
			new Request(`http://localhost/api/v1/links/${ownerBId}`),
		);

		expect(response.status).toBe(404);
		expect(fakes.detailInputs).toEqual([
			{ id: ownerBId, ownerUserId: ownerA },
		]);
		expect(await response.json()).toEqual({
			error: {
				code: "not_found",
				message: "Link was not found.",
			},
		});
	});

	it("returns owned link detail as public DTO", async () => {
		const fakes = createLinksApiTestApp({ principalUserId: ownerA });

		const response = await fakes.app.handle(
			new Request(`http://localhost/api/v1/links/${ownerAId}`),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			id: ownerAId,
			short_url: "http://localhost/owner-a",
			code: "owner-a",
			destination_url: "https://example.com/owner-a",
			title: "owner-a",
			status: "active",
			expires_at: null,
			created_at: "2026-05-15T00:00:00.000Z",
		});
	});
});

function createLinksApiTestApp(input: { principalUserId: string | null }) {
	const createInputs: CreateLinkInput[] = [];
	const listInputs: ListLinksInput[] = [];
	const detailInputs: GetLinkDetailInput[] = [];

	const authSessionService: AuthSessionService = {
		resolveFromRequest: async () =>
			input.principalUserId
				? {
						userId: input.principalUserId,
						sessionId: "session_123",
						authSource: "session",
					}
				: null,
	};

	const app = createApp({
		betterAuthHandler: async () => new Response("Not Found", { status: 404 }),
		getHealthStatus: async () => ({
			status: "healthy",
			timestamp: "2026-05-15T00:00:00.000Z",
			dependencies: {
				postgres: "available",
				redis: "available",
			},
		}),
		resolveRedirectUseCase: {
			execute: async () => ({ status: 404 as const }),
		} as never,
		authSessionService,
		linksModule: {
			createLinkUseCase: {
				execute: async (createInput: CreateLinkInput) => {
					createInputs.push(createInput);
					return {
						ok: true as const,
						link: linkFixture({
							id: ownerAId,
							userId: createInput.ownerUserId,
							code: createInput.alias?.toLowerCase() ?? "generated",
							destinationUrl: createInput.destinationUrl,
							title: createInput.title ?? null,
							expiresAt: createInput.expiresAt,
						}),
					};
				},
			},
			listLinksUseCase: {
				execute: async (listInput: ListLinksInput) => {
					listInputs.push(listInput);
					return {
						items: [
							linkFixture({
								id: ownerAId,
								userId: ownerA,
								code: "owner-a",
							}),
						],
						nextCursor: null,
					};
				},
			},
			getLinkDetailUseCase: {
				execute: async (detailInput: GetLinkDetailInput) => {
					detailInputs.push(detailInput);
					if (detailInput.id !== ownerAId) {
						return null;
					}

					return linkFixture({
						id: ownerAId,
						userId: detailInput.ownerUserId,
						code: "owner-a",
					});
				},
			},
		},
	} as never);

	return { app, createInputs, listInputs, detailInputs };
}

function linkFixture(input: {
	id: string;
	userId: string;
	code: string;
	destinationUrl?: string;
	title?: string | null;
	expiresAt?: Date | null;
}): Link {
	return Link.create({
		id: input.id,
		userId: input.userId,
		code: input.code,
		createdViaApiKeyId: null,
		destinationUrl: input.destinationUrl ?? `https://example.com/${input.code}`,
		title: input.title ?? input.code,
		status: "active",
		expiresAt: input.expiresAt ?? null,
		deletedAt: null,
		createdAt: new Date("2026-05-15T00:00:00.000Z"),
		updatedAt: new Date("2026-05-15T00:00:00.000Z"),
	});
}
