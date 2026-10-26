import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { ProjectRole } from "@/lib/auth/roles";
import { assertCanWriteTasks } from "@/lib/tasks/rules";

export type Db = SupabaseClient<Database>;

/** The caller's current project and role (server-side). */
export async function projectAccess(supabase: Db, userId: string): Promise<{ projectId: string; role: ProjectRole }> {
  const { data } = await supabase
    .from("project_members")
    .select("project_id, role")
    .eq("user_id", userId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!data) throw new Error("You are not on a project yet.");
  return { projectId: data.project_id, role: data.role };
}

/** Owners and members may write work items; RLS re-checks every write. */
export async function requireWriter(supabase: Db, userId: string): Promise<string> {
  const { projectId, role } = await projectAccess(supabase, userId);
  assertCanWriteTasks(role);
  return projectId;
}

/** Task screens are not open to stakeholders (they see aggregates only). */
export async function requireTaskReader(supabase: Db, userId: string): Promise<string> {
  const { projectId, role } = await projectAccess(supabase, userId);
  if (role === "stakeholder") throw new Error("You don't have access to this section.");
  return projectId;
}

export function fail(what: string, error: { code?: string; message?: string } | null): never {
  console.error(what, error);
  const msg = error?.message ?? "";
  if (/Sub-tasks cannot|cannot become a sub-task|does not belong/.test(msg)) throw new Error(msg);
  throw new Error(`Could not ${what}. Please try again.`);
}

export function clean<T extends object>(o: T): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as never;
}
