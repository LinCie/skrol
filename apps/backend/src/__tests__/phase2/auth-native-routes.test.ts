import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { createApp } from "@/index";
import { mountBetterAuthRoutes } from "@/modules/auth/presentation/routes/mount-better-auth";

function createNativeAuthHandler() {
	const seenPaths: string[] = [];

	const handler = async (request: Request) => {
		const pathname = new URL(request.url).pathname;
		seenPaths.push(pathname);

		if (pathname === "/api/auth/get-session") {
			return Response.json({
				session: null,
				user: null,
			});
		}

		return new Response("Not Found", { status: 404 });
	};

	return { handler, seenPaths };
}

function createRedirectUseCaseStub() {
	return {
		execute: async () => ({ status: 404 as const }),
	};
}

describe("native Better Auth routes", () => {
	it("passes /api/auth requests to the native handler without stripping the base path", async () => {
		const auth = createNativeAuthHandler();
		const app = new Elysia().use(
			mountBetterAuthRoutes({
				handler: auth.handler,
			}),
		);

		const response = await app.handle(
			new Request("http://localhost/api/auth/get-session"),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			session: null,
			user: null,
		});
		expect(auth.seenPaths).toEqual(["/api/auth/get-session"]);
	});

	it("does not expose phase 2 auth behavior under /api/v1/auth", async () => {
		const auth = createNativeAuthHandler();
		const app = new Elysia().use(
			mountBetterAuthRoutes({
				handler: auth.handler,
			}),
		);

		const response = await app.handle(
			new Request("http://localhost/api/v1/auth/get-session"),
		);

		expect(response.status).toBe(404);
		expect(auth.seenPaths).toEqual([]);
	});

	it("registers the native auth handler in the backend app", async () => {
		const auth = createNativeAuthHandler();
		const app = createApp({
			betterAuthHandler: auth.handler,
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

		const authResponse = await app.handle(
			new Request("http://localhost/api/auth/get-session"),
		);
		const wrapperResponse = await app.handle(
			new Request("http://localhost/api/v1/auth/get-session"),
		);

		expect(authResponse.status).toBe(200);
		expect(wrapperResponse.status).toBe(404);
		expect(auth.seenPaths).toEqual(["/api/auth/get-session"]);
	});
});
