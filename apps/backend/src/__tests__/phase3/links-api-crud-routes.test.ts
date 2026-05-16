import { describe, expect, it } from "bun:test";
import { createApp } from "@/index";
import type { ApiKeyService } from "@/modules/auth/application/api-key.service";
import type { AuthSessionService } from "@/modules/auth/application/auth-session.service";
import type { CreateLinkInput } from "@/modules/links/application/create-link.use-case";
import type { DeleteLinkInput } from "@/modules/links/application/delete-link.use-case";
import type { GetLinkDetailInput } from "@/modules/links/application/get-link-detail.use-case";
import type { ListLinksInput } from "@/modules/links/application/list-links.use-case";
import type { UpdateLinkInput } from "@/modules/links/application/update-link.use-case";
import { Link } from "@/modules/links/domain/link.entity";

const ownerA = "user_aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const ownerB = "user_bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
const apiKeyId = "key_11111111-1111-4111-8111-111111111111";
const ownerAId = "11111111-1111-4111-8111-111111111111";
const ownerBId = "22222222-2222-4222-8222-222222222222";
const allowedOrigin = "http://localhost:5173";

describe("Phase 3 links API CRUD routes", () => {
	it("creates a link with bearer auth, records actor API key, and does not require Origin", async () => {
		const fakes = createLinksApiTestApp();
		const expiresAt = "2999-12-31T23:59:59.000Z";

		const response = await fakes.app.handle(
			new Request("http://localhost/api/v1/links", {
				method: "POST",
				headers: {
					authorization: "Bearer sk_live_secret",
					"content-type": "application/json",
				},
				body: JSON.stringify({
					url: "https://example.com/docs",
					alias: "Docs",
					title: "Docs",
					expires_at: expiresAt,
				}),
			}),
		);

		expect(response.status).toBe(201);
		expect(fakes.sessionCalls).toBe(0);
		expect(fakes.verifyInputs).toEqual(["sk_live_secret"]);
		expect(fakes.createInputs).toEqual([
			{
				ownerUserId: ownerA,
				actorApiKeyId: apiKeyId,
				destinationUrl: "https://example.com/docs",
				alias: "docs",
				title: "Docs",
				expiresAt: new Date(expiresAt),
			},
		]);
		expect(await response.json()).toEqual(linkDto({ code: "docs", title: "Docs", expires_at: expiresAt }));
	});

	it("rejects invalid bearer auth without calling session fallback", async () => {
		const fakes = createLinksApiTestApp({ bearerValid: false });

		const response = await fakes.app.handle(
			new Request("http://localhost/api/v1/links", {
				method: "POST",
				headers: {
					authorization: "Bearer bad",
					"content-type": "application/json",
				},
				body: JSON.stringify({ url: "https://example.com/docs" }),
			}),
		);

		expect(response.status).toBe(401);
		expect(fakes.sessionCalls).toBe(0);
		expect(fakes.createInputs).toEqual([]);
		expect(await response.json()).toEqual({
			error: {
				code: "unauthorized",
				message: "Authentication is required.",
			},
		});
	});

	it("allows session creates with same-origin Origin", async () => {
		const fakes = createLinksApiTestApp();

		const response = await fakes.app.handle(
			new Request("http://localhost/api/v1/links", {
				method: "POST",
				headers: {
					origin: allowedOrigin,
					"content-type": "application/json",
				},
				body: JSON.stringify({ url: "https://example.com/docs" }),
			}),
		);

		expect(response.status).toBe(201);
		expect(fakes.createInputs[0]).toMatchObject({
			ownerUserId: ownerA,
			actorApiKeyId: null,
			destinationUrl: "https://example.com/docs",
		});
	});

	it("rejects session writes with missing or cross-origin Origin/Referer", async () => {
		for (const headers of [
			{ "content-type": "application/json" },
			{ origin: "https://evil.test", "content-type": "application/json" },
			{ referer: "https://evil.test/dashboard", "content-type": "application/json" },
		]) {
			const fakes = createLinksApiTestApp();
			const response = await fakes.app.handle(
				new Request("http://localhost/api/v1/links", {
					method: "POST",
					headers,
					body: JSON.stringify({ url: "https://example.com/docs" }),
				}),
			);

			expect(response.status).toBe(403);
			expect(fakes.createInputs).toEqual([]);
			expect(await response.json()).toEqual({
				error: {
					code: "validation_error",
					message: "Invalid request origin.",
				},
			});
		}
	});

	it("updates allowed fields and returns a link DTO", async () => {
		const fakes = createLinksApiTestApp();
		const expiresAt = "2999-12-31T23:59:59.000Z";

		const response = await fakes.app.handle(
			new Request(`http://localhost/api/v1/links/${ownerAId}`, {
				method: "PATCH",
				headers: {
					authorization: "Bearer sk_live_secret",
					"content-type": "application/json",
				},
				body: JSON.stringify({
					title: "Updated",
					destination_url: "https://example.com/updated",
					expires_at: expiresAt,
					status: "disabled",
				}),
			}),
		);

		expect(response.status).toBe(200);
		expect(fakes.updateInputs).toEqual([
			{
				id: ownerAId,
				ownerUserId: ownerA,
				actorApiKeyId: apiKeyId,
				patch: {
					title: "Updated",
					destinationUrl: "https://example.com/updated",
					expiresAt: new Date(expiresAt),
					status: "disabled",
				},
			},
		]);
		expect(await response.json()).toEqual(
			linkDto({
				code: "owner-a",
				destination_url: "https://example.com/updated",
				title: "Updated",
				status: "disabled",
				expires_at: expiresAt,
			}),
		);
	});

	it("rejects unknown update fields and empty update bodies", async () => {
		for (const body of [{}, { title: "Updated", alias: "new" }]) {
			const fakes = createLinksApiTestApp();
			const response = await fakes.app.handle(
				new Request(`http://localhost/api/v1/links/${ownerAId}`, {
					method: "PATCH",
					headers: {
						authorization: "Bearer sk_live_secret",
						"content-type": "application/json",
					},
					body: JSON.stringify(body),
				}),
			);

			expect(response.status).toBe(400);
			expect(fakes.updateInputs).toEqual([]);
			expect(await response.json()).toEqual({
				error: {
					code: "validation_error",
					message: "Invalid link request.",
				},
			});
		}
	});

	it("rejects invalid update timestamps and statuses", async () => {
		for (const body of [
			{ expires_at: "not-a-date" },
			{ expires_at: "2999-02-30T00:00:00.000Z" },
			{ status: "archived" },
		]) {
			const fakes = createLinksApiTestApp();
			const response = await fakes.app.handle(
				new Request(`http://localhost/api/v1/links/${ownerAId}`, {
					method: "PATCH",
					headers: {
						authorization: "Bearer sk_live_secret",
						"content-type": "application/json",
					},
					body: JSON.stringify(body),
				}),
			);

			expect(response.status).toBe(400);
			expect(fakes.updateInputs).toEqual([]);
		}
	});

	it("deletes an owned link and returns 204", async () => {
		const fakes = createLinksApiTestApp();

		const response = await fakes.app.handle(
			new Request(`http://localhost/api/v1/links/${ownerAId}`, {
				method: "DELETE",
				headers: { authorization: "Bearer sk_live_secret" },
			}),
		);

		expect(response.status).toBe(204);
		expect(fakes.deleteInputs).toEqual([
			{ id: ownerAId, ownerUserId: ownerA, actorApiKeyId: apiKeyId },
		]);
	});

	it("maps missing update and delete targets to not_found", async () => {
		const updateFakes = createLinksApiTestApp();
		const updateResponse = await updateFakes.app.handle(
			new Request(`http://localhost/api/v1/links/${ownerBId}`, {
				method: "PATCH",
				headers: {
					authorization: "Bearer sk_live_secret",
					"content-type": "application/json",
				},
				body: JSON.stringify({ title: "Updated" }),
			}),
		);

		expect(updateResponse.status).toBe(404);
		expect(await updateResponse.json()).toEqual({
			error: { code: "not_found", message: "Link was not found." },
		});

		const deleteFakes = createLinksApiTestApp();
		const deleteResponse = await deleteFakes.app.handle(
			new Request(`http://localhost/api/v1/links/${ownerBId}`, {
				method: "DELETE",
				headers: { authorization: "Bearer sk_live_secret" },
			}),
		);

		expect(deleteResponse.status).toBe(404);
		expect(await deleteResponse.json()).toEqual({
			error: { code: "not_found", message: "Link was not found." },
		});
	});

	it("keeps list limit default, max, cursor, and envelope contract", async () => {
		const defaultFakes = createLinksApiTestApp();
		const defaultResponse = await defaultFakes.app.handle(
			new Request("http://localhost/api/v1/links", {
				headers: { authorization: "Bearer sk_live_secret" },
			}),
		);

		expect(defaultResponse.status).toBe(200);
		expect(defaultFakes.listInputs).toEqual([
			{ ownerUserId: ownerA, limit: 20, cursor: undefined },
		]);
		expect(await defaultResponse.json()).toEqual({
			items: [linkDto({ code: "owner-a" })],
			nextCursor: "cursor_2",
		});

		const maxFakes = createLinksApiTestApp();
		const maxResponse = await maxFakes.app.handle(
			new Request("http://localhost/api/v1/links?limit=150&cursor=abc", {
				headers: { authorization: "Bearer sk_live_secret" },
			}),
		);

		expect(maxResponse.status).toBe(200);
		expect(maxFakes.listInputs).toEqual([
			{ ownerUserId: ownerA, limit: 100, cursor: "abc" },
		]);
	});
});

