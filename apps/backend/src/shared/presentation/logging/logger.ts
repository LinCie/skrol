/**
 * Structured logger setup using Pino
 * Provides request and error logging hooks for Elysia
 */

import pino from "pino";

const isDevelopment = process.env.NODE_ENV === "development";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: [
    "authorization",
    "cookie",
    "req.headers.authorization",
    "req.headers.cookie",
  ],
  transport: isDevelopment
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      }
    : undefined,
});

export default logger;
