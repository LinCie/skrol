import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { createApp } from "@/index";
import { registerCredentialedCors } from "@/shared/presentation/cors";

const ALLOWED_ORIGIN = "http://localhost:5173";
const DISALLOWED_ORIGIN = "https://evil.example";

function createRedirectUseCaseStub() {
	return {
		execute: async () => ({ status: 404 as const }),
	};
}

function createTestApp() {
	return createApp({
		betterAuthHandler: async () => Response.json({ session: null, user: null }),
		getHealthStatus: async () => ({
			status: "healthy",
			timestamp: "2026-05-15T00:00:00.000Z",
			dependencies: {
				postgres: "available",
				redis: "available",
			},
		}),
		resolveRedirectUseCase: createRedirectUseCaseStub() as never,
	});
}

describe("credentialed CORS origin policy", () => {
	it("echoes an allowed dashboard origin with credentials", async () => {
		const response = await createTestApp().handle(
			new Request("http://localhost/health", {
				headers: {
					Origin: ALLOWED_ORIGIN,
				},
			}),
		);

		expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
			ALLOWED_ORIGIN,
		);
		expect(response.headers.get("Access-Control-Allow-Credentials")).toBe(
			"true",
		);
	});

	it("handles preflight for an allowed dashboard origin", async () => {
		const response = await createTestApp().handle(
			new Request("http://localhost/api/auth/sign-in/email", {
				method: "OPTIONS",
				headers: {
					Origin: ALLOWED_ORIGIN,
					"Access-Control-Request-Method": "POST",
					"Access-Control-Request-Headers": "Content-Type",
				},
			}),
		);

		expect(response.status).toBe(204);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
			ALLOWED_ORIGIN,
		);
		expect(response.headers.get("Access-Control-Allow-Credentials")).toBe(
			"true",
		);
		expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
		expect(response.headers.get("Access-Control-Allow-Headers")).toContain(
			"Content-Type",
		);
	});

	it("does not grant credentialed CORS headers to a disallowed origin", async () => {
		const response = await createTestApp().handle(
			new Request("http://localhost/health", {
				headers: {
					Origin: DISALLOWED_ORIGIN,
				},
			}),
		);

		expect(response.headers.get("Access-Control-Allow-Origin")).not.toBe("*");
		expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
		expect(response.headers.get("Access-Control-Allow-Credentials")).toBeNull();
	});

	it("adds credentialed CORS headers to parser error responses for allowed origins", async () => {
		const response = await createTestApp().handle(
			new Request("http://localhost/api/v1/links", {
				method: "POST",
				headers: {
					Origin: ALLOWED_ORIGIN,
					"Content-Type": "application/json",
				},
				body: "{",
			}),
		);

		expect(response.status).toBe(400);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
			ALLOWED_ORIGIN,
		);
		expect(response.headers.get("Access-Control-Allow-Credentials")).toBe(
			"true",
		);
	});

	it("merges Origin into existing Vary response headers", async () => {
		const app = new Elysia();
		registerCredentialedCors(app, { allowedOrigins: [ALLOWED_ORIGIN] });
		app.get(
			"/vary",
			() =>
				new Response("ok", {
					headers: {
						Vary: "Accept-Encoding",
					},
				}),
		);

		const response = await app.handle(
			new Request("http://localhost/vary", {
				headers: {
					Origin: ALLOWED_ORIGIN,
				},
			}),
		);
		const vary = response.headers.get("Vary");

		expect(vary).not.toBeNull();
		expect(vary?.split(",").map((value) => value.trim()).sort()).toEqual([
			"Accept-Encoding",
			"Origin",
		]);
	});
});
