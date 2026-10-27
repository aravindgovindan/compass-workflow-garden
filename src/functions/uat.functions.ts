import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { projectAccess } from "@/lib/project-access.server";
import { canLogin, isUatActive, UAT_ROLES, uatEmail, uatRoleLabel, uatSettingsInput } from "@/lib/uat/rules";

const roleInput = z.object({ role: z.enum(UAT_ROLES), projectId: z.string().uuid() });

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

async function activeProjects() {
  const db = await admin();
  const { data } = await db.from("uat_settings").select("project_id, enabled, expires_at, feedback_url").eq("enabled", true);
  return (data ?? []).filter((s) => isUatActive(s));
}

/** Public: whether the shared role picker should show on the sign-in page. */
export const getUatAvailability = createServerFn({ method: "GET" }).handler(async () => {
  const settings = await activeProjects();
  if (!settings.length) return { available: false as const, projects: [] };
  const db = await admin();
  const ids = settings.map((s) => s.project_id);
  const [accounts, projects] = await Promise.all([
    db.from("uat_accounts").select("project_id, role").in("project_id", ids),
    db.from("projects").select("id, name, code").in("id", ids).order("name"),
  ]);
  const available = (projects.data ?? []).map((p) => ({ ...p, roles: (accounts.data ?? []).filter((a) => a.project_id === p.id).map((a) => a.role) })).filter((p) => p.roles.length > 0);
  return { available: available.length > 0, projects: available };
});

/** Public: issue a one-time sign-in for a shared role, resetting its email/password first. */
export const startUatSession = createServerFn({ method: "POST" })
  .inputValidator((d) => roleInput.parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const ip = (getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for")?.split(",")[0] ?? "unknown").trim();
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await db.from("uat_login_attempts").select("id", { count: "exact", head: true }).eq("ip", ip).gte("created_at", since);
    if (!canLogin(count ?? 0)) throw new Error("Too many attempts. Please wait a minute and try again.");
    const s = (await activeProjects()).find((project) => project.project_id === data.projectId);
    await db.from("uat_login_attempts").insert({ ip, project_id: s?.project_id ?? null });
    if (!s) throw new Error("Shared test access is not available right now.");
    const { data: acct } = await db.from("uat_accounts").select("user_id").eq("project_id", s.project_id).eq("role", data.role).maybeSingle();
    if (!acct) throw new Error("This test role has not been set up yet.");
    const email = uatEmail(data.role, s.project_id);
    const heal = await db.auth.admin.updateUserById(acct.user_id, {
      email, email_confirm: true, password: crypto.randomUUID() + crypto.randomUUID(), ban_duration: "none",
    });
    if (heal.error) { console.error("uat heal", heal.error.message); throw new Error("Could not start the test session. Please try again."); }
    const link = await db.auth.admin.generateLink({ type: "magiclink", email });
    const tokenHash = link.data?.properties?.hashed_token;
    if (link.error || !tokenHash) { console.error("uat link", link.error?.message); throw new Error("Could not start the test session. Please try again."); }
    return { tokenHash };
  });

async function requireRealOwner(supabase: Parameters<typeof projectAccess>[0], userId: string) {
  const { projectId } = await projectAccess(supabase, userId);
  const { data } = await supabase.rpc("is_real_project_owner", { _project_id: projectId, _user_id: userId });
  if (!data) throw new Error("Only a real project owner can manage shared test access.");
  return projectId;
}

/** Real owner: current UAT configuration and which shared accounts exist. */
export const getUatAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const projectId = await requireRealOwner(context.supabase, context.userId);
    const { data: s } = await context.supabase.from("uat_settings").select("enabled, expires_at, feedback_url").eq("project_id", projectId).maybeSingle();
    const db = await admin();
    const { data: accts } = await db.from("uat_accounts").select("role").eq("project_id", projectId);
    const settings = s ?? { enabled: false, expires_at: null, feedback_url: null };
    return { settings, active: isUatActive(settings), roles: (accts ?? []).map((a) => a.role) };
  });

export const updateUatSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => uatSettingsInput.parse(d))
  .handler(async ({ data, context }) => {
    const projectId = await requireRealOwner(context.supabase, context.userId);
    const { error } = await context.supabase.from("uat_settings").upsert(
      { project_id: projectId, enabled: data.enabled, expires_at: data.expiresAt, feedback_url: data.feedbackUrl, updated_by: context.userId },
      { onConflict: "project_id" },
    );
    if (error) { console.error("uat settings", error); throw new Error("Could not save shared test access. Please try again."); }
    return { ok: true };
  });

/** Real owner: create (or repair) the three shared accounts and their memberships. */
export const provisionUatAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const projectId = await requireRealOwner(context.supabase, context.userId);
    const db = await admin();
    for (const role of UAT_ROLES) {
      const email = uatEmail(role, projectId);
      const { data: existing } = await db.from("uat_accounts").select("user_id").eq("project_id", projectId).eq("role", role).maybeSingle();
      let userId = existing?.user_id;
      if (!userId) {
        const created = await db.auth.admin.createUser({
          email, email_confirm: true, password: crypto.randomUUID() + crypto.randomUUID(),
          user_metadata: { full_name: uatRoleLabel[role] },
        });
        if (created.error || !created.data.user) { console.error("uat create", created.error?.message); throw new Error("Could not create the shared accounts. Please try again."); }
        userId = created.data.user.id;
      }
      await db.from("profiles").upsert({ id: userId, email, full_name: uatRoleLabel[role], is_demo: true });
      const { data: m } = await db.from("project_members").select("id, role, active").eq("project_id", projectId).eq("user_id", userId).maybeSingle();
      if (!m) await db.from("project_members").insert({ project_id: projectId, user_id: userId, role });
      else if (m.role !== role || !m.active) await db.from("project_members").update({ role, active: true }).eq("id", m.id);
      if (!existing) await db.from("uat_accounts").insert({ project_id: projectId, role, user_id: userId, email });
    }
    return { ok: true };
  });
