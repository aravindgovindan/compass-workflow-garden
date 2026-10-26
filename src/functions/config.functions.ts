import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  customFieldCreate,
  customFieldUpdate,
  deleteById,
  labelInput,
  labelUpdate,
  priorityInput,
  priorityUpdate,
  reorderInput,
  statusDelete,
  statusInput,
  statusUpdate,
  terminologyInput,
} from "@/lib/schemas/config";
import { checkStatusDeletion, nextDefaultStatus } from "@/lib/config/status-rules";
import { toTermMap, type TermMap } from "@/lib/terminology/defaults";
import type { CustomFieldType } from "@/lib/custom-fields/types";

// Every change below is written to activity_log by the log_activity() trigger on each table.

type Db = SupabaseClient<Database>;

/** Drop undefined keys (partial updates; required by exactOptionalPropertyTypes). */
function clean<T extends object>(o: T): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as never;
}

async function currentProjectId(supabase: Db, userId: string): Promise<string> {
  const { data } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", userId)
    .eq("active", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!data) throw new Error("You are not on a project yet.");
  return data.project_id;
}

/** Server-side owner check; RLS re-checks every write as well. */
async function requireOwner(supabase: Db, userId: string): Promise<string> {
  const projectId = await currentProjectId(supabase, userId);
  const { data, error } = await supabase.rpc("has_project_role", {
    _project_id: projectId,
    _user_id: userId,
    _roles: ["owner"],
  });
  if (error || !data) throw new Error("Only the project owner can change settings.");
  return projectId;
}

function fail(what: string, error: { code?: string; message?: string } | null): never {
  console.error(what, error);
  if (error?.code === "23505") throw new Error("That name is already used.");
  throw new Error(`Could not ${what}. Please try again.`);
}

/** Records that reference a status. Risks and issues arrive in later steps. */
async function countStatusUsage(supabase: Db, statusId: string): Promise<number> {
  const { count } = await supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status_id", statusId);
  return count ?? 0;
}

export type ProjectConfig = {
  projectId: string;
  terms: TermMap;
  terminology: Database["public"]["Tables"]["terminology"]["Row"][];
  statuses: Database["public"]["Tables"]["workflow_statuses"]["Row"][];
  priorities: Database["public"]["Tables"]["priorities"]["Row"][];
  labels: Database["public"]["Tables"]["labels"]["Row"][];
  customFields: (Omit<Database["public"]["Tables"]["custom_field_defs"]["Row"], "options" | "type"> & {
    options: string[];
    type: CustomFieldType;
  })[];
  members: { user_id: string; full_name: string }[];
};

/** Full configuration for the current project (any member can read). */
export const getProjectConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProjectConfig> => {
    const { supabase, userId } = context;
    const projectId = await currentProjectId(supabase, userId);
    const [t, s, p, l, f, m] = await Promise.all([
      supabase.from("terminology").select("*").eq("project_id", projectId),
      supabase.from("workflow_statuses").select("*").eq("project_id", projectId).order("position"),
      supabase.from("priorities").select("*").eq("project_id", projectId).order("position"),
      supabase.from("labels").select("*").eq("project_id", projectId).order("name"),
      supabase.from("custom_field_defs").select("*").eq("project_id", projectId).order("position"),
      supabase.from("project_members").select("user_id").eq("project_id", projectId).eq("active", true),
    ]);
    const err = t.error || s.error || p.error || l.error || f.error || m.error;
    if (err) fail("load the project settings", err);
    const ids = (m.data ?? []).map((x) => x.user_id);
    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("id, full_name, email").in("id", ids)
      : { data: [] };
    return {
      projectId,
      terms: toTermMap(t.data ?? []),
      terminology: t.data ?? [],
      statuses: s.data ?? [],
      priorities: p.data ?? [],
      labels: l.data ?? [],
      customFields: (f.data ?? []).map((d) => ({
        ...d,
        type: d.type as CustomFieldType,
        options: Array.isArray(d.options) ? (d.options as unknown[]).map(String) : [],
      })),
      members: (profiles ?? []).map((pr) => ({ user_id: pr.id, full_name: pr.full_name || pr.email || "Unnamed" })),
    };
  });

// ---------- Workflow statuses ----------
export const createStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => statusInput.parse(i))
  .handler(async ({ data, context }) => {
    const projectId = await requireOwner(context.supabase, context.userId);
    const { count } = await context.supabase
      .from("workflow_statuses").select("id", { count: "exact", head: true }).eq("project_id", projectId);
    const { error } = await context.supabase
      .from("workflow_statuses").insert({ ...data, project_id: projectId, position: count ?? 0 });
    if (error) fail("add the status", error);
    return { ok: true };
  });

export const updateStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => statusUpdate.parse(i))
  .handler(async ({ data, context }) => {
    const projectId = await requireOwner(context.supabase, context.userId);
    const { id, is_default, ...patch } = data;
    if (is_default) {
      // Clear the old default first: only one default per project is allowed.
      const { error } = await context.supabase
        .from("workflow_statuses").update({ is_default: false })
        .eq("project_id", projectId).eq("is_default", true).neq("id", id);
      if (error) fail("change the default status", error);
    }
    const { error } = await context.supabase
      .from("workflow_statuses").update({ ...clean(patch), ...(is_default ? { is_default: true } : {}) })
      .eq("id", id).eq("project_id", projectId);
    if (error) fail("update the status", error);
    return { ok: true };
  });

