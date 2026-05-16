import { Elysia } from "elysia";
import type { AuthPrincipal } from "@/modules/auth/application/auth-principal";
import type { AuthSessionService } from "@/modules/auth/application/auth-session.service";
import { apiError } from "@/shared/presentation/api-error";

export type RequireSessionDependencies = Pick<
	AuthSessionService,
	"resolveFromRequest"
>;

export function requireSession(deps: RequireSessionDependencies) {
	return new Elysia({ name: "auth.require-session" })
		.decorate("authPrincipal", null as AuthPrincipal | null)
		.onBeforeHandle({ as: "scoped" }, async (context) => {
			const principal = await deps.resolveFromRequest(context.request);

			if (!principal) {
				return apiError(
					401,
					"unauthorized",
					"Authentication is required.",
				);
			}

			context.authPrincipal = principal;
		});
}