function createLinksApiTestApp(input: { bearerValid?: boolean } = {}) {
	const createInputs: CreateLinkInput[] = [];
	const listInputs: ListLinksInput[] = [];
	const detailInputs: GetLinkDetailInput[] = [];
	const updateInputs: UpdateLinkInput[] = [];
	const deleteInputs: DeleteLinkInput[] = [];
	const verifyInputs: string[] = [];
	let sessionCalls = 0;

	const authSessionService: AuthSessionService = {
		resolveFromRequest: async () => {
			sessionCalls += 1;
			return {
				userId: ownerA,
				sessionId: "session_123",
				authSource: "session",
			};
		},
	};

	const apiKeyService: Pick<ApiKeyService, "verify"> = {
		verify: async (key) => {
			verifyInputs.push(key);
			return input.bearerValid === false
				? { valid: false as const }
				: { valid: true as const, userId: ownerA, apiKeyId };
		},
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
		apiKeyService: apiKeyService as ApiKeyService,
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
						items: [linkFixture({ id: ownerAId, userId: ownerA, code: "owner-a" })],
						nextCursor: "cursor_2",
					};
				},
			},
			getLinkDetailUseCase: {
				execute: async (detailInput: GetLinkDetailInput) => {
					detailInputs.push(detailInput);
					return detailInput.id === ownerAId
						? linkFixture({ id: ownerAId, userId: ownerA, code: "owner-a" })
						: null;
				},
			},
			updateLinkUseCase: {
				execute: async (updateInput: UpdateLinkInput) => {
					updateInputs.push(updateInput);
					if (updateInput.id !== ownerAId) {
						return { ok: false as const, code: "not_found" as const };
					}

					return {
						ok: true as const,
						link: linkFixture({
							id: ownerAId,
							userId: updateInput.ownerUserId,
							code: "owner-a",
							destinationUrl:
								updateInput.patch.destinationUrl ?? "https://example.com/owner-a",
							title: updateInput.patch.title ?? "owner-a",
							expiresAt: updateInput.patch.expiresAt ?? null,
							status: updateInput.patch.status === "disabled" ? "disabled" : "active",
						}),
					};
				},
			},
			deleteLinkUseCase: {
				execute: async (deleteInput: DeleteLinkInput) => {
					deleteInputs.push(deleteInput);
					return deleteInput.id === ownerAId
						? {
								ok: true as const,
								link: linkFixture({ id: ownerAId, userId: ownerA, code: "owner-a" }),
							}
						: { ok: false as const, code: "not_found" as const };
				},
			},
		},
	} as never);

	return {
		app,
		createInputs,
		listInputs,
		detailInputs,
		updateInputs,
		deleteInputs,
		verifyInputs,
		get sessionCalls() {
			return sessionCalls;
		},
	};
}

function linkFixture(input: {
	id: string;
	userId: string;
	code: string;
	destinationUrl?: string;
	title?: string | null;
	status?: "active" | "disabled";
	expiresAt?: Date | null;
}): Link {
	return Link.create({
		id: input.id,
		userId: input.userId,
		code: input.code,
		createdViaApiKeyId: null,
		destinationUrl: input.destinationUrl ?? `https://example.com/${input.code}`,
		title: input.title ?? input.code,
		status: input.status ?? "active",
		expiresAt: input.expiresAt ?? null,
		deletedAt: null,
		createdAt: new Date("2026-05-15T00:00:00.000Z"),
		updatedAt: new Date("2026-05-15T00:00:00.000Z"),
	});
}

function linkDto(overrides: Partial<Record<string, unknown>> = {}) {
	const code = (overrides.code as string | undefined) ?? "owner-a";

	return {
		id: ownerAId,
		short_url: `http://localhost:3000/${code}`,
		code,
		destination_url: `https://example.com/${code}`,
		title: code,
		status: "active",
		expires_at: null,
		created_at: "2026-05-15T00:00:00.000Z",
		...overrides,
	};
}
