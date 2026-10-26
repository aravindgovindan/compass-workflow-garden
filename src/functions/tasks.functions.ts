import { fetchAll, filteredTasks } from "@/lib/exports/task-list.server";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  byId, checklistAdd, checklistReorder, checklistUpdate, taskCreate, taskDelete, taskLabelsSet, taskList, taskMove, taskUpdate,
} from "@/lib/schemas/tasks";
import { checkSubtaskParent, mergeCustomFields } from "@/lib/tasks/rules";
import type { CustomFieldDef, CustomFieldType, CustomValues } from "@/lib/custom-fields/types";
import { clean, fail, requireTaskReader, requireWriter, type Db } from "@/lib/project-access.server";

// Every create/update/delete below is written to activity_log (old and new values) by the log_activity() trigger.

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
export type TaskListItem = TaskRow & { label_ids: string[]; subtask_count: number; checklist_total: number; checklist_done: number };
export type ChecklistItem = Database["public"]["Tables"]["task_checklist_items"]["Row"];
export type TaskDetail = TaskRow & { label_ids: string[]; subtasks: TaskRow[]; checklist: ChecklistItem[]; parent: { id: string; title: string } | null };

async function taskDefs(supabase: Db, projectId: string): Promise<CustomFieldDef[]> {
  const { data } = await supabase.from("custom_field_defs").select("*").eq("project_id", projectId).eq("entity_type", "task");
  return (data ?? []).map((d) => ({
    id: d.id, key: d.key, name: d.name, type: d.type as CustomFieldType, required: d.required, archived: d.archived,
    options: Array.isArray(d.options) ? (d.options as unknown[]).map(String) : [],
  }));
}

async function memberIds(supabase: Db, projectId: string): Promise<string[]> {
  const { data } = await supabase.from("project_members").select("user_id").eq("project_id", projectId).eq("active", true);
  return (data ?? []).map((m) => m.user_id);
}

async function loadTask(supabase: Db, projectId: string, id: string): Promise<TaskRow> {
  const { data, error } = await supabase.from("tasks").select("*").eq("id", id).eq("project_id", projectId).maybeSingle();
  if (error) fail("load the task", error);
  if (!data) throw new Error("That item no longer exists.");
  return data;
}

async function nextPosition(supabase: Db, projectId: string, statusId: string): Promise<number> {
  const { data } = await supabase.from("tasks").select("position").eq("project_id", projectId).eq("status_id", statusId)
    .order("position", { ascending: false }).limit(1).maybeSingle();
  return (data?.position ?? -1) + 1;
}

export const listTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => taskList.parse(i ?? {}))
  .handler(async ({ data, context }): Promise<{ rows: TaskListItem[]; total: number }> => {
    const { supabase, userId } = context;
    const projectId = await requireTaskReader(supabase, userId);
    const {rows,total}=await filteredTasks(supabase,projectId,data,data.pageSize);
    // Counts are fetched project-wide (two small queries) instead of with huge id lists.
    const [subs, checks] = rows.length
      ? await Promise.all([
          fetchAll((f, t) => supabase.from("tasks").select("parent_task_id").eq("project_id", projectId).not("parent_task_id", "is", null).range(f, t), 20000),
          fetchAll((f, t) => supabase.from("task_checklist_items").select("task_id, done").eq("project_id", projectId).range(f, t), 50000),
        ])
      : [{ rows: [] as { parent_task_id: string | null }[] }, { rows: [] as { task_id: string; done: boolean }[] }];
    const subCount = new Map<string, number>();
    for (const s of subs.rows) if (s.parent_task_id) subCount.set(s.parent_task_id, (subCount.get(s.parent_task_id) ?? 0) + 1);
    const chk = new Map<string, { t: number; d: number }>();
    for (const c of checks.rows) {
      const e = chk.get(c.task_id) ?? { t: 0, d: 0 };
      e.t++; if (c.done) e.d++;
      chk.set(c.task_id, e);
    }
    return {
      total: data.labelIds?.length ? rows.length : total,
      rows: rows.map((r) => ({
        ...r,
        label_ids: r.label_ids,
        subtask_count: subCount.get(r.id) ?? 0,
        checklist_total: chk.get(r.id)?.t ?? 0,
        checklist_done: chk.get(r.id)?.d ?? 0,
      })),
    };
  });

