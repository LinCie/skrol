import { describe, expect, it } from "bun:test";
import { isReservedRouteSegment } from "@/modules/links/constants/reserved-routes";
import {
  normalizeAlias,
  validateAlias,
} from "@/modules/links/domain/alias-policy";

describe("reserved route segments", () => {
  it("returns true for reserved segments", () => {
    expect(isReservedRouteSegment("api")).toBe(true);
    expect(isReservedRouteSegment("dashboard")).toBe(true);
  });

  it("returns false for non-reserved segments", () => {
    expect(isReservedRouteSegment("abc123")).toBe(false);
  });
});

describe("alias validation", () => {
  it("normalizes alias by trim and lowercase", () => {
    expect(normalizeAlias("  Docs_123 ")).toBe("docs_123");
  });

  it("rejects invalid alias format", () => {
    expect(validateAlias("ab")).toEqual({
      ok: false,
      code: "validation_error",
    });
  });

  it("rejects reserved alias", () => {
    expect(validateAlias("health")).toEqual({
      ok: false,
      code: "reserved_alias",
    });
  });

  it("returns the normalized alias when valid", () => {
    expect(validateAlias("  Docs-123 ")).toEqual({
      ok: true,
      alias: "docs-123",
    });
  });
});
