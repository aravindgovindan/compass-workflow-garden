import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

const url = process.env["SUPABASE_DB_URL"];
const db = url ? postgres(url, { max: 1, connect_timeout: 5 }) : null;
const live = db ? describe : describe.skip;
afterAll(async () => { if (db) await db.end(); });

// The diagnostic connection is read-only; behavior is also exercised through the signed-in UI.
live("multi-project database boundaries", () => {
  it("limits atomic creation to authenticated non-demo callers and assigns the caller as creator", async () => {
    if (!db) return;
    const [fn] = await db<{ source: string; authenticated: boolean; anon: boolean }[]>`select pg_get_functiondef('public.create_owned_project(jsonb)'::regprocedure) as source, has_function_privilege('authenticated','public.create_owned_project(jsonb)','EXECUTE') as authenticated, has_function_privilege('anon','public.create_owned_project(jsonb)','EXECUTE') as anon`;
    expect(fn?.authenticated).toBe(true);
    expect(fn?.anon).toBe(false);
    expect(fn?.source).toContain("auth.uid() IS NULL OR public.is_demo_user(auth.uid())");
    expect(fn?.source).toContain("public.project_health,auth.uid()");
  });
  it("validates selected projects with active membership and the UAT kill switch", async () => {
    if (!db) return;
    const [fn] = await db<{ source: string }[]>`select pg_get_functiondef('public.validate_active_project()'::regprocedure) as source`;
    expect(fn?.source).toContain("user_id = NEW.id AND project_id = NEW.active_project_id AND active");
    expect(fn?.source).toContain("public.identity_allowed(NEW.active_project_id, NEW.id)");
    expect(fn?.source).toContain("Project access denied");
    const triggers = await db<{ name: string }[]>`select tgname as name from pg_trigger where tgrelid='public.profiles'::regclass and not tgisinternal`;
    expect(triggers.map((t) => t.name)).toContain("profiles_validate_active_project");
  });
  it("preserves existing active roles while accepting verified-email invitations to other projects", async () => {
    if (!db) return;
    const [fn] = await db<{ source: string }[]>`select pg_get_functiondef('public.accept_pending_invitation()'::regprocedure) as source`;
    expect(fn?.source).toContain("email_confirmed_at IS NOT NULL");
    expect(fn?.source).toContain("WHERE NOT project_members.active");
    expect(fn?.source).toContain("FOR inv IN");
  });
  it("isolates membership-only fields behind a table-specific guard", async () => {
    if (!db) return;
    const [fn] = await db<{ source: string }[]>`select pg_get_functiondef('public.uat_demo_guard()'::regprocedure) as source`;
    expect(fn?.source).toContain("IF TG_TABLE_NAME = 'project_members' THEN");
    expect(fn?.source).toContain("The last owner cannot be removed or demoted");
  });
});