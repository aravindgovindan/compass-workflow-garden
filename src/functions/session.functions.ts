import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ProjectRole } from "@/lib/auth/roles";

export type CurrentUser = {
  userId: string;
  profile: { full_name: string; email: string | null; avatar_url: string | null } | null;
  membership: {
    role: ProjectRole;
    project: { id: string; name: string; code: string; health: "green" | "amber" | "red" };
  } | null;
};

/** The signed-in user, their profile and their role in the current project. */
export const getCurrentUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CurrentUser> => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: m }] = await Promise.all([
      supabase.from("profiles").select("full_name, email, avatar_url").eq("id", userId).maybeSingle(),
      supabase
        .from("project_members")
        .select("role, project:projects(id, name, code, health)")
        .eq("user_id", userId)
        .order("created_at")
        .limit(1)
        .maybeSingle(),
    ]);
    return {
      userId,
      profile: profile ?? null,
      membership: m && m.project ? { role: m.role, project: m.project } : null,
    };
  });
