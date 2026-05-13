/**
 * Backend configuration module
 * Loads and validates required environment variables at startup
 */

interface Config {
  env: string;
  port: number;
  databaseUrl: string;
  redisUrl: string;
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

export function loadConfig(): Config {
  try {
    const config: Config = {
      env: getEnv("NODE_ENV", "development"),
      port: parseInt(getEnv("PORT", "3000"), 10),
      databaseUrl: getEnv("DATABASE_URL"),
      redisUrl: getEnv("REDIS_URL"),
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
