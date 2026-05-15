import { describe, expect, it } from "bun:test";
import { validateDestinationUrl } from "@/modules/links/domain/url-safety-policy";

describe("url-validator", () => {
  it("accepts https URL", () => {
    const result = validateDestinationUrl("https://skrol.ink/docs");
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected success");
    }
    expect(result.destination.hostname).toBe("skrol.ink");
  });

  it("accepts punycode IDN hosts", () => {
    const result = validateDestinationUrl("https://münich.example/path");
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected success");
    }
    expect(result.destination.hostname).toMatch(/^xn--/);
  });

  it("rejects non-http schemes", () => {
    expect(validateDestinationUrl("javascript:alert(1)")).toEqual({
      ok: false,
      code: "unsafe_url",
    });
  });

  it("rejects malformed and relative URLs", () => {
    expect(validateDestinationUrl("/relative/path")).toEqual({
      ok: false,
      code: "invalid_url",
    });
    expect(validateDestinationUrl("http://")).toEqual({
      ok: false,
      code: "invalid_url",
    });
  });

  it("rejects loopback and private literal hosts", () => {
    expect(validateDestinationUrl("http://127.0.0.1/path")).toEqual({
      ok: false,
      code: "unsafe_url",
    });
    expect(validateDestinationUrl("http://[::1]/path")).toEqual({
      ok: false,
      code: "unsafe_url",
    });
    expect(validateDestinationUrl("http://[::ffff:127.0.0.1]/path")).toEqual({
      ok: false,
      code: "unsafe_url",
    });
    expect(validateDestinationUrl("http://169.254.169.254/path")).toEqual({
      ok: false,
      code: "unsafe_url",
    });
  });

  it("rejects localhost hostnames including trailing dots", () => {
    expect(validateDestinationUrl("http://localhost./path")).toEqual({
      ok: false,
      code: "unsafe_url",
    });
  });

  it("rejects userinfo host confusion", () => {
    expect(validateDestinationUrl("https://trusted.com@evil.com")).toEqual({
      ok: false,
      code: "unsafe_url",
    });
  });
});
