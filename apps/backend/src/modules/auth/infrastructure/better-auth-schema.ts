import { writeFile } from "node:fs/promises";
import {
  applyBetterAuthSchema,
  compileBetterAuthSchema,
  createBetterAuthPool,
} from "./better-auth.server";

function getArgValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index < 0) {
    return undefined;
  }

  return process.argv[index + 1];
}

async function main() {
  const command = process.argv[2];

  if (!command || !["generate", "migrate"].includes(command)) {
    console.error(
      "Usage: bun run src/modules/auth/infrastructure/better-auth-schema.ts <generate|migrate> [--schema <name>] [--output <path>]",
    );
    process.exitCode = 1;
    return;
  }

  const schemaName = getArgValue("--schema");
  const outputPath = getArgValue("--output");
  const pool = createBetterAuthPool(undefined, schemaName);

  try {
    if (command === "generate") {
      const sql = await compileBetterAuthSchema({ database: pool });
      if (outputPath) {
        await writeFile(outputPath, sql, "utf8");
      } else {
        process.stdout.write(sql);
      }
      return;
    }

    await applyBetterAuthSchema({ database: pool });
  } finally {
    await pool.end();
  }
}

const isDirectExecution = process.argv[1]?.includes("better-auth-schema.ts") ?? false;

if (isDirectExecution) {
  void main();
}
