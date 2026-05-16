import { describe, expect, it } from "bun:test";
import { apiKey } from "@better-auth/api-key";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const thisDir = dirname(fileURLToPath(import.meta.url));
const pluginDeclarationsPath = resolve(
  thisDir,
  "../../../node_modules/@better-auth/api-key/dist/index-CajK1bx0.d.mts",
);

describe("Better Auth API Key plugin adapter discovery", () => {
  it("documents required API key operations before service wiring", async () => {
    const plugin = apiKey({ defaultPrefix: "sk_live_" }) as {
      endpoints?: Record<string, unknown>;
    };
    const declarationText = await readFile(pluginDeclarationsPath, "utf8");

    expect(plugin.endpoints).toBeDefined();

    // create decision: server method is auth.api.createApiKey; response includes one-time raw key field.
    expect(Object.keys(plugin.endpoints ?? {})).toContain("createApiKey");
    expect(declarationText).toContain("createApiKey");
    expect(declarationText).toContain("POST `/api-key/create`");
    expect(declarationText).toContain("key: string;");

    // list decision: server method is auth.api.listApiKeys; list envelope is safe metadata without raw key.
    expect(Object.keys(plugin.endpoints ?? {})).toContain("listApiKeys");
    expect(declarationText).toContain("listApiKeys");
    expect(declarationText).toContain("apiKeys:");
    expect(declarationText).toContain("metadata: Record<string, any> | null;");
    expect(declarationText).toContain("permissions:");
    expect(declarationText).toContain("referenceId: string;");
    expect(declarationText).toContain("start: string | null;");

    // verify decision: server method is auth.api.verifyApiKey; envelope has valid/error/key.
    expect(Object.keys(plugin.endpoints ?? {})).toContain("verifyApiKey");
    expect(declarationText).toContain("verifyApiKey");
    expect(declarationText).toContain("valid: boolean;");
    expect(declarationText).toContain("error:");
    expect(declarationText).toContain("key: Omit<ApiKey, \"key\"> | null;");

    // verify exposes API key ID through key.id, so actorApiKeyId can map directly from verify result.
    expect(declarationText).toContain("id: string;");

    // revoke decision: use auth.api.updateApiKey({ enabled: false }) to preserve metadata/list visibility.
    // hard delete exists (auth.api.deleteApiKey) but not needed for revoke semantics.
    expect(Object.keys(plugin.endpoints ?? {})).toContain("updateApiKey");
    expect(declarationText).toContain("updateApiKey");
    expect(declarationText).toContain("enabled: zod.ZodOptional<zod.ZodBoolean>");
    expect(Object.keys(plugin.endpoints ?? {})).toContain("deleteApiKey");
  });
});
