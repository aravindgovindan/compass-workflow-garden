import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

const url = process.env["SUPABASE_DB_URL"];
const db = url ? postgres(url, { max: 1, connect_timeout: 5 }) : null;
const live = db ? describe : describe.skip;
afterAll(async () => { if (db) await db.end(); });

live("multi-project database rules", () => {
  it("creates two projects atomically and selects each new project with seeded configuration", async () => {
    if (!db) return;
    const rollback = new Error("rollback verification");
    try {
      await db.begin(async (tx) => {
        const [caller] = await tx<{ id: string }[]>`select p.id from public.profiles p join public.project_members m on m.user_id=p.id where not p.is_demo and m.active and m.role='owner' limit 1`;
        if (!caller) throw new Error("Real owner fixture required");
        await tx`select set_config('request.jwt.claim.sub', ${caller.id}, true)`;
        await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: caller.id, role: "authenticated" })}, true)`;
        const ids: string[] = [];
        for (const code of ["VERIFYONE", "VERIFYTWO"]) {
          const input = JSON.stringify({ name: "Project verification", code, status: "planning", health: "green" });
          const [result] = await tx<{ project: { id: string } }[]>`select public.create_owned_project(${input}::jsonb) as project`;
          if (!result) throw new Error("Project was not returned");
          ids.push(result.project.id);
          const [profile] = await tx<{ active_project_id: string }[]>`select active_project_id from public.profiles where id=${caller.id}`;
          expect(profile?.active_project_id).toBe(result.project.id);
          const [membership] = await tx<{ role: string }[]>`select role from public.project_members where project_id=${result.project.id} and user_id=${caller.id} and active`;
          expect(membership?.role).toBe("owner");
          const [config] = await tx<{ count: number }[]>`select count(*)::integer as count from public.workflow_statuses where project_id=${result.project.id}`;
          expect(config?.count).toBe(5);
        }
        expect(new Set(ids).size).toBe(2);
        const first = ids[0];
        if (!first) throw new Error("Missing first project");
        await tx`update public.profiles set active_project_id=${first} where id=${caller.id}`;
        const [profile] = await tx<{ active_project_id: string }[]>`select active_project_id from public.profiles where id=${caller.id}`;
        expect(profile?.active_project_id).toBe(first);
        throw rollback;
      });
    } catch (error) { if (error !== rollback) throw error; }
  });

  it("rejects a direct profile switch to an unauthorized project", async () => {
    if (!db) return;
    await expect(db.begin(async (tx) => {
      const [caller] = await tx<{ id: string }[]>`select id from public.profiles where not is_demo limit 1`;
      if (!caller) throw new Error("Real user fixture required");
      await tx`select set_config('request.jwt.claim.sub', ${caller.id}, true)`;
      await tx`update public.profiles set active_project_id='00000000-0000-4000-8000-000000000001' where id=${caller.id}`;
    })).rejects.toThrow("Project access denied");
  });
  it("does not evaluate membership-only fields when changing a project", async () => {
    if (!db) return;
    const rollback = new Error("rollback verification");
    try {
      await db.begin(async (tx) => {
        const [project] = await tx<{ id: string }[]>`select id from public.projects limit 1`;
        if (!project) throw new Error("Project fixture required");
        const updated = await tx`update public.projects set description=description where id=${project.id} returning id`;
        expect(updated).toHaveLength(1);
        throw rollback;
      });
    } catch (error) { if (error !== rollback) throw error; }
  });
});