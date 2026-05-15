import { describe, expect, it } from "bun:test";
import { generateUniqueCode } from "@/modules/links/domain/code-generation";
import { Link } from "@/modules/links/domain/link.entity";
import { CreateLinkUseCase } from "@/modules/links/application/create-link.use-case";

describe("generateUniqueCode", () => {
  it("retries code generation up to five attempts on unique collisions", async () => {
    const candidates = ["taken-1", "taken-2", "taken-3", "taken-4", "abc1234"];
    let index = 0;

    const result = await generateUniqueCode({
      exists: async (code) => code !== "abc1234",
      randomCode: async () => candidates[index++] ?? "abc1234",
    });

    expect(result).toBe("abc1234");
    expect(index).toBe(5);
  });
});

describe("CreateLinkUseCase", () => {
  it("creates a link with ownerUserId and validated inputs", async () => {
    const insertCalls: Array<Record<string, unknown>> = [];

    const useCase = new CreateLinkUseCase({
      repository: {
        codeExists: async () => false,
        findByCode: async () => null,
        createLink: async (payload) => {
          insertCalls.push(payload as Record<string, unknown>);
          return Link.create({
            id: "link_1",
            ...payload,
            status: "active",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
            deletedAt: null,
          });
        },
      },
      codeGenerator: {
        generate: async () => "generated",
      },
      domainBlocklist: {
        load: async () => [],
      },
    });

    const result = await useCase.execute({
      ownerUserId: "user_1",
      destinationUrl: "https://example.com/a",
      alias: "Docs",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected success");
    }

    expect(result.link.userId).toBe("user_1");
    expect(result.link.code).toBe("docs");
    expect(result.link.destinationUrl).toBe("https://example.com/a");
    expect(insertCalls).toHaveLength(1);
  });

  it("rejects blocklisted destinations", async () => {
    const useCase = new CreateLinkUseCase({
      repository: {
        codeExists: async () => false,
        findByCode: async () => null,
        createLink: async () => {
          throw new Error("should not be called");
        },
      },
      codeGenerator: {
        generate: async () => "generated",
      },
      domainBlocklist: {
        load: async () => [{ domain: "blocked.example", disabledAt: null }],
      },
    });

    const result = await useCase.execute({
      ownerUserId: "user_1",
      destinationUrl: "https://blocked.example/path",
    });

    expect(result).toEqual({ ok: false, code: "unsafe_url" });
  });

  it("rejects duplicate aliases before insertion", async () => {
    const useCase = new CreateLinkUseCase({
      repository: {
        codeExists: async () => true,
        findByCode: async () => null,
        createLink: async () => {
          throw new Error("should not be called");
        },
      },
      codeGenerator: {
        generate: async () => "generated",
      },
      domainBlocklist: {
        load: async () => [],
      },
    });

    const result = await useCase.execute({
      ownerUserId: "user_1",
      destinationUrl: "https://example.com/a",
      alias: "docs",
    });

    expect(result).toEqual({ ok: false, code: "alias_taken" });
  });

  it("uses generated code when alias is not provided", async () => {
    let generatedCalled = false;

    const useCase = new CreateLinkUseCase({
      repository: {
        codeExists: async () => false,
        findByCode: async () => null,
        createLink: async (payload) =>
          Link.create({
          id: "link_generated",
          ...payload,
          status: "active",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          deletedAt: null,
        }),
      },
      codeGenerator: {
        generate: async () => {
          generatedCalled = true;
          return "abc1234";
        },
      },
      domainBlocklist: {
        load: async () => [],
      },
    });

    const result = await useCase.execute({
      ownerUserId: "user_1",
      destinationUrl: "https://example.com/a",
    });

    expect(generatedCalled).toBe(true);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected success");
    }

    expect(result.link.code).toBe("abc1234");
  });
});