export const getTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => byId.parse(i))
  .handler(async ({ data, context }): Promise<TaskDetail> => {
    const { supabase, userId } = context;
    const projectId = await requireTaskReader(supabase, userId);
    const task = await loadTask(supabase, projectId, data.id);
    const [labels, subtasks, checklist, parent] = await Promise.all([
      supabase.from("task_labels").select("label_id").eq("task_id", task.id),
      supabase.from("tasks").select("*").eq("parent_task_id", task.id).order("position").order("created_at"),
      supabase.from("task_checklist_items").select("*").eq("task_id", task.id).order("position").order("created_at"),
      task.parent_task_id
        ? supabase.from("tasks").select("id, title").eq("id", task.parent_task_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    return {
      ...task,
      label_ids: (labels.data ?? []).map((l) => l.label_id),
      subtasks: subtasks.data ?? [],
      checklist: checklist.data ?? [],
      parent: parent.data ?? null,
    };
  });

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => taskCreate.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const projectId = await requireWriter(supabase, userId);
    if (data.parent_task_id) {
      const parent = await loadTask(supabase, projectId, data.parent_task_id);
      const problem = checkSubtaskParent(parent);
      if (problem) throw new Error(problem);
    }
    let statusId = data.status_id ?? null;
    if (!statusId) {
      const { data: s } = await supabase.from("workflow_statuses").select("id").eq("project_id", projectId)
        .order("is_default", { ascending: false }).order("position").limit(1).maybeSingle();
      if (!s) throw new Error("Add a workflow status in Settings first.");
      statusId = s.id;
    }
    let priorityId = data.priority_id ?? null;
    if (data.priority_id === undefined) {
      // No default flag on priorities: the first priority in the configured order is the default.
      const { data: p } = await supabase.from("priorities").select("id").eq("project_id", projectId).order("position").limit(1).maybeSingle();
      priorityId = p?.id ?? null;
    }
    // Required custom fields fall back to configured defaults; others start empty.
    const defs = await taskDefs(supabase, projectId);
    const defaults: CustomValues = {};
    const { data: rawDefs } = await supabase.from("custom_field_defs").select("key, default_value")
      .eq("project_id", projectId).eq("entity_type", "task").eq("archived", false);
    for (const d of rawDefs ?? []) if (d.default_value !== null) defaults[d.key] = d.default_value;
    const live = defs.filter((d) => !d.archived);
    const custom = mergeCustomFields(live.map((d) => ({ ...d, required: false })), {}, defaults, await memberIds(supabase, projectId));
    const { data: row, error } = await supabase.from("tasks").insert({
      project_id: projectId,
      title: data.title,
      parent_task_id: data.parent_task_id ?? null,
      phase_id: data.phase_id ?? null,
      status_id: statusId,
      priority_id: priorityId,
      reporter_id: userId,
      position: await nextPosition(supabase, projectId, statusId),
      custom_fields: custom as Json,
    }).select("*").single();
    if (error || !row) fail("add the item", error);
    return row;
  });

export const updateTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => taskUpdate.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const projectId = await requireWriter(supabase, userId);
    const current = await loadTask(supabase, projectId, data.id);
    const { id, custom_fields, ...rest } = data;
    const patch: Database["public"]["Tables"]["tasks"]["Update"] = clean(rest);

    const start = rest.start_date !== undefined ? rest.start_date : current.start_date;
    const due = rest.due_date !== undefined ? rest.due_date : current.due_date;
    if (start && due && due < start) throw new Error("Due date must be on or after the start date.");

    const needMembers = rest.assignee_id || rest.reporter_id || custom_fields;
    const members = needMembers ? await memberIds(supabase, projectId) : [];
    for (const uid of [rest.assignee_id, rest.reporter_id]) {
      if (uid && !members.includes(uid)) throw new Error("That person is not on this project.");
    }
    if (rest.parent_task_id) {
      const parent = await loadTask(supabase, projectId, rest.parent_task_id);
      const { count } = await supabase.from("tasks").select("id", { count: "exact", head: true }).eq("parent_task_id", id);
      const problem = checkSubtaskParent(parent, { taskId: id, taskHasChildren: (count ?? 0) > 0 });
      if (problem) throw new Error(problem);
    }
    if (custom_fields) {
      const stored = (current.custom_fields ?? {}) as CustomValues;
      patch.custom_fields = mergeCustomFields(await taskDefs(supabase, projectId), stored, custom_fields, members) as Json;
    }
    if (rest.status_id && rest.status_id !== current.status_id) {
      patch.position = await nextPosition(supabase, projectId, rest.status_id);
    }
    if (Object.keys(patch).length === 0) return current;
    const { data: row, error } = await supabase.from("tasks").update(patch).eq("id", id).eq("project_id", projectId).select("*").single();
    if (error || !row) fail("save the change", error);
    return row;
  });

