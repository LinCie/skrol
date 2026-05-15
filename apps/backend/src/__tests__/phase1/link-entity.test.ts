import { describe, expect, it } from "bun:test";
import { Link } from "@/modules/links/domain/link.entity";

describe("Link entity", () => {
  it("derives effective state from status and timestamps", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const link = Link.create({
      id: "link_1",
      userId: "user_1",
      createdViaApiKeyId: null,
      code: "docs",
      destinationUrl: "https://example.com/docs",
      title: null,
      status: "active",
      expiresAt: now,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    expect(link.stateAt(now)).toBe("expired");
    expect(link.canRedirect(now)).toBe(false);
  });

  it("treats deleted links as non-redirectable", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const link = Link.create({
      id: "link_2",
      userId: "user_1",
      createdViaApiKeyId: null,
      code: "docs",
      destinationUrl: "https://example.com/docs",
      title: null,
      status: "deleted",
      expiresAt: null,
      deletedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    expect(link.stateAt(now)).toBe("deleted");
    expect(link.canRedirect(now)).toBe(false);
  });

  it("treats flagged and disabled links as non-redirectable", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");

    const flaggedLink = Link.create({
      id: "link_3",
      userId: "user_1",
      createdViaApiKeyId: null,
      code: "flagged",
      destinationUrl: "https://example.com/flagged",
      title: null,
      status: "flagged",
      expiresAt: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    const disabledLink = Link.create({
      id: "link_4",
      userId: "user_1",
      createdViaApiKeyId: null,
      code: "disabled",
      destinationUrl: "https://example.com/disabled",
      title: null,
      status: "disabled",
      expiresAt: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    expect(flaggedLink.stateAt(now)).toBe("flagged");
    expect(flaggedLink.canRedirect(now)).toBe(false);
    expect(disabledLink.stateAt(now)).toBe("disabled");
    expect(disabledLink.canRedirect(now)).toBe(false);
  });
});
