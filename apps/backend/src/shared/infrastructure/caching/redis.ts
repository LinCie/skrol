/**
 * Redis client initialization
 * Handles Redis connection lifecycle with ioredis
 */

import Redis from "ioredis";
import { logger } from "@/shared/presentation/logging/logger";

export type RedisClient = Redis;

let redis: RedisClient | null = null;

export async function initializeRedis(redisUrl: string): Promise<RedisClient> {
  try {
    logger.info("Initializing Redis connection...");

    redis = new Redis(redisUrl, {
      retryStrategy(times) {
        // Exponential backoff: 50ms * attempt, max 2 seconds
        if (times > 20) return null; // Give up after 20 attempts
        return Math.min(times * 50, 2000);
      },
      maxRetriesPerRequest: 3,
      connectTimeout: 10000,
      commandTimeout: 5000,
      enableOfflineQueue: true,
      reconnectOnError(err) {
        // Reconnect on READONLY errors (e.g., ElastiCache failover)
        if (err.message.includes("READONLY")) return 2;
        return false;
      },
    });

    redis.on("error", (err) => {
      logger.error({ error: err }, "Redis client error");
    });

    redis.on("connect", () => {
      logger.info("Redis connected");
    });

    redis.on("ready", () => {
      logger.info("Redis ready");
    });

    redis.on("reconnecting", () => {
      logger.info("Redis reconnecting");
    });

    redis.on("close", () => {
      logger.info("Redis connection closed");
    });

    // Wait for ready state
    await redis.ping();
    logger.info("Redis connection established");

    return redis;
  } catch (error) {
    logger.error({ error }, "Failed to initialize Redis connection");
    throw error;
  }
}

export function getRedis(): RedisClient {
  if (!redis) {
    throw new Error("Redis not initialized");
  }
  return redis;
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    try {
      // Graceful quit: waits for pending replies
      await redis.quit();
      logger.info("Redis connection closed gracefully");
    } catch (error) {
      logger.error({ error }, "Error closing Redis connection");
    }
  }
}
