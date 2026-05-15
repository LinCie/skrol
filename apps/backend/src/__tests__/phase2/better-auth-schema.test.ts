import { describe, expect, it } from "bun:test";
import { Pool } from "pg";

const BASE_ENV = {
  NODE_ENV: "test",
  PORT: "3000",
  DATABASE_URL:
    process.env.DATABASE_URL ??
    "postgresql://0a604061d688a1bd985b6ce7:ac278bc403f410e6ae6dabb4c4f69788c484c027359f3867@localhost:5432/skrol",
  REDIS_URL: "redis://localhost:6379",
  BETTER_AUTH_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "test-secret",
};

function snapshotEnv() {
  return {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  };
}

function restoreEnv(snapshot: ReturnType<typeof snapshotEnv>) {
  process.env.NODE_ENV = snapshot.NODE_ENV;
  process.env.PORT = snapshot.PORT;
  process.env.DATABASE_URL = snapshot.DATABASE_URL;
  process.env.REDIS_URL = snapshot.REDIS_URL;
  process.env.BETTER_AUTH_URL = snapshot.BETTER_AUTH_URL;
  process.env.BETTER_AUTH_SECRET = snapshot.BETTER_AUTH_SECRET;
}

function createSchemaName() {
  return `ba_phase2_15_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function quoteIdentifier(identifier: string) {
  return `"${identifier.replaceAll("\"", "\"\"")}"`;
}

async function importAuthModule(tag: string) {
  return await import(
    `../../modules/auth/infrastructure/better-auth.server.ts?${tag}`
  );
}

describe("better auth schema workflow", () => {
  it("configures postgres auth and can generate/apply tables in a scratch schema", async () => {
    const snapshot = snapshotEnv();
    const schemaName = createSchemaName();
    const adminPool = new Pool({
      connectionString: BASE_ENV.DATABASE_URL,
    });

    try {
      Object.assign(process.env, BASE_ENV);

      await adminPool.query(
        `CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(schemaName)}`,
      );

      const authModule = await importAuthModule(schemaName);
      const schemaPool = new Pool({
        connectionString: BASE_ENV.DATABASE_URL,
        options: `-c search_path=${schemaName},public`,
      });

      try {
        const authConfig = authModule.createBetterAuthConfig({
          database: schemaPool,
        });

        expect(authConfig.baseURL).toBe("http://localhost:3000");
        expect(authConfig.basePath).toBe("/api/auth");
        expect(authConfig.secret).toBe("test-secret");
        expect(authConfig.emailAndPassword?.enabled).toBe(true);

        const before = await authModule.inspectBetterAuthSchema({
          database: schemaPool,
        });
        const plannedTables = before.toBeCreated.map((entry: { table: string }) =>
          entry.table,
        );

        expect(plannedTables.length).toBeGreaterThan(0);

        await authModule.applyBetterAuthSchema({ database: schemaPool });

        const after = await authModule.inspectBetterAuthSchema({
          database: schemaPool,
        });

        expect(after.toBeCreated).toHaveLength(0);
        expect(after.toBeAdded).toHaveLength(0);

        const tables = await adminPool.query(
          `
            select table_name
            from information_schema.tables
            where table_schema = $1
            order by table_name
          `,
          [schemaName],
        );
        const actualTables = tables.rows.map(
          (row: { table_name: string }) => row.table_name,
        );

        expect(actualTables).toEqual(expect.arrayContaining(plannedTables));
      } finally {
        await schemaPool.end();
      }
    } finally {
      await adminPool.query(
        `DROP SCHEMA IF EXISTS ${quoteIdentifier(schemaName)} CASCADE`,
      );
      await adminPool.end();
      restoreEnv(snapshot);
    }
  });
});
