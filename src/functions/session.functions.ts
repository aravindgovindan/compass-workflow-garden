import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ProjectRole } from "@/lib/auth/roles";
import { isUatActive } from "@/lib/uat/rules";
import { selectMembership } from "@/lib/projects/selection";

export type CurrentUser = {
  userId: string;
  profile: { full_name: string; email: string | null; avatar_url: string | null } | null;
  projects: { id: string; name: string; code: string; health: "green" | "amber" | "red"; role: ProjectRole }[];
  membership: {
    role: ProjectRole;
    project: { id: string; name: string; code: string; health: "green" | "amber" | "red" };
  } | null;
  /** Present only for shared UAT accounts. */
  uat: { revoked: boolean; feedbackUrl: string | null; expiresAt: string | null } | null;
};

/** The signed-in user, their profile and their role in the current project. */
export const getCurrentUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CurrentUser> => {
    const { supabase, userId } = context;
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name, email, avatar_url, is_demo, active_project_id")
      .eq("id", userId)
      .maybeSingle();
    if (profileError) throw new Error("Could not load your profile. Please try again.");
    if (!profile?.is_demo) {
      const acceptance = await supabase.rpc("accept_pending_invitation");
      if (acceptance.error) throw new Error("Could not check your invitation. Please try again.");
    }
    const { data: rows, error: membershipsError } = await supabase
      .from("project_members")
      .select("id, project_id, role, project:projects(id, name, code, health)")
      .eq("user_id", userId)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .order("id");
    if (membershipsError) throw new Error("Could not load your projects. Please try again.");
    const memberships = (rows ?? []).filter((row) => row.project !== null);
    const m = selectMembership(memberships, profile?.active_project_id);
    let uat: CurrentUser["uat"] = null;
    if (profile?.is_demo) {
      const s = m?.project
        ? (await supabase.from("uat_settings").select("enabled, expires_at, feedback_url").eq("project_id", m.project.id).maybeSingle()).data
        : null;
      uat = { revoked: !m || !isUatActive(s), feedbackUrl: s?.feedback_url ?? null, expiresAt: s?.expires_at ?? null };
    }
    return {
      userId,
      projects: memberships.flatMap((row) => row.project ? [{ ...row.project, role: row.role }] : []),
      profile: profile ? { full_name: profile.full_name, email: profile.email, avatar_url: profile.avatar_url } : null,
      membership: m && m.project && !uat?.revoked ? { role: m.role, project: m.project } : null,
      uat,
    };
  });
