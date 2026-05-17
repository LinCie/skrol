import { Elysia } from "elysia";
import type { ApiKeyService } from "@/modules/auth/application/api-key.service";
import type { AuthSessionService } from "@/modules/auth/application/auth-session.service";
import { requireApiPrincipal } from "@/modules/auth/presentation/api-principal-guard";
import type { AnalyticsModule } from "@/modules/analytics/analytics.module";
import { apiError } from "@/shared/presentation/api-error";

export interface LinkAnalyticsRoutesDependencies {
  authSessionService: AuthSessionService;
  apiKeyService: Pick<ApiKeyService, "verify">;
  analyticsModule: Pick<AnalyticsModule, "getLinkAnalyticsUseCase">;
}

export function registerLinkAnalyticsRoutes(deps: LinkAnalyticsRoutesDependencies) {
  return new Elysia({ name: "links.analytics-routes" })
    .use(
      requireApiPrincipal({
        apiKeyService: deps.apiKeyService,
        authSessionService: deps.authSessionService,
      }),
    )
    .get("/api/v1/links/:id/analytics", async ({ authPrincipal, params }) => {
      if (!authPrincipal) {
        return apiError(401, "unauthorized", "Authentication is required.");
      }

      const result = await deps.analyticsModule.getLinkAnalyticsUseCase.execute({
        principalUserId: authPrincipal.userId,
        linkId: params.id,
      });

      if (result.kind === "not_found") {
        return apiError(404, "not_found", "Link was not found.");
      }

      return Response.json({ data: result.data });
    });
}
