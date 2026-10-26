import { queryOptions, useIsMutating, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { z } from "zod";
import type { phaseInput, phaseUpdate, taskCreate, taskUpdate } from "@/lib/schemas/tasks";
import {
  addChecklistItem, createTask, deleteChecklistItem, deleteTask, getTask, listTasks, moveTask,
  reorderChecklist, setTaskLabels, updateChecklistItem, updateTask, type TaskDetail, type TaskListItem,
} from "@/functions/tasks.functions";
import { createPhase, deletePhase, listPhases, reorderPhases, updatePhase, type Phase } from "@/functions/phases.functions";
import { applyMove } from "./board";
import type { TaskFilters } from "./view-params";
import { friendlyError } from "@/lib/errors";

type ListData = { rows: TaskListItem[]; total: number };
type UpdateInput = z.input<typeof taskUpdate>;

const LIST_KEY = ["tasks", "list"] as const;

/** One cached list per filter combination; all of them are patched optimistically. */
export const tasksListQuery = (f: TaskFilters) =>
  queryOptions({
    queryKey: [...LIST_KEY, f],
    queryFn: () => listTasks({ data: {
      topLevelOnly: true, sort: "position", search: f.q || undefined,
      statusIds: f.status, priorityIds: f.priority, assigneeIds: f.assignee, phaseIds: f.phase, milestoneIds: f.milestone, labelIds: f.label,
      dueFrom: f.dueFrom, dueTo: f.dueTo, overdue: f.overdue, cf: f.cf,
    } }),
    placeholderData: (prev) => prev,
  });
export const taskDetailQuery = (id: string) =>
  queryOptions({ queryKey: ["tasks", "detail", id], queryFn: () => getTask({ data: { id } }) });
export const phasesQuery = queryOptions({ queryKey: ["phases"], queryFn: () => listPhases() });

const errMsg = friendlyError;
const refreshTasks = (qc: QueryClient) =>
  Promise.all([qc.invalidateQueries({ queryKey: ["tasks"] }), qc.invalidateQueries({ queryKey: ["milestones"] })]);

type Snapshot = [readonly unknown[], ListData | undefined][];
async function patchLists(qc: QueryClient, fn: (d: ListData) => ListData): Promise<Snapshot> {
  await qc.cancelQueries({ queryKey: LIST_KEY });
  const snap = qc.getQueriesData<ListData>({ queryKey: LIST_KEY });
  qc.setQueriesData<ListData>({ queryKey: LIST_KEY }, (d) => (d ? fn(d) : d));
  return snap;
}
const restore = (qc: QueryClient, snap?: Snapshot) => snap?.forEach(([k, d]) => qc.setQueryData(k, d));

/** Visible "Saving…" state for one task. */
export function useTaskSaving(id: string) {
  return useIsMutating({ mutationKey: ["task-save", id] }) > 0;
}

/** Partial update with optimistic cache patch and rollback on error. */
export function useUpdateTask(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["task-save", id],
    mutationFn: (patch: Omit<UpdateInput, "id">) => updateTask({ data: { id, ...patch } }),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const detail = qc.getQueryData<TaskDetail>(taskDetailQuery(id).queryKey);
      const apply = <T extends { custom_fields: unknown }>(t: T): T => ({
        ...t, ...patch,
        custom_fields: patch["custom_fields"] ? { ...(t.custom_fields as object), ...patch["custom_fields"] } : t.custom_fields,
      });
      const lists = await patchLists(qc, (l) => ({ ...l, rows: l.rows.map((r) => (r.id === id ? apply(r) : r)) }));
      if (detail) qc.setQueryData<TaskDetail>(taskDetailQuery(id).queryKey, apply(detail));
      return { lists, detail };
    },
    onError: (e, _v, ctx) => {
      restore(qc, ctx?.lists);
      if (ctx?.detail) qc.setQueryData(taskDetailQuery(id).queryKey, ctx.detail);
      toast.error(errMsg(e));
    },
    onSettled: () => refreshTasks(qc),
  });
}

