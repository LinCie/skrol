import { describe, expect, it } from "bun:test";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
const describeWithDatabase = databaseUrl ? describe : describe.skip;

function hasApiKeyEndpoints(plugin: unknown): boolean {
  if (!plugin || typeof plugin !== "object") {
    return false;
  }

  const endpoints = (plugin as { endpoints?: Record<string, unknown> }).endpoints;

  return Boolean(
    endpoints &&
      "createApiKey" in endpoints &&
      "listApiKeys" in endpoints &&
      "verifyApiKey" in endpoints,
  );
}

describeWithDatabase("Better Auth API Key plugin", () => {
  it("registers API key plugin in auth config", async () => {
    const { createBetterAuthConfig } = await import(
      "../../modules/auth/infrastructure/better-auth.server"
    );

    const pool = new Pool({ connectionString: databaseUrl });

    try {
      const config = createBetterAuthConfig({ database: pool });

      expect(config.plugins?.some(hasApiKeyEndpoints)).toBe(true);
    } finally {
      await pool.end();
    }
  });

  it("includes API key table in generated schema plan", async () => {
    const { inspectBetterAuthSchema } = await import(
      "../../modules/auth/infrastructure/better-auth.server"
    );

    const pool = new Pool({ connectionString: databaseUrl });

    try {
      const schema = await inspectBetterAuthSchema({ database: pool });
      const plannedTables = schema.toBeCreated.map((entry) => entry.table);

      expect(
        plannedTables.some(
          (table) =>
            table.toLowerCase().includes("api") &&
            table.toLowerCase().includes("key"),
        ),
      ).toBe(true);
    } finally {
      await pool.end();
    }
  });
});
