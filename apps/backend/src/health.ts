/**
 * Health check module
 * Provides connectivity checks for PostgreSQL and Redis
 */

import postgres from "postgres";
import { logger } from "./shared/presentation/logging/logger";
import { getRedis } from "./shared/infrastructure/caching/redis";

export interface HealthStatus {
  status: "healthy" | "unhealthy";
  timestamp: string;
  dependencies: {
    postgres: "available" | "unavailable";
    redis: "available" | "unavailable";
  };
}

export async function checkPostgresHealth(
  databaseUrl: string,
): Promise<boolean> {
  try {
    const sql = postgres(databaseUrl);
    await sql`SELECT 1`;
    await sql.end();
    return true;
  } catch (error) {
    logger.warn({ error }, "PostgreSQL health check failed");
    return false;
  }
}

export async function checkRedisHealth(): Promise<boolean> {
  try {
    const redis = getRedis();
    await redis.ping();
    return true;
  } catch (error) {
    logger.warn({ error }, "Redis health check failed");
    return false;
  }
}

export async function getHealthStatus(
  databaseUrl: string,
): Promise<HealthStatus> {
  const [postgresHealthy, redisHealthy] = await Promise.all([
    checkPostgresHealth(databaseUrl),
    checkRedisHealth(),
  ]);

  const status = postgresHealthy && redisHealthy ? "healthy" : "unhealthy";

  return {
    status,
    timestamp: new Date().toISOString(),
    dependencies: {
      postgres: postgresHealthy ? "available" : "unavailable",
      redis: redisHealthy ? "available" : "unavailable",
    },
  };
}
