import postgres from "postgres";
import { describe, expect, it } from "vitest";

const dbUrl = process.env["SUPABASE_DB_URL"];
const db = dbUrl ? postgres(dbUrl, { max: 1, connect_timeout: 5 }) : null;
const live = db ? describe : describe.skip;

type Tx = postgres.TransactionSql;
type Ctx = { project: string; status: string; risk: string; task: string; activity: string; owner: string; member: string; stakeholder: string; outsider: string };

async function withFixture(run: (tx: Tx, ctx: Ctx) => Promise<void>) {
  if (!db) return;
  await db.begin(async (tx) => {
    const users = await tx<{ id: string }[]>`insert into auth.users(id, aud, role, email, email_confirmed_at, created_at, updated_at)
      select gen_random_uuid(), 'authenticated', 'authenticated', 'step10-' || gen_random_uuid() || '@example.com', now(), now(), now() from generate_series(1,4) returning id`;
    const [owner, member, stakeholder, outsider] = users.map((u) => u.id) as [string, string, string, string];
    const [project] = await tx<{ id: string }[]>`insert into public.projects(name, code, created_by) values ('Permission test', 'PERMTEST', ${owner}) returning id`;
    await tx`insert into public.project_members(project_id, user_id, role) values (${project!.id}, ${member}, 'member'), (${project!.id}, ${stakeholder}, 'stakeholder')`;
    const [status] = await tx<{ id: string }[]>`select id from public.workflow_statuses where project_id = ${project!.id} order by position limit 1`;
    const [task] = await tx<{ id: string }[]>`insert into public.tasks(project_id, title, status_id) values (${project!.id}, 'Private task', ${status!.id}) returning id`;
    const [risk] = await tx<{ id: string }[]>`insert into public.risks(project_id, title, probability, impact) values (${project!.id}, 'Visible risk', 2, 2) returning id`;
    const [activity] = await tx<{ id: string }[]>`select id from public.activity_log where project_id = ${project!.id} limit 1`;
    await run(tx, { project: project!.id, status: status!.id, risk: risk!.id, task: task!.id, activity: activity!.id, owner, member, stakeholder, outsider });
    throw new Error("rollback fixture");
  }).catch((e: unknown) => { if (!(e instanceof Error) || e.message !== "rollback fixture") throw e; });
}

async function as(tx: Tx, userId: string) {
  await tx`select set_config('request.jwt.claim.sub', ${userId}, true), set_config('request.jwt.claim.role', 'authenticated', true)`;
  await tx`set local role authenticated`;
}
async function denied(tx: Tx, query: () => Promise<unknown>) {
  await tx`savepoint denied_check`;
  try {
    const result = await query() as { count?: number };
    expect(result.count ?? 0).toBe(0);
  } catch {
    // A permission, RLS or trigger failure is the expected result.
  } finally {
    await tx`rollback to savepoint denied_check`;
  }
}

live("database permission regressions", () => {
  it("prevents stakeholder writes on every project data surface", () => withFixture(async (tx, c) => {
    await as(tx, c.stakeholder);
    const writes = [
      () => tx`update public.projects set name = 'Changed' where id = ${c.project}`,
      () => tx`insert into public.tasks(project_id, title, status_id) values (${c.project}, 'No', ${c.status})`,
      () => tx`update public.risks set title = 'Changed' where id = ${c.risk}`,
      () => tx`insert into public.issues(project_id, title) values (${c.project}, 'No')`,
      () => tx`insert into public.milestones(project_id, name, target_date) values (${c.project}, 'No', current_date)`,
      () => tx`insert into public.phases(project_id, name) values (${c.project}, 'No')`,
      () => tx`insert into public.comments(project_id, entity_type, entity_id, author_id, body) values (${c.project}, 'risk', ${c.risk}, ${c.stakeholder}, 'No')`,
      () => tx`insert into public.saved_views(project_id, user_id, name, view_type, filters) values (${c.project}, ${c.stakeholder}, 'No', 'list', '{}')`,
      () => tx`insert into public.user_view_prefs(project_id, user_id, view_mode, list_columns) values (${c.project}, ${c.stakeholder}, 'list', '[]')`,
      () => tx`insert into public.labels(project_id, name, color) values (${c.project}, 'No', 'blue')`,
      () => tx`insert into public.demo_batches(project_id) values (${c.project})`,
      () => tx`select public.load_demo_data(${c.project}, '{}'::jsonb)`,
    ];
    for (const write of writes) await denied(tx, write);
  }));

  it("prevents members from changing settings", () => withFixture(async (tx, c) => {
    await as(tx, c.member);
    for (const write of [
      () => tx`update public.workflow_statuses set name = 'Changed' where project_id = ${c.project}`,
      () => tx`insert into public.priorities(project_id, name, color, position) values (${c.project}, 'No', 'red', 99)`,
      () => tx`update public.terminology set singular = 'Story' where project_id = ${c.project}`,
      () => tx`insert into public.custom_field_defs(project_id, entity_type, name, key, type) values (${c.project}, 'task', 'No', 'no', 'text')`,
      () => tx`select public.remove_demo_data(${c.project})`,
    ]) await denied(tx, write);
  }));

  it("prevents non-members reading project data", () => withFixture(async (tx, c) => {
    await as(tx, c.outsider);
    for (const table of ["projects", "project_members", "workflow_statuses", "priorities", "labels", "terminology", "custom_field_defs", "phases", "tasks", "task_labels", "task_checklist_items", "milestones", "risks", "issues", "comments", "mentions", "activity_log", "saved_views", "user_view_prefs", "pending_invitations", "demo_batches"]) {
      const key = table === "projects" ? "id" : "project_id";
      const rows = await tx.unsafe(`select 1 from public.${table} where ${key} = $1`, [c.project]);
      expect(rows, table).toHaveLength(0);
    }
    await denied(tx, () => tx`select public.dashboard_snapshot(${c.project})`);
  }));

  it("keeps activity history append-only for clients", () => withFixture(async (tx, c) => {
    await as(tx, c.owner);
    await denied(tx, () => tx`update public.activity_log set action = 'delete' where id = ${c.activity}`);
    await denied(tx, () => tx`delete from public.activity_log where id = ${c.activity}`);
  }));

  it("denies stakeholder raw task reads but keeps dashboard aggregates", () => withFixture(async (tx, c) => {
    await as(tx, c.stakeholder);
    expect(await tx`select id from public.tasks where id = ${c.task}`).toHaveLength(0);
    const [snapshot] = await tx<{ value: { total: number; overdue?: unknown } }[]>`select public.dashboard_snapshot(${c.project}) as value`;
    expect(snapshot!.value.total).toBe(1);
    expect(snapshot!.value.overdue).toBeUndefined();
  }));
});