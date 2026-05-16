import { describe, expect, it } from "bun:test";
import { Pool } from "pg";
import {
  createBetterAuthConfig,
  inspectBetterAuthSchema,
} from "../../modules/auth/infrastructure/better-auth.server";

function requireDatabaseUrl(): string | null {
  return process.env.DATABASE_URL ?? null;
}

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

describe("Better Auth API Key plugin", () => {
  it("registers API key plugin in auth config", async () => {
    const databaseUrl = requireDatabaseUrl();
    if (!databaseUrl) {
      return;
    }

    const pool = new Pool({ connectionString: databaseUrl });

    try {
      const config = createBetterAuthConfig({ database: pool });

      expect(config.plugins?.some(hasApiKeyEndpoints)).toBe(true);
    } finally {
      await pool.end();
    }
  });

  it("includes API key table in generated schema plan", async () => {
    const databaseUrl = requireDatabaseUrl();
    if (!databaseUrl) {
      return;
    }

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
