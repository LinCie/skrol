import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { apiKeyRoutes } from "@/modules/auth/presentation/routes/api-key-routes";

const sessionPrincipal = {
	authSource: "session" as const,
	userId: "user_1",
	sessionId: "session_1",
};

function createApp() {
	const created: unknown[] = [];

	return {
		created,
		app: new Elysia().use(
			apiKeyRoutes({
				allowedOrigins: ["http://localhost:5173"],
				authSessionService: {
					resolveFromRequest: async () => sessionPrincipal,
				},
				apiKeyService: {
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
					list: async () => [
						{
							id: "key_1",
							name: "CI",
							prefix: "sk_live_",
							created_at: "2026-05-16T00:00:00.000Z",
							last_used_at: null,
							expires_at: null,
							status: "active" as const,
						},
					],
					revoke: async () => true,
				},
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
		const { app } = createApp();

		const response = await app.handle(
			new Request("http://test/api/v1/api-keys"),
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
});
