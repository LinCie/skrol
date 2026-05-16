import { describe, expect, it } from "bun:test";
import { BetterAuthApiKeyService } from "@/modules/auth/infrastructure/better-auth-api-key.service";

describe("BetterAuthApiKeyService", () => {
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
});
