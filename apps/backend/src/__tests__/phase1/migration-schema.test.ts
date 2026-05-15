import { describe, expect, it } from "bun:test";

describe("phase1 migration schema", () => {
  it("includes links status check, lowercase code check, and canonical indexes", async () => {
    const migrationPath = new URL(
      "../../../migrations/1778647029160_create_initial_tables.ts",
      import.meta.url,
    );
    const source = await Bun.file(migrationPath).text();

    expect(source).toContain("links_status_check");
    expect(source).toContain(
      "status IN ('active','disabled','flagged','deleted')",
    );
    expect(source).toContain("links_code_lowercase_check");
    expect(source).toContain("code = lower(code)");
    expect(source).toContain("links_user_id_idx");
    expect(source).toContain("links_user_id_created_at_idx");
    expect(source).toContain("click_events_link_id_idx");
    expect(source).toContain("click_events_clicked_at_idx");
    expect(source).toContain("click_events_link_id_clicked_at_idx");
    expect(source).toContain("link_audit_logs_link_id_idx");
    expect(source).toContain("domain_blocklist_domain_unique");
  });
});
