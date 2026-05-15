import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
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
    .addCheckConstraint(
      "user_profiles_role_check",
      sql`role IN ('user','admin')`,
    )
    .execute();

  await db.schema
    .createTable("links")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`uuidv7()`))
    .addColumn("user_id", "text", (col) => col.notNull())
    .addColumn("code", "text", (col) => col.notNull())
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
    .addUniqueConstraint("links_code_unique", ["code"])
    .addCheckConstraint(
      "links_status_check",
      sql`status IN ('active','disabled','flagged','deleted')`,
    )
    .addCheckConstraint("links_code_lowercase_check", sql`code = lower(code)`)
    .execute();

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
    .addColumn("is_bot", "boolean", (col) => col.notNull().defaultTo(false))
    .execute();

  await db.schema
    .createTable("link_audit_logs")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`uuidv7()`))
    .addColumn("link_id", "uuid", (col) => col.notNull())
    .addColumn("user_id", "text")
    .addColumn("actor_api_key_id", "text")
    .addColumn("action", "text", (col) => col.notNull())
    .addColumn("previous_value", "jsonb")
    .addColumn("new_value", "jsonb")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createTable("domain_blocklist")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`uuidv7()`))
    .addColumn("domain", "text", (col) => col.notNull())
    .addColumn("reason", "text")
    .addColumn("created_by_user_id", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("disabled_at", "timestamptz")
    .addUniqueConstraint("domain_blocklist_domain_unique", ["domain"])
    .execute();

  await sql`CREATE INDEX links_user_id_idx ON links (user_id)`.execute(db);
  await sql`CREATE INDEX links_user_id_created_at_idx ON links (user_id, created_at DESC)`.execute(
    db,
  );
  await sql`CREATE INDEX click_events_link_id_idx ON click_events (link_id)`.execute(
    db,
  );
  await sql`CREATE INDEX click_events_clicked_at_idx ON click_events (clicked_at)`.execute(
    db,
  );
  await sql`CREATE INDEX click_events_link_id_clicked_at_idx ON click_events (link_id, clicked_at DESC)`.execute(
    db,
  );
  await sql`CREATE INDEX link_audit_logs_link_id_idx ON link_audit_logs (link_id)`.execute(
    db,
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("domain_blocklist").ifExists().execute();
  await db.schema.dropTable("link_audit_logs").ifExists().execute();
  await db.schema.dropTable("click_events").ifExists().execute();
  await db.schema.dropTable("links").ifExists().execute();
  await db.schema.dropTable("user_profiles").ifExists().execute();
}
