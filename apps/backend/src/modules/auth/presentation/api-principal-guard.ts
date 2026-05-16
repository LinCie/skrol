import { Elysia } from "elysia";
import type { ApiKeyService } from "../application/api-key.service";
import type { AuthPrincipal } from "../application/auth-principal";
import type { AuthSessionService } from "../application/auth-session.service";
import { apiError } from "../../../shared/presentation/api-error";

export function requireApiPrincipal(deps: {
	apiKeyService: Pick<ApiKeyService, "verify">;
	authSessionService: AuthSessionService;
}) {
	return new Elysia({ name: "require-api-principal" })
		.decorate("authPrincipal", null as AuthPrincipal | null)
		.onBeforeHandle({ as: "scoped" }, async (context) => {
			const authorization = context.request.headers.get("authorization") ?? "";

			if (authorization.startsWith("Bearer ")) {
				const key = authorization.slice("Bearer ".length).trim();
				const verified = key
					? await deps.apiKeyService.verify(key)
					: ({ valid: false } as const);

				if (verified.valid) {
					context.authPrincipal = {
						authSource: "api-key",
						userId: verified.userId,
						apiKeyId: verified.apiKeyId,
					};
					return;
				}

				context.set.status = 401;
				return apiError(401, "unauthorized", "Authentication is required.");
			}

			const sessionPrincipal = await deps.authSessionService.resolveFromRequest(
				context.request,
			);
			if (sessionPrincipal) {
				context.authPrincipal = sessionPrincipal;
				return;
			}

			context.set.status = 401;
			return apiError(401, "unauthorized", "Authentication is required.");
		});
}
