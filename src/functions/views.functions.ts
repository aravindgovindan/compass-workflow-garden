import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { byId, savedViewInput, savedViewRename, viewPrefsInput } from "@/lib/schemas/tasks";
import { fail, requireTaskReader } from "@/lib/project-access.server";
import { assertOwnView } from "@/lib/tasks/views";

// Saved views are private: every query filters by the caller's user id, and RLS enforces the same.
// Create/rename/delete are written to activity_log by the log_activity() trigger.

export type SavedView = { id: string; name: string; view_type: "list" | "board"; filters: Record<string, unknown>; updated_at: string };
export type ViewPrefs = { view_mode: "list" | "board"; list_columns: string[] };

export const listSavedViews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SavedView[]> => {
    const { supabase, userId } = context;
    const projectId = await requireTaskReader(supabase, userId);
    const { data, error } = await supabase.from("saved_views").select("id, name, view_type, filters, updated_at")
      .eq("project_id", projectId).eq("user_id", userId).order("name");
    if (error) fail("load saved views", error);
    return (data ?? []).map((v) => ({ ...v, view_type: v.view_type === "board" ? "board" : "list", filters: (v.filters ?? {}) as Record<string, unknown> }));
  });

export const saveView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => savedViewInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const projectId = await requireTaskReader(supabase, userId);
    const { data: row, error } = await supabase.from("saved_views")
      .upsert({ project_id: projectId, user_id: userId, name: data.name, view_type: data.view_type, filters: data.filters as Json },
        { onConflict: "project_id,user_id,name" })
      .select("id").single();
    if (error || !row) fail("save the view", error);
    return row;
  });

async function ownView(supabase: Parameters<typeof requireTaskReader>[0], userId: string, id: string) {
  const projectId = await requireTaskReader(supabase, userId);
  const { data } = await supabase.from("saved_views").select("id, user_id").eq("id", id).eq("project_id", projectId).maybeSingle();
  assertOwnView(data, userId);
  return projectId;
}

export const renameView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => savedViewRename.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ownView(supabase, userId, data.id);
    const { error } = await supabase.from("saved_views").update({ name: data.name }).eq("id", data.id).eq("user_id", userId);
    if (error) {
      if (error.code === "23505") throw new Error("You already have a view with that name.");
      fail("rename the view", error);
    }
    return { ok: true };
  });

export const deleteView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => byId.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ownView(supabase, userId, data.id);
    const { error } = await supabase.from("saved_views").delete().eq("id", data.id).eq("user_id", userId);
    if (error) fail("delete the view", error);
    return { ok: true };
  });

export const getViewPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ViewPrefs> => {
    const { supabase, userId } = context;
    const projectId = await requireTaskReader(supabase, userId);
    const { data } = await supabase.from("user_view_prefs").select("view_mode, list_columns")
      .eq("project_id", projectId).eq("user_id", userId).maybeSingle();
    return {
      view_mode: data?.view_mode === "board" ? "board" : "list",
      list_columns: Array.isArray(data?.list_columns) ? (data.list_columns as unknown[]).map(String) : [],
    };
  });

export const setViewPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => viewPrefsInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const projectId = await requireTaskReader(supabase, userId);
    const patch: { view_mode?: string; list_columns?: Json } = {};
    if (data.view_mode) patch.view_mode = data.view_mode;
    if (data.list_columns) patch.list_columns = data.list_columns;
    const { error } = await supabase.from("user_view_prefs")
      .upsert({ project_id: projectId, user_id: userId, ...patch }, { onConflict: "project_id,user_id" });
    if (error) fail("save your view settings", error);
    return { ok: true };
  });
