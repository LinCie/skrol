import { describe, expect, it } from "bun:test";
import { $ } from "bun";

describe("architecture lint boundaries", () => {
  it("rejects domain importing infrastructure", async () => {
    const fixturePath =
      "src/modules/links/domain/__fixtures__/invalid-infra-import.fixture.ts";

    const result =
      await $`bunx eslint ${fixturePath} --format json --no-ignore`.nothrow();

    expect(result.exitCode).toBe(1);
    const parsed = JSON.parse(result.stdout.toString()) as Array<{
      messages: Array<{ ruleId: string | null; message: string }>;
    }>;

    const messages = parsed.flatMap((entry) => entry.messages);
    expect(
      messages.some(
        (message) =>
          message.ruleId === "no-restricted-imports" &&
          message.message.includes("Domain layer cannot import"),
      ),
    ).toBe(true);
  });
});
