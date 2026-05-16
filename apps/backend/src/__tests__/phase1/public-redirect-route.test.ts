import { describe, expect, it } from "bun:test";
import { createApp } from "@/index";
import { Link } from "@/modules/links/domain/link.entity";
import { ResolveRedirectUseCase } from "@/modules/redirect/application/resolve-redirect.use-case";

const healthyStatus = {
  status: "healthy" as const,
  timestamp: "2026-05-14T00:00:00.000Z",
  dependencies: {
    postgres: "available" as const,
    redis: "available" as const,
  },
};

function buildUseCase(
  decisionFactory: ResolveRedirectUseCase["execute"],
): ResolveRedirectUseCase {
  return {
    execute: decisionFactory,
  } as ResolveRedirectUseCase;
}

describe("ResolveRedirectUseCase", () => {
  it("maps missing link to 404", async () => {
    const useCase = new ResolveRedirectUseCase({
      lookup: {
        findByCode: async () => null,
      },
      clickEventRepository: {
        create: async () => {
          throw new Error("should not be called");
        },
      },
      clock: {
        now: () => new Date("2026-01-01T00:00:00.000Z"),
      },
      logger: {
        info: () => {},
        warn: () => {},
      },
    });

    const result = await useCase.execute({ code: "missing" });

    expect(result.status).toBe(404);
  });

  it("returns 302 when analytics insert fails", async () => {
    const useCase = new ResolveRedirectUseCase({
      lookup: {
        findByCode: async () =>
          Link.create({
          id: "link_1",
          code: "docs",
          destinationUrl: "https://example.com/docs",
          status: "active",
          deletedAt: null,
          expiresAt: null,
          userId: "user_1",
          createdViaApiKeyId: null,
          title: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        }),
      },
      clickEventRepository: {
        create: async () => {
          throw new Error("analytics failed");
        },
      },
      clock: {
        now: () => new Date("2026-01-01T00:00:00.000Z"),
      },
      logger: {
        info: () => {},
        warn: () => {},
      },
    });

    const result = await useCase.execute({
      code: "docs",
      request: new Request("https://example.com/docs"),
    });

    expect(result.status).toBe(302);
    expect(result.location).toBe("https://example.com/docs");
  });
});

describe("public redirect route", () => {
  it("does not treat /health as redirect code", async () => {
    const app = createApp({
      getHealthStatus: async () => healthyStatus,
      resolveRedirectUseCase: buildUseCase(async () => ({
        status: 302 as const,
        location: "https://example.com/docs",
      })),
    });

    const response = await app.handle(new Request("http://localhost/health"));

    expect(response.status).toBe(200);
  });

  it("treats unknown short code as 404", async () => {
    const app = createApp({
      getHealthStatus: async () => healthyStatus,
      resolveRedirectUseCase: buildUseCase(async () => ({
        status: 404 as const,
      })),
    });

    const response = await app.handle(
      new Request("http://localhost/api/v1/redirect/not-a-real-code"),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });

  it("returns location JSON and does not set Set-Cookie for active links", async () => {
    const app = createApp({
      getHealthStatus: async () => healthyStatus,
      resolveRedirectUseCase: buildUseCase(async () => ({
        status: 302 as const,
        location: "https://example.com/docs",
      })),
    });

    const response = await app.handle(
      new Request("http://localhost/api/v1/redirect/docs"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("location")).toBeNull();
    expect(await response.json()).toEqual({ location: "https://example.com/docs" });
  });

  it("does not expose active public root redirects from backend", async () => {
    const app = createApp({
      getHealthStatus: async () => healthyStatus,
      resolveRedirectUseCase: buildUseCase(async () => ({
        status: 302 as const,
        location: "https://example.com/docs",
      })),
    });

    const response = await app.handle(new Request("http://localhost/docs"));

    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
  });
});
