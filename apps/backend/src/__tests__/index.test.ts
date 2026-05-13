import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { spawn } from "bun";

describe("Backend Smoke Tests", () => {
  let process: ReturnType<typeof spawn>;
  const baseUrl = "http://localhost:3000";

  beforeAll(async () => {
    // Start the backend server
    process = spawn(["bun", "run", "dev"], {
      cwd: new URL(".", import.meta.url).pathname,
      env: {
        ...process.env,
        NODE_ENV: "test",
        PORT: "3000",
        DATABASE_URL:
          process.env.DATABASE_URL ||
          "postgresql://test:test@localhost:5432/skrol_test",
        REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 3000));
  });

  afterAll(async () => {
    // Kill the server
    if (process) {
      process.kill();
    }
  });

  it("should respond to GET /", async () => {
    const response = await fetch(`${baseUrl}/`);

    expect(response.status).toBe(200);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data).toHaveProperty("message");
    expect(data).toHaveProperty("version");
  });

  it("should respond to GET /health", async () => {
    const response = await fetch(`${baseUrl}/health`);

    expect([200, 503]).toContain(response.status);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data).toHaveProperty("status");
    expect(data).toHaveProperty("timestamp");
    expect(data).toHaveProperty("dependencies");
    const deps = data.dependencies as Record<string, unknown>;
    expect(deps).toHaveProperty("postgres");
    expect(deps).toHaveProperty("redis");
  });

  it("should return healthy status when dependencies are available", async () => {
    const response = await fetch(`${baseUrl}/health`);

    const data = (await response.json()) as Record<string, unknown>;
    const deps = data.dependencies as Record<string, string>;

    // If both dependencies are available, status should be healthy
    if (deps.postgres === "available" && deps.redis === "available") {
      expect(data.status).toBe("healthy");
      expect(response.status).toBe(200);
    }
  });

  it("should return unhealthy status when a dependency is unavailable", async () => {
    const response = await fetch(`${baseUrl}/health`);

    const data = (await response.json()) as Record<string, unknown>;
    const deps = data.dependencies as Record<string, string>;

    // If any dependency is unavailable, status should be unhealthy
    if (deps.postgres === "unavailable" || deps.redis === "unavailable") {
      expect(data.status).toBe("unhealthy");
      expect(response.status).toBe(503);
    }
  });
});