/** Quick add: optimistic row at the end of its group, rolled back on error. */
export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: z.input<typeof taskCreate>) => createTask({ data: input }),
    onMutate: async (input) => {
      if (input.parent_task_id) return { lists: undefined };
      const now = new Date().toISOString();
      const temp: TaskListItem = {
        id: `temp-${crypto.randomUUID()}`, project_id: "", title: input.title, description: null, parent_task_id: null, milestone_id: null,
        phase_id: input.phase_id ?? null, status_id: input.status_id ?? "", priority_id: input.priority_id ?? null,
        assignee_id: null, reporter_id: null, start_date: null, due_date: null, estimate_hours: null,
        position: Number.MAX_SAFE_INTEGER, custom_fields: {}, completed_at: null, created_at: now, updated_at: now,
        label_ids: [], subtask_count: 0, checklist_total: 0, checklist_done: 0,
      };
      const lists = await patchLists(qc, (l) => ({ rows: [...l.rows, temp], total: l.total + 1 }));
      return { lists };
    },
    onError: (e, _v, ctx) => {
      restore(qc, ctx?.lists);
      toast.error(errMsg(e));
    },
    onSettled: () => refreshTasks(qc),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; confirmSubtasks?: boolean }) =>
      deleteTask({ data: { id: input.id, confirmSubtasks: input.confirmSubtasks ?? false } }),
    onError: (e) => toast.error(errMsg(e)),
    onSuccess: async (r) => { if (r.deleted) await refreshTasks(qc); },
  });
}

/** Board drag: optimistic status/position change on every cached list, rollback on error. */
export function useMoveTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; status_id: string; position: number }) => moveTask({ data: input }),
    onMutate: async (i) => ({ lists: await patchLists(qc, (l) => ({ ...l, rows: applyMove(l.rows, i.id, i.status_id, i.position) })) }),
    onError: (e, _i, ctx) => {
      restore(qc, ctx?.lists);
      toast.error(errMsg(e));
    },
    onSettled: () => refreshTasks(qc),
  });
}

/** Simple task-scoped mutation that shows the task's saving state and refreshes on finish. */
function useTaskAction<I>(taskId: string, fn: (i: I) => Promise<unknown>, optimistic?: (d: TaskDetail, i: I) => TaskDetail) {
  const qc = useQueryClient();
  const key = taskDetailQuery(taskId).queryKey;
  return useMutation({
    mutationKey: ["task-save", taskId],
    mutationFn: fn,
    onMutate: async (i: I) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<TaskDetail>(key);
      if (prev && optimistic) qc.setQueryData<TaskDetail>(key, optimistic(prev, i));
      return { prev };
    },
    onError: (e, _i, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      toast.error(errMsg(e));
    },
    onSettled: () => refreshTasks(qc),
  });
}

export function useTaskLabels(taskId: string) {
  return useTaskAction(taskId, (labelIds: string[]) => setTaskLabels({ data: { id: taskId, labelIds } }),
    (d, labelIds) => ({ ...d, label_ids: labelIds }));
}
export function useChecklistActions(taskId: string) {
  const add = useTaskAction(taskId, (text: string) => addChecklistItem({ data: { taskId, text } }));
  const update = useTaskAction(taskId, (i: { id: string; text?: string; done?: boolean }) => updateChecklistItem({ data: i }),
    (d, i) => ({ ...d, checklist: d.checklist.map((c) => (c.id === i.id ? { ...c, ...i } : c)) }));
  const reorder = useTaskAction(taskId, (ids: string[]) => reorderChecklist({ data: { taskId, ids } }),
    (d, ids) => ({ ...d, checklist: ids.flatMap((id) => { const item = d.checklist.find((c) => c.id === id); return item ? [item] : []; }) }));
  const remove = useTaskAction(taskId, (id: string) => deleteChecklistItem({ data: { id } }),
    (d, id) => ({ ...d, checklist: d.checklist.filter((c) => c.id !== id) }));
  return { add, update, reorder, remove };
}

// ---------- Phases ----------
export function usePhaseActions() {
  const qc = useQueryClient();
  const done = () => Promise.all([qc.invalidateQueries({ queryKey: phasesQuery.queryKey }), refreshTasks(qc)]);
  const opts = { onError: (e: unknown) => toast.error(errMsg(e)), onSettled: done };
  return {
    create: useMutation({ mutationFn: (i: z.input<typeof phaseInput>) => createPhase({ data: i }), ...opts }),
    update: useMutation({ mutationFn: (i: z.input<typeof phaseUpdate>) => updatePhase({ data: i }), ...opts }),
    remove: useMutation({ mutationFn: (id: string) => deletePhase({ data: { id } }), ...opts }),
    reorder: useMutation({
      mutationFn: (ids: string[]) => reorderPhases({ data: { ids } }),
      onMutate: (ids: string[]) => {
        const prev = qc.getQueryData<Phase[]>(phasesQuery.queryKey);
        if (prev) qc.setQueryData<Phase[]>(phasesQuery.queryKey, ids.flatMap((id) => { const item = prev.find((p) => p.id === id); return item ? [item] : []; }));
        return { prev };
      },
      onError: (e: unknown, _i: string[], ctx?: { prev: Phase[] | undefined }) => {
        if (ctx?.prev) qc.setQueryData(phasesQuery.queryKey, ctx.prev);
        toast.error(errMsg(e));
      },
      onSettled: done,
    }),
  };
}
