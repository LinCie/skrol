import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import type { ApiKeyService } from "@/modules/auth/application/api-key.service";
import type { AuthSessionService } from "@/modules/auth/application/auth-session.service";
import { apiKeyRoutes } from "@/modules/auth/presentation/routes/api-key-routes";

const sessionPrincipal = {
	authSource: "session" as const,
	userId: "user_1",
	sessionId: "session_1",
};

function createApp(overrides: {
	authSessionService?: AuthSessionService;
	apiKeyService?: Partial<ApiKeyService>;
} = {}) {
	const created: unknown[] = [];
	const listed: unknown[] = [];
	const apiKeyService: ApiKeyService = {
		verify: async () => ({ valid: false as const }),
		create: async (input) => {
			created.push(input);
			return {
				key: "sk_live_secret",
				apiKey: {
					id: "key_1",
					name: input.name,
					prefix: "sk_live_",
					created_at: "2026-05-16T00:00:00.000Z",
					last_used_at: null,
					expires_at: null,
					status: "active" as const,
				},
			};
		},
		list: async (input) => {
			listed.push(input);

			return [
				{
					id: "key_1",
					name: "CI",
					prefix: "sk_live_",
					created_at: "2026-05-16T00:00:00.000Z",
					last_used_at: null,
					expires_at: null,
					status: "active" as const,
				},
			];
		},
		revoke: async () => true,
		...overrides.apiKeyService,
	};

	return {
		created,
		listed,
		app: new Elysia().use(
			apiKeyRoutes({
				allowedOrigins: ["http://localhost:5173"],
				authSessionService: overrides.authSessionService ?? {
					resolveFromRequest: async () => sessionPrincipal,
				},
				apiKeyService,
			}),
		),
	};
}

describe("api key wrapper routes", () => {
	it("creates key and returns raw key once with safe metadata", async () => {
		const { app, created } = createApp();

		const response = await app.handle(
			new Request("http://test/api/v1/api-keys", {
				method: "POST",
				headers: {
					origin: "http://localhost:5173",
					"content-type": "application/json",
				},
				body: JSON.stringify({ name: "CI", expires_in_seconds: 3600 }),
			}),
		);

		expect(response.status).toBe(201);
		expect(await response.json()).toEqual({
			key: "sk_live_secret",
			api_key: {
				id: "key_1",
				name: "CI",
				prefix: "sk_live_",
				created_at: "2026-05-16T00:00:00.000Z",
				last_used_at: null,
				expires_at: null,
				status: "active",
			},
		});
		expect(created).toEqual([
			{ userId: "user_1", name: "CI", expiresInSeconds: 3600 },
		]);
	});

	it("lists safe metadata without raw keys", async () => {
		const { app, listed } = createApp();

		const response = await app.handle(
			new Request("http://test/api/v1/api-keys", {
				headers: { cookie: "session=value" },
			}),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			items: [
				{
					id: "key_1",
					name: "CI",
					prefix: "sk_live_",
					created_at: "2026-05-16T00:00:00.000Z",
					last_used_at: null,
					expires_at: null,
					status: "active",
				},
			],
		});
		expect(listed).toEqual([
			{ userId: "user_1", headers: expect.any(Headers) },
		]);
		expect((listed[0] as { headers: Headers }).headers.get("cookie")).toBe(
			"session=value",
		);
	});

	it("revokes key through DELETE and returns 204", async () => {
		const { app } = createApp();

		const response = await app.handle(
			new Request("http://test/api/v1/api-keys/key_1", {
				method: "DELETE",
				headers: { origin: "http://localhost:5173" },
			}),
		);

		expect(response.status).toBe(204);
	});

	it("rejects cross-origin session writes", async () => {
		const { app } = createApp();

		const response = await app.handle(
			new Request("http://test/api/v1/api-keys", {
				method: "POST",
				headers: {
					origin: "https://evil.test",
					"content-type": "application/json",
				},
				body: JSON.stringify({ name: "CI" }),
			}),
		);

		expect(response.status).toBe(403);
	});

	it("requires a session", async () => {
		const { app } = createApp({
			authSessionService: { resolveFromRequest: async () => null },
		});

		const response = await app.handle(
			new Request("http://test/api/v1/api-keys"),
		);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({
			error: {
				code: "unauthorized",
				message: "Authentication is required.",
			},
		});
	});

	it("rejects invalid create payloads", async () => {
		const invalidPayloads = [
			{},
			{ name: " " },
			{ name: "CI", expires_in: 3600 },
			{ name: "CI", expires_in_seconds: 3599 },
			{ name: "CI", expires_in_seconds: 0 },
			{ name: "CI", expires_in_seconds: -1 },
			{ name: "CI", expires_in_seconds: 1.5 },
			{ name: "CI", expires_in_seconds: 31_536_001 },
		];

		for (const payload of invalidPayloads) {
			const { app } = createApp();
			const response = await app.handle(
				new Request("http://test/api/v1/api-keys", {
					method: "POST",
					headers: {
						origin: "http://localhost:5173",
						"content-type": "application/json",
					},
					body: JSON.stringify(payload),
				}),
			);

			expect(response.status).toBe(400);
			expect(await response.json()).toEqual({
				error: {
					code: "validation_error",
					message: "Invalid API key request.",
				},
			});
		}
	});

	it("returns API error envelope for malformed JSON", async () => {
		const { app } = createApp();

		const response = await app.handle(
			new Request("http://test/api/v1/api-keys", {
				method: "POST",
				headers: {
					origin: "http://localhost:5173",
					"content-type": "application/json",
				},
				body: "{",
			}),
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: {
				code: "validation_error",
				message: "Invalid API key request.",
			},
		});
	});

	it("returns 404 when revoke misses", async () => {
		const { app } = createApp({
			apiKeyService: { revoke: async () => false },
		});

		const response = await app.handle(
			new Request("http://test/api/v1/api-keys/key_missing", {
				method: "DELETE",
				headers: { origin: "http://localhost:5173" },
			}),
		);

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({
			error: {
				code: "not_found",
				message: "API key was not found.",
			},
		});
	});

	it("maps service failures to deterministic server errors", async () => {
		const failingService = {
			create: async () => {
				throw new Error("backend down");
			},
			list: async () => {
				throw new Error("backend down");
			},
			revoke: async () => {
				throw new Error("backend down");
			},
		};
		const { app } = createApp({ apiKeyService: failingService });

		const createResponse = await app.handle(
			new Request("http://test/api/v1/api-keys", {
				method: "POST",
				headers: {
					origin: "http://localhost:5173",
					"content-type": "application/json",
				},
				body: JSON.stringify({ name: "CI" }),
			}),
		);
		const listResponse = await app.handle(
			new Request("http://test/api/v1/api-keys"),
		);
		const revokeResponse = await app.handle(
			new Request("http://test/api/v1/api-keys/key_1", {
				method: "DELETE",
				headers: { origin: "http://localhost:5173" },
			}),
		);

		for (const response of [createResponse, listResponse, revokeResponse]) {
			expect(response.status).toBe(500);
			expect(await response.json()).toEqual({
				error: {
					code: "internal_error",
					message: "API key request failed.",
				},
			});
		}
	});
});
