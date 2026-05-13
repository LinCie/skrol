/**
 * PostgreSQL client initialization
 * Handles database connection lifecycle
 */

import { CamelCasePlugin, Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { logger } from "@/shared/presentation/logging/logger";
import { DB } from "./types";

export type PostgresClient = Kysely<DB>;

const connectionTimeoutMillis = 5_000;
const maxPoolConnections = 10;

let db: PostgresClient | null = null;

export async function initializeDatabase(
  databaseUrl: string,
): Promise<PostgresClient> {
  if (db) {
    return db;
  }

  try {
    logger.info("Initializing PostgreSQL connection...");

    db = new Kysely({
      dialect: new PostgresDialect({
        pool: new Pool({
          connectionString: databaseUrl,
          connectionTimeoutMillis,
          max: maxPoolConnections,
        }),
      }),
      plugins: [new CamelCasePlugin()],
    });

    // Test connection
    await sql`SELECT 1`.execute(db);
    logger.info("PostgreSQL connection established");

    return db;
  } catch (error) {
    logger.error({ error }, "Failed to initialize PostgreSQL connection");
    await db?.destroy();
    db = null;
    throw error;
  }
}

export function getDatabase(): PostgresClient {
  if (!db) {
    throw new Error("Database not initialized");
  }
  return db;
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    try {
      await db.destroy();
      logger.info("PostgreSQL connection closed");
    } catch (error) {
      logger.error({ error }, "Error closing database connection");
    } finally {
      db = null;
    }
  }
}
