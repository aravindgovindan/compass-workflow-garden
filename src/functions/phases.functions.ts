import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { byId, phaseInput, phaseReorder, phaseUpdate } from "@/lib/schemas/tasks";
import { clean, fail, requireTaskReader, requireWriter } from "@/lib/project-access.server";

// Changes are written to activity_log by the log_activity() trigger.
export type Phase = Database["public"]["Tables"]["phases"]["Row"];

export const listPhases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Phase[]> => {
    const projectId = await requireTaskReader(context.supabase, context.userId);
    const { data, error } = await context.supabase.from("phases").select("*").eq("project_id", projectId).order("position").order("created_at");
    if (error) fail("load the phases", error);
    return data ?? [];
  });

export const createPhase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => phaseInput.parse(i))
  .handler(async ({ data, context }) => {
    const projectId = await requireWriter(context.supabase, context.userId);
    const { count } = await context.supabase.from("phases").select("id", { count: "exact", head: true }).eq("project_id", projectId);
    const { data: row, error } = await context.supabase.from("phases")
      .insert({ project_id: projectId, name: data.name, description: data.description ?? null, start_date: data.start_date ?? null, end_date: data.end_date ?? null, position: count ?? 0 })
      .select("*").single();
    if (error || !row) fail("add the phase", error);
    return row;
  });

export const updatePhase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => phaseUpdate.parse(i))
  .handler(async ({ data, context }) => {
    const projectId = await requireWriter(context.supabase, context.userId);
    const { id, ...rest } = data;
    const { data: cur } = await context.supabase.from("phases").select("start_date, end_date").eq("id", id).eq("project_id", projectId).maybeSingle();
    if (!cur) throw new Error("That phase no longer exists.");
    const s = rest.start_date !== undefined ? rest.start_date : cur.start_date;
    const e = rest.end_date !== undefined ? rest.end_date : cur.end_date;
    if (s && e && e < s) throw new Error("End date must be on or after the start date.");
    const { error } = await context.supabase.from("phases").update(clean(rest)).eq("id", id).eq("project_id", projectId);
    if (error) fail("save the phase", error);
    return { ok: true };
  });

export const reorderPhases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => phaseReorder.parse(i))
  .handler(async ({ data, context }) => {
    const projectId = await requireWriter(context.supabase, context.userId);
    const results = await Promise.all(
      data.ids.map((id, position) => context.supabase.from("phases").update({ position }).eq("id", id).eq("project_id", projectId)),
    );
    const err = results.find((r) => r.error)?.error ?? null;
    if (err) fail("reorder the phases", err);
    return { ok: true };
  });

/** Tasks in a deleted phase stay, with no phase. */
export const deletePhase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => byId.parse(i))
  .handler(async ({ data, context }) => {
    const projectId = await requireWriter(context.supabase, context.userId);
    const { error } = await context.supabase.from("phases").delete().eq("id", data.id).eq("project_id", projectId);
    if (error) fail("delete the phase", error);
    return { ok: true };
  });
