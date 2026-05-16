import { Elysia } from "elysia";
import type { ApiKeyService } from "@/modules/auth/application/api-key.service";
import type { AuthSessionService } from "@/modules/auth/application/auth-session.service";
import { requireSession } from "@/modules/auth/presentation/session-guard";
import { requireSameOriginForSessionWrite } from "@/modules/auth/presentation/session-write-origin-guard";
import { apiError } from "@/shared/presentation/api-error";

type CreateApiKeyRequest = {
	name: string;
	expires_in_seconds?: number;
	expires_in?: unknown;
};

type ParsedCreateBody =
	| { ok: true; name: string; expiresInSeconds?: number }
	| { ok: false };

export function apiKeyRoutes(deps: {
	authSessionService: AuthSessionService;
	apiKeyService: ApiKeyService;
	allowedOrigins: string[];
}) {
	return new Elysia({ name: "auth.api-key-routes" })
		.use(requireSession(deps.authSessionService))
		.use(requireSameOriginForSessionWrite({ allowedOrigins: deps.allowedOrigins }))
		.post("/api/v1/api-keys", async ({ body, authPrincipal, set }) => {
			if (!authPrincipal) {
				return apiError(401, "unauthorized", "Authentication is required.");
			}

			const parsedBody = parseCreateBody(body);
			if (!parsedBody.ok) {
				return apiError(400, "validation_error", "Invalid API key request.");
			}

			const created = await deps.apiKeyService.create({
				userId: authPrincipal.userId,
				name: parsedBody.name,
				expiresInSeconds: parsedBody.expiresInSeconds,
			});

			set.status = 201;
			return { key: created.key, api_key: created.apiKey };
		})
		.get("/api/v1/api-keys", async ({ authPrincipal }) => {
			if (!authPrincipal) {
				return apiError(401, "unauthorized", "Authentication is required.");
			}

			const items = await deps.apiKeyService.list(authPrincipal.userId);
			return { items };
		})
		.delete("/api/v1/api-keys/:id", async ({ params, authPrincipal, set }) => {
			if (!authPrincipal) {
				return apiError(401, "unauthorized", "Authentication is required.");
			}

			const revoked = await deps.apiKeyService.revoke({
				userId: authPrincipal.userId,
				apiKeyId: params.id,
			});
			if (!revoked) {
				return apiError(404, "not_found", "API key was not found.");
			}

			set.status = 204;
		});
}

function parseCreateBody(body: unknown): ParsedCreateBody {
	if (!body || typeof body !== "object") {
		return { ok: false };
	}

	const request = body as Partial<CreateApiKeyRequest>;
	if (typeof request.name !== "string" || request.name.trim().length === 0) {
		return { ok: false };
	}

	if (request.expires_in !== undefined) {
		return { ok: false };
	}

	if (
		request.expires_in_seconds !== undefined &&
		(!Number.isInteger(request.expires_in_seconds) ||
			request.expires_in_seconds <= 0)
	) {
		return { ok: false };
	}

	return {
		ok: true,
		name: request.name.trim(),
		expiresInSeconds: request.expires_in_seconds,
	};
}
