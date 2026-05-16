import { betterAuth, type BetterAuthOptions } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { apiKey } from "@better-auth/api-key";
import { Pool } from "pg";
import { BETTER_AUTH_BASE_PATH } from "@/modules/auth/application/auth-paths";
import {
  UserProfilesRepository,
  type EnsureUserProfile,
} from "@/modules/users/infrastructure/user-profiles.repository";
import config from "@/shared/config";

export interface BetterAuthConfigOverrides {
  database: BetterAuthOptions["database"];
  baseURL?: string;
  basePath?: string;
  secret?: string;
  ensureUserProfile?: EnsureUserProfile;
}

function escapePostgresIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
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
  const authConfig: BetterAuthOptions = {
    baseURL: overrides.baseURL ?? config.betterAuthUrl,
    basePath: overrides.basePath ?? BETTER_AUTH_BASE_PATH,
    secret: overrides.secret ?? config.betterAuthSecret,
    trustedOrigins: config.frontendOrigins,
    database: overrides.database,
    emailAndPassword: {
      enabled: true,
    },
    plugins: [
      apiKey({
        defaultPrefix: "sk_live_",
      }),
    ],
  };

  if (overrides.ensureUserProfile) {
    return {
      ...authConfig,
      databaseHooks: {
        user: {
          create: {
            after: async (user) => {
              await overrides.ensureUserProfile?.(user.id);
            },
          },
        },
      },
    };
  }

  return authConfig;
}

export function createBetterAuthInstance(overrides: BetterAuthConfigOverrides) {
  return betterAuth(createBetterAuthConfig(overrides));
}

export function createDefaultBetterAuthInstance() {
  const pool = createBetterAuthPool();

  return createBetterAuthInstance({
    database: pool,
    ensureUserProfile: async (userId) => {
      await new UserProfilesRepository().ensure(userId);
    },
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
