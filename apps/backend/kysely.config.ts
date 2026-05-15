import { defineConfig } from "kysely-ctl";
import { createDatabaseClient } from "@/shared/infrastructure/database";
import config from "@/shared/config";

const database = createDatabaseClient(config.databaseUrl);

export default defineConfig({
  kysely: database,
  migrations: {
    migrationFolder: "migrations",
  },
});
