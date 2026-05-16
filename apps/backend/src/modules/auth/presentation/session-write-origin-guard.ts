import { Elysia } from "elysia";
import type { AuthPrincipal } from "../application/auth-principal";
import { apiError } from "../../../shared/presentation/api-error";

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

function originFromReferer(referer: string | null): string | null {
	if (!referer) {
		return null;
	}

	try {
		return new URL(referer).origin;
	} catch {
		return null;
	}
}

export function requireSameOriginForSessionWrite(deps: {
	allowedOrigins: string[];
}) {
	const allowed = new Set(deps.allowedOrigins);

	return new Elysia({ name: "require-session-write-origin" }).onBeforeHandle(
		{ as: "scoped" },
		(context) => {
			const { request, set } = context;
			const authPrincipal = (context as { authPrincipal?: AuthPrincipal | null })
				.authPrincipal;

			if (!WRITE_METHODS.has(request.method)) {
				return;
			}

			if (!authPrincipal || authPrincipal.authSource !== "session") {
				return;
			}

			const origin =
				request.headers.get("origin") ??
				originFromReferer(request.headers.get("referer"));

			if (origin && allowed.has(origin)) {
				return;
			}

			set.status = 403;
			return apiError(403, "validation_error", "Invalid request origin.");
		},
	);
}
