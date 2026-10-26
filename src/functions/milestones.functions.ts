import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { byId } from "@/lib/schemas/tasks";
import { milestoneCreate, milestoneLink, milestoneUnlink, milestoneUpdate } from "@/lib/schemas/milestones";
import { assertCanWriteMilestone, milestoneProgress, milestoneStatus, type MilestoneStatus, type Progress } from "@/lib/milestones/status";
import { clean, fail, projectAccess, requireWriter } from "@/lib/project-access.server";

// Create/update/delete is written to activity_log by the log_activity() trigger (tasks too, for linking).
type Row = Database["public"]["Tables"]["milestones"]["Row"];
export type MilestoneItem = Row & { progress: Progress; status: MilestoneStatus };
export type LinkedTask = { id: string; title: string; status_id: string; done: boolean };

/** All project members, including stakeholders, may read milestones and their progress. */
export const listMilestones = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MilestoneItem[]> => {
    const { supabase, userId } = context;
    const { projectId } = await projectAccess(supabase, userId);
    const [m, t, s] = await Promise.all([
      supabase.from("milestones").select("*").eq("project_id", projectId).order("target_date").order("created_at"),
      supabase.from("tasks").select("milestone_id, status_id").eq("project_id", projectId).not("milestone_id", "is", null).limit(10000),
      supabase.from("workflow_statuses").select("id, category").eq("project_id", projectId),
    ]);
    if (m.error) fail("load the milestones", m.error);
    const cat = new Map((s.data ?? []).map((x) => [x.id, x.category as string]));
    const byMs = new Map<string, string[]>();
    for (const r of t.data ?? []) {
      const list = byMs.get(r.milestone_id!) ?? [];
      list.push(cat.get(r.status_id) ?? "todo");
      byMs.set(r.milestone_id!, list);
    }
    return (m.data ?? []).map((row) => {
      const progress = milestoneProgress(byMs.get(row.id) ?? []);
      return { ...row, progress, status: milestoneStatus({ targetDate: row.target_date, progress, override: row.status_override }) };
    });
  });

export const listMilestoneTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => byId.parse(i))
  .handler(async ({ data, context }): Promise<LinkedTask[]> => {
    const { supabase, userId } = context;
    const { projectId } = await projectAccess(supabase, userId);
    const [t, s] = await Promise.all([
      supabase.from("tasks").select("id, title, status_id").eq("project_id", projectId).eq("milestone_id", data.id).order("position"),
      supabase.from("workflow_statuses").select("id, category").eq("project_id", projectId),
    ]);
    if (t.error) fail("load the linked items", t.error);
    const done = new Set((s.data ?? []).filter((x) => x.category === "done").map((x) => x.id));
    return (t.data ?? []).map((r) => ({ ...r, done: done.has(r.status_id) }));
  });

async function checkOwner(supabase: Parameters<typeof requireWriter>[0], projectId: string, ownerId: string | null | undefined) {
  if (!ownerId) return;
  const { data } = await supabase.from("project_members").select("user_id").eq("project_id", projectId).eq("active", true).eq("user_id", ownerId).maybeSingle();
  if (!data) throw new Error("That person is not on this project.");
}

export const createMilestone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => milestoneCreate.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { projectId, role } = await projectAccess(supabase, userId);
    assertCanWriteMilestone(role, { touchesOverride: !!data.status_override });
    await checkOwner(supabase, projectId, data.owner_id);
    const { data: row, error } = await supabase.from("milestones").insert({
      project_id: projectId, name: data.name, description: data.description ?? null, target_date: data.target_date,
      owner_id: data.owner_id ?? null, status_override: data.status_override ?? null,
    }).select("*").single();
    if (error || !row) fail("add the milestone", error);
    return row;
  });

export const updateMilestone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => milestoneUpdate.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { projectId, role } = await projectAccess(supabase, userId);
    const { id, ...rest } = data;
    assertCanWriteMilestone(role, { touchesOverride: rest.status_override !== undefined });
    await checkOwner(supabase, projectId, rest.owner_id);
    const { error } = await supabase.from("milestones").update(clean(rest)).eq("id", id).eq("project_id", projectId);
    if (error) fail("save the milestone", error);
    return { ok: true };
  });

/** Linked tasks stay; they just lose the link. */
export const deleteMilestone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => byId.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { projectId, role } = await projectAccess(supabase, userId);
    assertCanWriteMilestone(role);
    const { error } = await supabase.from("milestones").delete().eq("id", data.id).eq("project_id", projectId);
    if (error) fail("delete the milestone", error);
    return { ok: true };
  });

export const linkTasksToMilestone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => milestoneLink.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const projectId = await requireWriter(supabase, userId);
    const { error } = await supabase.from("tasks").update({ milestone_id: data.milestoneId })
      .in("id", data.taskIds).eq("project_id", projectId);
    if (error) fail("link the items", error);
    return { ok: true };
  });

export const unlinkTaskFromMilestone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => milestoneUnlink.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const projectId = await requireWriter(supabase, userId);
    const { error } = await supabase.from("tasks").update({ milestone_id: null }).eq("id", data.taskId).eq("project_id", projectId);
    if (error) fail("unlink the item", error);
    return { ok: true };
  });
