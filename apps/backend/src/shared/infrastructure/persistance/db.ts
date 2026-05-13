/**
 * PostgreSQL client initialization
 * Handles database connection lifecycle
 */

import postgres from "postgres";
import { logger } from "../../presentation/logging/logger";

export type PostgresClient = ReturnType<typeof postgres>;

let db: PostgresClient | null = null;

export async function initializeDatabase(
  databaseUrl: string,
): Promise<PostgresClient> {
  try {
    logger.info("Initializing PostgreSQL connection...");

    db = postgres(databaseUrl);

    // Test connection
    await db`SELECT 1`;
    logger.info("PostgreSQL connection established");

    return db;
  } catch (error) {
    logger.error({ error }, "Failed to initialize PostgreSQL connection");
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
      await db.end();
      logger.info("PostgreSQL connection closed");
    } catch (error) {
      logger.error({ error }, "Error closing database connection");
    }
  }
}
