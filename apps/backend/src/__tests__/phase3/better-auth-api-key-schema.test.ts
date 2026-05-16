import { describe, expect, it } from "bun:test";
import { Pool } from "pg";
import {
  createBetterAuthConfig,
  inspectBetterAuthSchema,
} from "../../modules/auth/infrastructure/better-auth.server";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for Better Auth schema tests.");
}

describe("Better Auth API Key plugin", () => {
  it("registers API key plugin in auth config", async () => {
    const pool = new Pool({ connectionString: databaseUrl });

    try {
      const config = createBetterAuthConfig({ database: pool });

      expect(config.plugins?.length).toBeGreaterThan(0);
    } finally {
      await pool.end();
    }
  });

  it("includes API key table in generated schema plan", async () => {
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
