import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { requireApiPrincipal } from "../../modules/auth/presentation/api-principal-guard";
import { requireSameOriginForSessionWrite } from "../../modules/auth/presentation/session-write-origin-guard";

function appWithGuard(deps: Parameters<typeof requireApiPrincipal>[0]) {
	return new Elysia()
		.use(requireApiPrincipal(deps))
		.get("/protected", ({ authPrincipal }) => authPrincipal);
}

describe("requireApiPrincipal", () => {
	it("uses valid bearer API key before session fallback", async () => {
		const app = appWithGuard({
			apiKeyService: {
				verify: async () => ({
					valid: true as const,
					userId: "user_1",
					apiKeyId: "key_1",
				}),
			},
			authSessionService: {
				resolveFromRequest: async () => ({
					authSource: "session" as const,
					userId: "user_2",
					sessionId: "session_1",
				}),
			},
		});

		const response = await app.handle(
			new Request("http://test/protected", {
				headers: { authorization: "Bearer sk_live_secret" },
			}),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			authSource: "api-key",
			userId: "user_1",
			apiKeyId: "key_1",
		});
	});

	it("rejects invalid bearer without session fallback", async () => {
		const app = appWithGuard({
			apiKeyService: { verify: async () => ({ valid: false as const }) },
			authSessionService: {
				resolveFromRequest: async () => ({
					authSource: "session" as const,
					userId: "user_2",
					sessionId: "session_1",
				}),
			},
		});

		const response = await app.handle(
			new Request("http://test/protected", {
				headers: { authorization: "Bearer bad" },
			}),
		);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({
			error: {
				code: "unauthorized",
				message: "Authentication is required.",
			},
		});
	});

	it("falls back to session when no bearer header exists", async () => {
		const app = appWithGuard({
			apiKeyService: { verify: async () => ({ valid: false as const }) },
			authSessionService: {
				resolveFromRequest: async () => ({
					authSource: "session" as const,
					userId: "user_2",
					sessionId: "session_1",
				}),
			},
		});

		const response = await app.handle(new Request("http://test/protected"));

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			authSource: "session",
			userId: "user_2",
			sessionId: "session_1",
		});
	});
});

describe("requireSameOriginForSessionWrite", () => {
	it("rejects cross-origin session-authenticated writes", async () => {
		const app = new Elysia()
			.decorate("authPrincipal", {
				authSource: "session",
				userId: "user_1",
				sessionId: "session_1",
			} as const)
			.use(
				requireSameOriginForSessionWrite({
					allowedOrigins: ["http://localhost:5173"],
				}),
			)
			.post("/write", () => ({ ok: true }));

		const response = await app.handle(
			new Request("http://test/write", {
				method: "POST",
				headers: { origin: "https://evil.test" },
			}),
		);

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({
			error: {
				code: "validation_error",
				message: "Invalid request origin.",
			},
		});
	});

	it("does not require origin checks for bearer-authenticated writes", async () => {
		const app = new Elysia()
			.decorate("authPrincipal", {
				authSource: "api-key",
				userId: "user_1",
				apiKeyId: "key_1",
			} as const)
			.use(
				requireSameOriginForSessionWrite({
					allowedOrigins: ["http://localhost:5173"],
				}),
			)
			.post("/write", () => ({ ok: true }));

		const response = await app.handle(
			new Request("http://test/write", { method: "POST" }),
		);

		expect(response.status).toBe(200);
	});
});
