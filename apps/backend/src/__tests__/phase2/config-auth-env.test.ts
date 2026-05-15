import { describe, expect, it } from "bun:test";

const BASE_ENV = {
  NODE_ENV: "test",
  PORT: "3000",
  DATABASE_URL: "postgresql://test:test@localhost:5432/skrol_test",
  REDIS_URL: "redis://localhost:6379",
  BETTER_AUTH_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "test-secret",
};

function snapshotEnv() {
  return {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  };
}

function restoreEnv(snapshot: ReturnType<typeof snapshotEnv>) {
  process.env.NODE_ENV = snapshot.NODE_ENV;
  process.env.PORT = snapshot.PORT;
  process.env.DATABASE_URL = snapshot.DATABASE_URL;
  process.env.REDIS_URL = snapshot.REDIS_URL;
  process.env.BETTER_AUTH_URL = snapshot.BETTER_AUTH_URL;
  process.env.BETTER_AUTH_SECRET = snapshot.BETTER_AUTH_SECRET;
}

async function importConfig(tag: string) {
  return await import(`../../shared/config.ts?${tag}`);
}

describe("auth config env", () => {
  it("requires BETTER_AUTH_SECRET", async () => {
    const snapshot = snapshotEnv();
    const originalExit = process.exit;

    try {
      Object.assign(process.env, BASE_ENV);
      delete process.env.BETTER_AUTH_SECRET;
      process.exit = ((code?: number) => {
        throw new Error(`process.exit:${code ?? 0}`);
      }) as typeof process.exit;

      await expect(importConfig("missing-secret")).rejects.toThrow(
        "process.exit:1",
      );
    } finally {
      process.exit = originalExit;
      restoreEnv(snapshot);
    }
  });

  it("uses BETTER_AUTH_URL and exposes the new auth config surface", async () => {
    const snapshot = snapshotEnv();

    try {
      Object.assign(process.env, BASE_ENV);

      const { loadConfig } = await importConfig("better-auth-url");
      const config = loadConfig();

      expect(config.betterAuthUrl).toBe("http://localhost:3000");
      expect(config.betterAuthSecret).toBe("test-secret");
    } finally {
      restoreEnv(snapshot);
    }
  });
});
