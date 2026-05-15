import { describe, expect, it } from "bun:test";
import {
  domainMatchesBlocklist,
  normalizeHostForBlocklist,
} from "@/modules/links/domain/domain-blocklist-policy";

describe("domain blocklist", () => {
  it("normalizes lowercase hostnames and trailing dots", () => {
    expect(normalizeHostForBlocklist("Example.COM.")).toBe("example.com");
  });

  it("matches exact and subdomain", () => {
    const rows = [{ domain: "example.com", disabledAt: null }];

    expect(domainMatchesBlocklist("example.com", rows)).toBe(true);
    expect(domainMatchesBlocklist("a.example.com", rows)).toBe(true);
  });

  it("ignores disabled rows", () => {
    const rows = [{ domain: "example.com", disabledAt: new Date() }];

    expect(domainMatchesBlocklist("example.com", rows)).toBe(false);
  });

  it("matches punycode and unicode equivalents", () => {
    const rows = [{ domain: "münich.example", disabledAt: null }];

    expect(domainMatchesBlocklist("xn--mnich-kva.example", rows)).toBe(true);
  });
});
