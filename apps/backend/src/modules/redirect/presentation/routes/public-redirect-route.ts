import { Elysia } from "elysia";
import { isReservedRouteSegment } from "@/modules/links/constants/reserved-routes";
import type { ResolveRedirectUseCase } from "../../application/resolve-redirect.use-case";

export interface PublicRedirectRouteDependencies {
  resolveRedirectUseCase: ResolveRedirectUseCase;
}

function notFoundResponse(status: 404 | 410): Response {
  return new Response(
    JSON.stringify({ error: status === 410 ? "gone" : "not_found" }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    },
  );
}

export function registerPublicRedirectRoute(
  app: Elysia,
  deps: PublicRedirectRouteDependencies,
) {
  app.get("/:code", async ({ params, request }) => {
    if (isReservedRouteSegment(params.code)) {
      return notFoundResponse(404);
    }

    const decision = await deps.resolveRedirectUseCase.execute({
      code: params.code,
      request,
    });

    if (decision.status === 302) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: decision.location ?? "",
        },
      });
    }

    return notFoundResponse(decision.status);
  });

  return app;
}
