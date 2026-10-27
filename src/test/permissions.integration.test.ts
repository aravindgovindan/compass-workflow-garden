import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

const url = process.env["SUPABASE_DB_URL"];
const db = url ? postgres(url, { max: 1, connect_timeout: 5 }) : null;
const live = db ? describe : describe.skip;
afterAll(async () => { if (db) await db.end(); });
const projectTables = ["projects", "project_members", "workflow_statuses", "priorities", "labels", "terminology", "custom_field_defs", "phases", "tasks", "task_labels", "task_checklist_items", "milestones", "risks", "issues", "comments", "mentions", "activity_log", "saved_views", "user_view_prefs", "pending_invitations", "demo_batches"];
type Policy = { tablename: string; cmd: string; qual: string | null; with_check: string | null };
async function policies() {
  if (!db) throw new Error("Database test connection required");
  return db<Policy[]>`select tablename,cmd,qual,with_check from pg_policies where schemaname='public'`;
}

live("live database permission regressions", () => {
  it("restricts stakeholder project writes on every policy surface", async () => {
    const rows = (await policies()).filter((p) => p.cmd !== "SELECT" && p.tablename !== "profiles" && p.tablename !== "projects");
    expect(rows.length).toBeGreaterThan(40);
    for (const p of rows) {
      const rule = p.cmd === "DELETE" ? p.qual : p.with_check ?? p.qual;
      expect(rule, `${p.tablename} ${p.cmd}`).toMatch(/has_project_role|project_role_of|is_real_project_owner/);
      expect(rule, `${p.tablename} ${p.cmd}`).not.toContain("stakeholder");
    }
  });
  it("keeps configuration writes owner-only", async () => {
    const config = ["workflow_statuses", "priorities", "labels", "terminology", "custom_field_defs", "demo_batches"];
    const rows = (await policies()).filter((p) => config.includes(p.tablename) && p.cmd !== "SELECT");
    expect(rows).toHaveLength(18);
    for (const p of rows) {
      const rule = p.with_check ?? p.qual ?? "";
      expect(rule).toContain("'owner'");
      expect(rule).not.toContain("'member'");
    }
  });
  it("enables RLS and requires membership for every project read policy", async () => {
    if (!db) return;
    const tables = await db<{ relname: string; relrowsecurity: boolean }[]>`select relname,relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'`;
    for (const table of projectTables) expect(tables.find((t) => t.relname === table)?.relrowsecurity, table).toBe(true);
    for (const p of (await policies()).filter((p) => p.cmd === "SELECT" && p.tablename !== "profiles" && p.tablename !== "mentions")) {
      expect(p.qual, p.tablename).toMatch(/is_project_member|has_project_role|can_read_discussion/);
    }
    const projects = (await policies()).find((p) => p.tablename === "projects" && p.cmd === "SELECT");
    expect(projects?.qual).not.toContain("created_by");
    const [helpers] = await db<{ source: string }[]>`select pg_get_functiondef('public.is_project_member(uuid,uuid)'::regprocedure) as source`;
    expect(helpers?.source).toContain("active");
  });
  it("revokes client audit insert, update and delete even for an owner", async () => {
    if (!db) return;
    const [grants] = await db<{ insert: boolean; update: boolean; delete: boolean }[]>`select has_table_privilege('authenticated','public.activity_log','INSERT') as insert,has_table_privilege('authenticated','public.activity_log','UPDATE') as update,has_table_privilege('authenticated','public.activity_log','DELETE') as delete`;
    expect(grants).toEqual({ insert: false, update: false, delete: false });
    expect((await policies()).filter((p) => p.tablename === "activity_log" && p.cmd !== "SELECT")).toHaveLength(0);
  });
  it("restricts direct work-item reads and checks membership inside aggregate RPCs", async () => {
    const rows = await policies();
    for (const table of ["tasks", "task_labels", "task_checklist_items", "phases"]) {
      const p = rows.find((p) => p.tablename === table && p.cmd === "SELECT");
      expect(p?.qual).toContain("has_project_role");
      expect(p?.qual).not.toContain("stakeholder");
    }
    if (!db) return;
    const definitions = await db<{ proname: string; source: string }[]>`select proname,pg_get_functiondef(p.oid) as source from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname in ('dashboard_snapshot','milestone_summaries')`;
    expect(definitions).toHaveLength(2);
    for (const fn of definitions) expect(fn.source).toContain("Project access denied");
  });
  it("validates checklist rows without referencing missing label_id", async () => {
    if (!db) return;
    const [fn] = await db<{ source: string }[]>`select pg_get_functiondef('public.task_child_integrity()'::regprocedure) as source`;
    expect(fn?.source).toMatch(/IF tg_table_name='task_labels' THEN IF NOT EXISTS/i);
  });
});
