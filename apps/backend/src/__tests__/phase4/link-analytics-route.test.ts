import { describe, expect, it } from "bun:test";
import { createApp } from "@/index";
import type { ApiKeyService } from "@/modules/auth/application/api-key.service";
import type { AuthSessionService } from "@/modules/auth/application/auth-session.service";
import type { AnalyticsModule } from "@/modules/analytics/analytics.module";

const ownerUserId = "user_aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const apiKeyId = "key_11111111-1111-4111-8111-111111111111";

describe("GET /api/v1/links/:id/analytics", () => {
  it("returns 401 without valid auth", async () => {
    const app = createAnalyticsRouteTestApp({
      authSessionService: {
        resolveFromRequest: async () => null,
      },
      apiKeyService: {
        verify: async () => ({ valid: false as const }),
      },
      getLinkAnalyticsResult: { kind: "not_found" },
    });

    const response = await app.handle(
      new Request("http://localhost/api/v1/links/link_1/analytics"),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: {
        code: "unauthorized",
        message: "Authentication is required.",
      },
    });
  });

  it("returns 404 for unknown link", async () => {
    const app = createAnalyticsRouteTestApp({
      authSessionService: {
        resolveFromRequest: async () => ({
          userId: ownerUserId,
          sessionId: "session_123",
          authSource: "session",
        }),
      },
      apiKeyService: {
        verify: async () => ({ valid: false as const }),
      },
      getLinkAnalyticsResult: { kind: "not_found" },
    });

    const response = await app.handle(
      new Request("http://localhost/api/v1/links/link_missing/analytics"),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: "not_found",
        message: "Link was not found.",
      },
    });
  });

  it("returns 404 for non-owner link", async () => {
    const app = createAnalyticsRouteTestApp({
      authSessionService: {
        resolveFromRequest: async () => ({
          userId: ownerUserId,
          sessionId: "session_123",
          authSource: "session",
        }),
      },
      apiKeyService: {
        verify: async () => ({ valid: false as const }),
      },
      getLinkAnalyticsResult: { kind: "not_found" },
    });

    const response = await app.handle(
      new Request("http://localhost/api/v1/links/link_other/analytics"),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: "not_found",
        message: "Link was not found.",
      },
    });
  });

  it("returns 404 for soft-deleted owned link", async () => {
    const app = createAnalyticsRouteTestApp({
      authSessionService: {
        resolveFromRequest: async () => ({
          userId: ownerUserId,
          sessionId: "session_123",
          authSource: "session",
        }),
      },
      apiKeyService: {
        verify: async () => ({ valid: false as const }),
      },
      getLinkAnalyticsResult: { kind: "not_found" },
    });

    const response = await app.handle(
      new Request("http://localhost/api/v1/links/link_deleted/analytics"),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: "not_found",
        message: "Link was not found.",
      },
    });
  });

  it("returns aggregate payload for owned active link", async () => {
    const result = {
      kind: "ok" as const,
      data: {
        link_id: "link_1",
        total_clicks: 3,
        clicks_over_time: [{ bucket_start: "2026-05-01T00:00:00.000Z", clicks: 3 }],
        referrers: [{ referrer_domain: "direct", clicks: 2 }],
        browsers: [{ browser: "Chrome", clicks: 2 }],
        devices: [{ device: "desktop", clicks: 3 }],
      },
    };

    const app = createAnalyticsRouteTestApp({
      authSessionService: {
        resolveFromRequest: async () => ({
          userId: ownerUserId,
          sessionId: "session_123",
          authSource: "session",
        }),
      },
      apiKeyService: {
        verify: async () => ({ valid: false as const }),
      },
      getLinkAnalyticsResult: result,
    });

    const response = await app.handle(
      new Request("http://localhost/api/v1/links/link_1/analytics"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: result.data });
  });

  it("supports api key auth", async () => {
    const verifyInputs: string[] = [];
    const app = createAnalyticsRouteTestApp({
      authSessionService: {
        resolveFromRequest: async () => null,
      },
      apiKeyService: {
        verify: async (key) => {
          verifyInputs.push(key);
          return { valid: true as const, userId: ownerUserId, apiKeyId };
        },
      },
      getLinkAnalyticsResult: {
        kind: "ok",
        data: {
          link_id: "link_1",
          total_clicks: 1,
          clicks_over_time: [],
          referrers: [],
          browsers: [],
          devices: [],
        },
      },
    });

    const response = await app.handle(
      new Request("http://localhost/api/v1/links/link_1/analytics", {
        headers: { authorization: "Bearer sk_live_secret" },
      }),
    );

    expect(response.status).toBe(200);
    expect(verifyInputs).toEqual(["sk_live_secret"]);
  });
});

function createAnalyticsRouteTestApp(input: {
  authSessionService: AuthSessionService;
  apiKeyService: Pick<ApiKeyService, "verify">;
  getLinkAnalyticsResult:
    | { kind: "not_found" }
    | {
        kind: "ok";
        data: {
          link_id: string;
          total_clicks: number;
          clicks_over_time: Array<{ bucket_start: string; clicks: number }>;
          referrers: Array<{ referrer_domain: string; clicks: number }>;
          browsers: Array<{ browser: string; clicks: number }>;
          devices: Array<{ device: string; clicks: number }>;
          countries?: Array<{ country: string; clicks: number }>;
        };
      };
}) {
  const analyticsModule: Pick<AnalyticsModule, "getLinkAnalyticsUseCase"> = {
    getLinkAnalyticsUseCase: {
      execute: async () => input.getLinkAnalyticsResult,
    },
  };

  return createApp({
    betterAuthHandler: async () => new Response("Not Found", { status: 404 }),
    getHealthStatus: async () => ({
      status: "healthy",
      timestamp: "2026-05-15T00:00:00.000Z",
      dependencies: {
        postgres: "available",
        redis: "available",
      },
    }),
    resolveRedirectUseCase: {
      execute: async () => ({ status: 404 as const }),
    } as never,
    authSessionService: input.authSessionService,
    apiKeyService: input.apiKeyService as ApiKeyService,
    analyticsModule,
  });
}
