import { describe, expect, it } from "bun:test";
import { BetterAuthApiKeyService } from "@/modules/auth/infrastructure/better-auth-api-key.service";

describe("BetterAuthApiKeyService", () => {
	it("maps created API key top-level fields to metadata", async () => {
		const service = new BetterAuthApiKeyService({
			createApiKey: async () => ({
				id: "key_1",
				key: "sk_live_secret",
				name: "CI",
				prefix: "sk_live_",
				createdAt: new Date("2026-05-16T00:00:00.000Z"),
				lastRequest: null,
				expiresAt: null,
				enabled: true,
				referenceId: "user_1",
			}),
			listApiKeys: async () => ({ apiKeys: [] }),
			verifyApiKey: async () => ({ valid: false, key: null }),
			deleteApiKey: async () => null,
			updateApiKey: async () => null,
		});

		await expect(
			service.create({ userId: "user_1", name: "CI", expiresInSeconds: 3600 }),
		).resolves.toEqual({
			key: "sk_live_secret",
			apiKey: {
				id: "key_1",
				name: "CI",
				prefix: "sk_live_",
				created_at: "2026-05-16T00:00:00.000Z",
				last_used_at: null,
				expires_at: null,
				status: "active",
			},
		});
	});

	it("passes Better Auth session headers when listing API keys", async () => {
		const headers = new Headers({ cookie: "session=value" });
		const calls: unknown[] = [];
		const service = new BetterAuthApiKeyService({
			createApiKey: async () => {
				throw new Error("unused");
			},
			listApiKeys: async (input) => {
				calls.push(input);

				return {
					apiKeys: [
						{
							id: "key_1",
							name: "CI",
							prefix: "sk_live_",
							createdAt: "2026-05-16T00:00:00.000Z",
							lastRequest: "2026-05-17T00:00:00.000Z",
							expiresAt: null,
							enabled: true,
							referenceId: "user_1",
						},
					],
				};
			},
			verifyApiKey: async () => ({ valid: false, key: null }),
			deleteApiKey: async () => null,
			updateApiKey: async () => null,
		});

		await expect(service.list({ userId: "user_1", headers })).resolves.toEqual([
			{
				id: "key_1",
				name: "CI",
				prefix: "sk_live_",
				created_at: "2026-05-16T00:00:00.000Z",
				last_used_at: "2026-05-17T00:00:00.000Z",
				expires_at: null,
				status: "active",
			},
		]);
		expect(calls).toEqual([{ query: {}, headers }]);
	});

	it("maps Better Auth missing API keys to revoke miss", async () => {
		const notFoundError = Object.assign(new Error("API Key not found"), {
			status: "NOT_FOUND",
			statusCode: 404,
		});
		const service = new BetterAuthApiKeyService({
			createApiKey: async () => {
				throw new Error("unused");
			},
			listApiKeys: async () => ({ apiKeys: [] }),
			verifyApiKey: async () => ({ valid: false, key: null }),
			deleteApiKey: async () => null,
			updateApiKey: async () => {
				throw notFoundError;
			},
		});

		await expect(
			service.revoke({ userId: "user_1", apiKeyId: "key_missing" }),
		).resolves.toBe(false);
	});

	it("maps verified API key reference id to user principal", async () => {
		const service = new BetterAuthApiKeyService({
			createApiKey: async () => {
				throw new Error("unused");
			},
			listApiKeys: async () => ({ apiKeys: [] }),
			verifyApiKey: async () => ({
				valid: true,
				key: {
					id: "key_1",
					referenceId: "user_1",
				},
			}),
			deleteApiKey: async () => null,
			updateApiKey: async () => null,
		});

		await expect(service.verify("sk_live_secret")).resolves.toEqual({
			valid: true,
			userId: "user_1",
			apiKeyId: "key_1",
		});
	});
});
