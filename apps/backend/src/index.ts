/**
 * Backend application bootstrap
 * Deterministic startup sequence: config -> logger -> dependencies -> routes -> server
 */

import { Elysia } from "elysia";
import config from "@/shared/config";
import { logger } from "@/shared/presentation/logging/logger";
import {
  initializeDatabase,
  closeDatabase,
} from "@/shared/infrastructure/database";
import {
  initializeRedis,
  closeRedis,
} from "@/shared/infrastructure/caching/redis";
import { getHealthStatus } from "@/health";

async function bootstrap() {
  try {
    // Step 1: Config is already loaded (imported at top)
    logger.info({ env: config.env, port: config.port }, "Configuration loaded");

    // Step 2: Logger is already initialized
    logger.info("Logger initialized");

    // Step 3: Initialize dependencies
    logger.info("Initializing dependencies...");
    await initializeDatabase(config.databaseUrl);
    await initializeRedis(config.redisUrl);
    logger.info("Dependencies initialized");

    // Step 4: Create app and register routes
    const app = new Elysia();

    // Health endpoint
    app.get("/health", async () => {
      const health = await getHealthStatus(config.databaseUrl);
      return new Response(JSON.stringify(health), {
        status: health.status === "healthy" ? 200 : 503,
        headers: { "Content-Type": "application/json" },
      });
    });

    // Root endpoint
    app.get("/", () => ({
      message: "Backend service is running",
      version: "1.0.0",
    }));

    // Register request logging
    app.onRequest(({ request }) => {
      logger.info(
        { method: request.method, url: request.url },
        "Incoming request",
      );
    });

    // Register error logging
    app.onError(({ error, request }) => {
      logger.error(
        { error, method: request.method, url: request.url },
        "Request error",
      );
    });

    // Step 5: Start server
    app.listen(config.port);
    logger.info(
      { port: config.port },
      `🦊 Backend is running at http://localhost:${config.port}`,
    );

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info({ signal }, "Shutdown signal received");
      await closeDatabase();
      await closeRedis();
      process.exit(0);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    logger.error({ error }, "Failed to bootstrap application");
    process.exit(1);
  }
}

bootstrap();
