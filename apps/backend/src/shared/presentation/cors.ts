import { Elysia } from "elysia";

const CORS_METHODS = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
const CORS_ALLOWED_HEADERS = "Content-Type,Authorization";

export interface CredentialedCorsConfig {
	allowedOrigins: string[];
}

type HeaderMap = Record<string, string | number | string[]>;

function getAllowedOrigin(request: Request, allowedOrigins: Set<string>) {
	const origin = request.headers.get("Origin");

	if (!origin || !allowedOrigins.has(origin)) {
		return null;
	}

	return origin;
}

function applyCorsHeaders(headers: Headers, origin: string) {
	headers.set("Access-Control-Allow-Origin", origin);
	headers.set("Access-Control-Allow-Credentials", "true");
	headers.append("Vary", "Origin");
}

function applyCorsHeaderMap(headers: HeaderMap, origin: string) {
	headers["Access-Control-Allow-Origin"] = origin;
	headers["Access-Control-Allow-Credentials"] = "true";
	headers.Vary = "Origin";
}

export function registerCredentialedCors(
	app: Elysia,
	config: CredentialedCorsConfig,
): Elysia {
	const allowedOrigins = new Set(config.allowedOrigins);

	app
		.onRequest(({ request }) => {
			const origin = getAllowedOrigin(request, allowedOrigins);

			if (!origin) {
				return;
			}

			if (
				request.method === "OPTIONS" &&
				request.headers.has("Access-Control-Request-Method")
			) {
				const headers = new Headers({
					"Access-Control-Allow-Methods": CORS_METHODS,
					"Access-Control-Allow-Headers":
						request.headers.get("Access-Control-Request-Headers") ??
						CORS_ALLOWED_HEADERS,
				});
				applyCorsHeaders(headers, origin);

				return new Response(null, { status: 204, headers });
			}
		})
		.onAfterHandle(({ request, set }) => {
			const origin = getAllowedOrigin(request, allowedOrigins);

			if (!origin) {
				return;
			}

			applyCorsHeaderMap(set.headers, origin);
		});

	return app;
}