export const deleteStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => statusDelete.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const projectId = await requireOwner(supabase, userId);
    const { data: statuses, error: e1 } = await supabase
      .from("workflow_statuses").select("id, is_default").eq("project_id", projectId).order("position");
    if (e1) fail("delete the status", e1);
    const usage = await countStatusUsage(supabase, data.id);
    const problem = checkStatusDeletion(statuses ?? [], data.id, usage, data.replacementId);
    if (problem) throw new Error(problem);
    if (usage > 0 && data.replacementId) {
      const { error: e2 } = await supabase.from("tasks").update({ status_id: data.replacementId })
        .eq("status_id", data.id).eq("project_id", projectId);
      if (e2) fail("move items to the replacement status", e2);
    }
    const nextDefault = nextDefaultStatus(statuses ?? [], data.id);
    const { error } = await supabase.from("workflow_statuses").delete().eq("id", data.id).eq("project_id", projectId);
    if (error) fail("delete the status", error);
    if (nextDefault) await supabase.from("workflow_statuses").update({ is_default: true }).eq("id", nextDefault);
    return { ok: true };
  });

// ---------- Priorities ----------
export const createPriority = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => priorityInput.parse(i))
  .handler(async ({ data, context }) => {
    const projectId = await requireOwner(context.supabase, context.userId);
    const { count } = await context.supabase
      .from("priorities").select("id", { count: "exact", head: true }).eq("project_id", projectId);
    const { error } = await context.supabase.from("priorities").insert({ ...data, project_id: projectId, position: count ?? 0 });
    if (error) fail("add the priority", error);
    return { ok: true };
  });

export const updatePriority = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => priorityUpdate.parse(i))
  .handler(async ({ data, context }) => {
    const projectId = await requireOwner(context.supabase, context.userId);
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("priorities").update(clean(patch)).eq("id", id).eq("project_id", projectId);
    if (error) fail("update the priority", error);
    return { ok: true };
  });

export const deletePriority = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => deleteById.parse(i))
  .handler(async ({ data, context }) => {
    const projectId = await requireOwner(context.supabase, context.userId);
    const { error } = await context.supabase.from("priorities").delete().eq("id", data.id).eq("project_id", projectId);
    if (error) fail("delete the priority", error);
    return { ok: true };
  });

// ---------- Labels ----------
export const createLabel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => labelInput.parse(i))
  .handler(async ({ data, context }) => {
    const projectId = await requireOwner(context.supabase, context.userId);
    const { error } = await context.supabase.from("labels").insert({ ...data, project_id: projectId });
    if (error) fail("add the label", error);
    return { ok: true };
  });

export const updateLabel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => labelUpdate.parse(i))
  .handler(async ({ data, context }) => {
    const projectId = await requireOwner(context.supabase, context.userId);
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("labels").update(clean(patch)).eq("id", id).eq("project_id", projectId);
    if (error) fail("update the label", error);
    return { ok: true };
  });

export const deleteLabel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => deleteById.parse(i))
  .handler(async ({ data, context }) => {
    const projectId = await requireOwner(context.supabase, context.userId);
    const { error } = await context.supabase.from("labels").delete().eq("id", data.id).eq("project_id", projectId);
    if (error) fail("delete the label", error);
    return { ok: true };
  });

// ---------- Reorder (statuses, priorities, custom fields) ----------
export const reorderConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => reorderInput.parse(i))
  .handler(async ({ data, context }) => {
    const projectId = await requireOwner(context.supabase, context.userId);
    const table = ({ status: "workflow_statuses", priority: "priorities", custom_field: "custom_field_defs" } as const)[data.kind];
    const results = await Promise.all(
      data.ids.map((id, position) =>
        context.supabase.from(table).update({ position }).eq("id", id).eq("project_id", projectId),
      ),
    );
    const err = results.find((r) => r.error)?.error;
    if (err) fail("save the new order", err);
    return { ok: true };
  });

// ---------- Terminology ----------
export const saveTerminology = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => terminologyInput.parse(i))
  .handler(async ({ data, context }) => {
    const projectId = await requireOwner(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("terminology")
      .upsert(data.terms.map((t) => ({ ...t, project_id: projectId })), { onConflict: "project_id,key" });
    if (error) fail("save the terminology", error);
    return { ok: true };
  });

// ---------- Custom field definitions (archived, never deleted) ----------
export const createCustomField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => customFieldCreate.parse(i))
  .handler(async ({ data, context }) => {
    const projectId = await requireOwner(context.supabase, context.userId);
    const { count } = await context.supabase
      .from("custom_field_defs").select("id", { count: "exact", head: true })
      .eq("project_id", projectId).eq("entity_type", data.entity_type);
    const { default_value, ...rest } = data;
    const { error } = await context.supabase.from("custom_field_defs").insert({
      ...clean(rest),
      entity_type: rest.entity_type, key: rest.key, name: rest.name, type: rest.type,
      default_value: (default_value ?? null) as Json,
      project_id: projectId,
      position: count ?? 0,
    });
    if (error) fail("add the field", error.code === "23505" ? { ...error, message: "key" } : error);
    return { ok: true };
  });

export const updateCustomField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => customFieldUpdate.parse(i))
  .handler(async ({ data, context }) => {
    const projectId = await requireOwner(context.supabase, context.userId);
    const { id, default_value, ...patch } = data;
    const { error } = await context.supabase
      .from("custom_field_defs")
      .update({
        ...clean(patch),
        ...(default_value !== undefined
          ? { default_value: (default_value ?? null) as Json }
          : {}),
      })
      .eq("id", id)
      .eq("project_id", projectId);
    if (error) fail("update the field", error);
    return { ok: true };
  });
