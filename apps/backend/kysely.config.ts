import { defineConfig } from "kysely-ctl";
import {
  getDatabase,
  initializeDatabase,
} from "@/shared/infrastructure/database";
import config from "@/shared/config";

initializeDatabase(config.databaseUrl);

export default defineConfig({
  kysely: getDatabase(),
  migrations: {
    migrationFolder: "migrations",
  },
});
