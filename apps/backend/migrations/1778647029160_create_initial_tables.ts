import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // Create user_profiles table
  await db.schema
    .createTable("user_profiles")
    .addColumn("user_id", "text", (col) => col.primaryKey())
    .addColumn("role", "text", (col) => col.notNull().defaultTo("user"))
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  // Create links table
  await db.schema
    .createTable("links")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`uuidv7()`))
    .addColumn("user_id", "text", (col) => col.notNull())
    .addColumn("code", "text", (col) => col.notNull().unique())
    .addColumn("destination_url", "text", (col) => col.notNull())
    .addColumn("title", "text")
    .addColumn("status", "text", (col) => col.notNull().defaultTo("active"))
    .addColumn("expires_at", "timestamptz")
    .addColumn("created_via_api_key_id", "text")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("deleted_at", "timestamptz")
    .execute();

  // Create click_events table
  await db.schema
    .createTable("click_events")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`uuidv7()`))
    .addColumn("link_id", "uuid", (col) => col.notNull())
    .addColumn("clicked_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("referrer_domain", "text")
    .addColumn("country", "text")
    .addColumn("browser", "text")
    .addColumn("os", "text")
    .addColumn("device", "text")
    .addColumn("is_bot", "boolean", (col) => col.defaultTo(false))
    .execute();

  // Create link_audit_logs table
  await db.schema
    .createTable("link_audit_logs")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`uuidv7()`))
    .addColumn("link_id", "uuid", (col) => col.notNull())
    .addColumn("user_id", "text", (col) => col.notNull())
    .addColumn("actor_api_key_id", "text")
    .addColumn("action", "text", (col) => col.notNull())
    .addColumn("previous_value", "jsonb")
    .addColumn("new_value", "jsonb")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  // Create domain_blocklist table
  await db.schema
    .createTable("domain_blocklist")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`uuidv7()`))
    .addColumn("domain", "text", (col) => col.notNull().unique())
    .addColumn("reason", "text")
    .addColumn("created_by_user_id", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("disabled_at", "timestamptz")
    .execute();

  // Create indexes for common queries
  await db.schema
    .createIndex("idx_links_user_id")
    .on("links")
    .column("user_id")
    .execute();

  await db.schema
    .createIndex("idx_links_code")
    .on("links")
    .column("code")
    .execute();

  await db.schema
    .createIndex("idx_click_events_link_id")
    .on("click_events")
    .column("link_id")
    .execute();

  await db.schema
    .createIndex("idx_link_audit_logs_link_id")
    .on("link_audit_logs")
    .column("link_id")
    .execute();

  await db.schema
    .createIndex("idx_link_audit_logs_user_id")
    .on("link_audit_logs")
    .column("user_id")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Drop tables in reverse order of creation
  await db.schema.dropTable("domain_blocklist").ifExists().execute();
  await db.schema.dropTable("link_audit_logs").ifExists().execute();
  await db.schema.dropTable("click_events").ifExists().execute();
  await db.schema.dropTable("links").ifExists().execute();
  await db.schema.dropTable("user_profiles").ifExists().execute();
}