export const moveTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => taskMove.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const projectId = await requireWriter(supabase, userId);
    const { data: row, error } = await supabase.from("tasks")
      .update({ status_id: data.status_id, position: data.position })
      .eq("id", data.id).eq("project_id", projectId).select("*").single();
    if (error || !row) fail("move the item", error);
    return row;
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => taskDelete.parse(i))
  .handler(async ({ data, context }): Promise<{ deleted: boolean; subtaskCount: number }> => {
    const { supabase, userId } = context;
    const projectId = await requireWriter(supabase, userId);
    await loadTask(supabase, projectId, data.id);
    const { count } = await supabase.from("tasks").select("id", { count: "exact", head: true }).eq("parent_task_id", data.id);
    const subtaskCount = count ?? 0;
    if (subtaskCount > 0 && !data.confirmSubtasks) return { deleted: false, subtaskCount };
    // Delete sub-tasks first so each one gets its own activity entry, then the task (labels/checklist cascade).
    if (subtaskCount > 0) {
      const { error: e } = await supabase.from("tasks").delete().eq("parent_task_id", data.id).eq("project_id", projectId);
      if (e) fail("delete the sub-items", e);
    }
    const { error } = await supabase.from("tasks").delete().eq("id", data.id).eq("project_id", projectId);
    if (error) fail("delete the item", error);
    return { deleted: true, subtaskCount };
  });

export const setTaskLabels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => taskLabelsSet.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const projectId = await requireWriter(supabase, userId);
    await loadTask(supabase, projectId, data.id);
    const { data: existing } = await supabase.from("task_labels").select("label_id").eq("task_id", data.id);
    const have = new Set((existing ?? []).map((l) => l.label_id));
    const want = new Set(data.labelIds);
    const add = [...want].filter((l) => !have.has(l));
    const remove = [...have].filter((l) => !want.has(l));
    if (remove.length) {
      const { error } = await supabase.from("task_labels").delete().eq("task_id", data.id).in("label_id", remove);
      if (error) fail("update the labels", error);
    }
    if (add.length) {
      const { error } = await supabase.from("task_labels").insert(add.map((label_id) => ({ project_id: projectId, task_id: data.id, label_id })));
      if (error) fail("update the labels", error);
    }
    return { ok: true };
  });

// ---------- Checklist ----------
export const addChecklistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => checklistAdd.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const projectId = await requireWriter(supabase, userId);
    const { count } = await supabase.from("task_checklist_items").select("id", { count: "exact", head: true }).eq("task_id", data.taskId);
    const { data: row, error } = await supabase.from("task_checklist_items")
      .insert({ project_id: projectId, task_id: data.taskId, text: data.text, position: count ?? 0 }).select("*").single();
    if (error || !row) fail("add the checklist item", error);
    return row;
  });

export const updateChecklistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => checklistUpdate.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const projectId = await requireWriter(supabase, userId);
    const { id, ...rest } = data;
    const { error } = await supabase.from("task_checklist_items").update(clean(rest)).eq("id", id).eq("project_id", projectId);
    if (error) fail("update the checklist item", error);
    return { ok: true };
  });

export const reorderChecklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => checklistReorder.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const projectId = await requireWriter(supabase, userId);
    const results = await Promise.all(
      data.ids.map((id, position) =>
        supabase.from("task_checklist_items").update({ position }).eq("id", id).eq("task_id", data.taskId).eq("project_id", projectId)),
    );
    const err = results.find((r) => r.error)?.error ?? null;
    if (err) fail("reorder the checklist", err);
    return { ok: true };
  });

export const deleteChecklistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => byId.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const projectId = await requireWriter(supabase, userId);
    const { error } = await supabase.from("task_checklist_items").delete().eq("id", data.id).eq("project_id", projectId);
    if (error) fail("delete the checklist item", error);
    return { ok: true };
  });
