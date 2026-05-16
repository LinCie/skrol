/**
 * Backend configuration module
 * Loads and validates required environment variables at startup
 */

interface Config {
  env: string;
  port: number;
  databaseUrl: string;
  redisUrl: string;
  betterAuthUrl: string;
  betterAuthSecret: string;
  frontendOrigins: string[];
  publicFrontendOrigin: string;
  sentryDsn?: string;
}

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvOptional(
  key: string,
  defaultValue?: string,
): string | undefined {
  return process.env[key] ?? defaultValue;
}

function parseFrontendOrigins(value: string): string[] {
  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    throw new Error("FRONTEND_ORIGINS must include at least one origin.");
  }

  for (const origin of origins) {
    if (origin.includes("*")) {
      throw new Error(
        "FRONTEND_ORIGINS cannot include wildcard origin when credentialed CORS is enabled.",
      );
    }

    parseOrigin(origin, "FRONTEND_ORIGINS entry");
  }

  return Array.from(new Set(origins));
}

function parseOrigin(value: string, key: string): string {
  try {
    const parsed = new URL(value);
    if (parsed.origin !== value || !["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("invalid origin");
    }
  } catch {
    throw new Error(`Invalid ${key} value: ${value}`);
  }

  return value;
}

export function loadConfig(): Config {
  try {
    const env = getEnv("NODE_ENV", "development");
    const defaultFrontendOrigins =
      env === "production"
        ? "https://skrol.ink"
        : "http://localhost:3000,http://localhost:5173,https://skrol.ink";
    const frontendOrigins = parseFrontendOrigins(
      getEnvOptional("FRONTEND_ORIGINS", defaultFrontendOrigins) ?? "",
    );
    const defaultPublicFrontendOrigin = frontendOrigins[0];

    if (!defaultPublicFrontendOrigin) {
      throw new Error("FRONTEND_ORIGINS must include at least one origin.");
    }

    const publicFrontendOrigin = parseOrigin(
      getEnvOptional("PUBLIC_FRONTEND_ORIGIN", defaultPublicFrontendOrigin) ??
        defaultPublicFrontendOrigin,
      "PUBLIC_FRONTEND_ORIGIN",
    );
    const config: Config = {
      env,
      port: parseInt(getEnv("PORT", "3000"), 10),
      databaseUrl: getEnv("DATABASE_URL"),
      redisUrl: getEnv("REDIS_URL"),
      betterAuthUrl: getEnv("BETTER_AUTH_URL"),
      betterAuthSecret: getEnv("BETTER_AUTH_SECRET"),
      frontendOrigins,
      publicFrontendOrigin,
      sentryDsn: getEnvOptional("SENTRY_DSN"),
    };

    // Validate port is a valid number
    if (isNaN(config.port) || config.port < 1 || config.port > 65535) {
      throw new Error(
        `Invalid PORT value: ${process.env.PORT}. Must be a number between 1 and 65535.`,
      );
    }

    return config;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Configuration error: ${error.message}`);
    } else {
      console.error("Configuration error: Unknown error");
    }
    process.exit(1);
  }
}

export default loadConfig();
