import { describe, expect, it } from "bun:test";
import { createApp } from "@/index";

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
});
