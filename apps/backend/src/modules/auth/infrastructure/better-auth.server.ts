import { betterAuth, type BetterAuthOptions } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { Pool } from "pg";
import { BETTER_AUTH_BASE_PATH } from "@/modules/auth/application/auth-paths";
import config from "@/shared/config";

export interface BetterAuthConfigOverrides {
  database: BetterAuthOptions["database"];
  baseURL?: string;
  basePath?: string;
  secret?: string;
}

function escapePostgresIdentifier(identifier: string): string {
  return identifier.replaceAll('"', '""');
}

export function createBetterAuthPool(
  databaseUrl = config.databaseUrl,
  schemaName?: string,
): Pool {
  return new Pool({
    connectionString: databaseUrl,
    options: schemaName
      ? `-c search_path=${escapePostgresIdentifier(schemaName)},public`
      : undefined,
  });
}

export function createBetterAuthConfig(
  overrides: BetterAuthConfigOverrides,
): BetterAuthOptions {
  return {
    baseURL: overrides.baseURL ?? config.betterAuthUrl,
    basePath: overrides.basePath ?? BETTER_AUTH_BASE_PATH,
    secret: overrides.secret ?? config.betterAuthSecret,
    database: overrides.database,
    emailAndPassword: {
      enabled: true,
    },
  };
}

export function createBetterAuthInstance(overrides: BetterAuthConfigOverrides) {
  return betterAuth(createBetterAuthConfig(overrides));
}

export function createDefaultBetterAuthInstance() {
  const pool = createBetterAuthPool();

  return createBetterAuthInstance({
    database: pool,
  });
}

export async function inspectBetterAuthSchema(
  overrides: BetterAuthConfigOverrides,
) {
  return await getMigrations(createBetterAuthConfig(overrides));
}

export async function compileBetterAuthSchema(
  overrides: BetterAuthConfigOverrides,
) {
  const { compileMigrations } = await inspectBetterAuthSchema(overrides);
  return await compileMigrations();
}

export async function applyBetterAuthSchema(
  overrides: BetterAuthConfigOverrides,
) {
  const { runMigrations } = await inspectBetterAuthSchema(overrides);
  await runMigrations();
}
