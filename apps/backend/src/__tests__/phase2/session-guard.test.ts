import { describe, expect, it, mock } from "bun:test";
import { Elysia } from "elysia";
import { requireSession } from "@/modules/auth/presentation/session-guard";

describe("requireSession", () => {
	it("returns 401 and does not execute handler when no session", async () => {
		const handler = mock(() => ({ ok: true }));

		const app = new Elysia()
			.use(
				requireSession({
					resolveFromRequest: async () => null,
				}),
			)
			.get("/private", handler);

		const response = await app.handle(new Request("http://localhost/private"));

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({
			error: {
				code: "unauthorized",
				message: "Authentication is required.",
			},
		});
		expect(handler).not.toHaveBeenCalled();
	});

	it("attaches the resolved principal for authenticated requests", async () => {
		const principal = {
			userId: "user_123",
			sessionId: "session_123",
			authSource: "session" as const,
		};

		const app = new Elysia()
			.use(
				requireSession({
					resolveFromRequest: async () => principal,
				}),
			)
			.get("/private", ({ authPrincipal }) => authPrincipal);

		const response = await app.handle(new Request("http://localhost/private"));

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(principal);
	});
});
