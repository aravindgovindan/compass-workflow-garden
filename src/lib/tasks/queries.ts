import { queryOptions, useIsMutating, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addChecklistItem, createTask, deleteChecklistItem, deleteTask, getTask, listTasks, moveTask,
  reorderChecklist, setTaskLabels, updateChecklistItem, updateTask, type TaskDetail, type TaskListItem,
} from "@/functions/tasks.functions";
import { createPhase, deletePhase, listPhases, reorderPhases, updatePhase, type Phase } from "@/functions/phases.functions";

type ListData = { rows: TaskListItem[]; total: number };
type UpdateInput = Parameters<typeof updateTask>[0]["data"];

export const tasksListQuery = queryOptions({
  queryKey: ["tasks", "list"],
  queryFn: () => listTasks({ data: { topLevelOnly: true, sort: "position", pageSize: 500 } }),
});
export const taskDetailQuery = (id: string) =>
  queryOptions({ queryKey: ["tasks", "detail", id], queryFn: () => getTask({ data: { id } }) });
export const phasesQuery = queryOptions({ queryKey: ["phases"], queryFn: () => listPhases() });

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");
const refreshTasks = (qc: QueryClient) => qc.invalidateQueries({ queryKey: ["tasks"] });

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
      const list = qc.getQueryData<ListData>(tasksListQuery.queryKey);
      const detail = qc.getQueryData<TaskDetail>(taskDetailQuery(id).queryKey);
      const apply = <T extends { custom_fields: unknown }>(t: T): T => ({
        ...t, ...patch,
        custom_fields: patch.custom_fields ? { ...(t.custom_fields as object), ...patch.custom_fields } : t.custom_fields,
      });
      if (list) qc.setQueryData<ListData>(tasksListQuery.queryKey, { ...list, rows: list.rows.map((r) => (r.id === id ? apply(r) : r)) });
      if (detail) qc.setQueryData<TaskDetail>(taskDetailQuery(id).queryKey, apply(detail));
      return { list, detail };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.list) qc.setQueryData(tasksListQuery.queryKey, ctx.list);
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
    mutationFn: (input: Parameters<typeof createTask>[0]["data"]) => createTask({ data: input }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: tasksListQuery.queryKey });
      const list = qc.getQueryData<ListData>(tasksListQuery.queryKey);
      if (list && !input.parent_task_id) {
        const now = new Date().toISOString();
        const temp: TaskListItem = {
          id: `temp-${crypto.randomUUID()}`, project_id: "", title: input.title, description: null, parent_task_id: null,
          phase_id: input.phase_id ?? null, status_id: input.status_id ?? "", priority_id: input.priority_id ?? null,
          assignee_id: null, reporter_id: null, start_date: null, due_date: null, estimate_hours: null,
          position: Number.MAX_SAFE_INTEGER, custom_fields: {}, completed_at: null, created_at: now, updated_at: now,
          label_ids: [], subtask_count: 0, checklist_total: 0, checklist_done: 0,
        };
        qc.setQueryData<ListData>(tasksListQuery.queryKey, { rows: [...list.rows, temp], total: list.total + 1 });
      }
      return { list };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.list) qc.setQueryData(tasksListQuery.queryKey, ctx.list);
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
    onSuccess: (r) => { if (r.deleted) return refreshTasks(qc); },
  });
}

export function useMoveTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; status_id: string; position: number }) => moveTask({ data: input }),
    onError: (e) => toast.error(errMsg(e)),
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
    (d, ids) => ({ ...d, checklist: ids.map((id) => d.checklist.find((c) => c.id === id)!).filter(Boolean) }));
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
    create: useMutation({ mutationFn: (i: Parameters<typeof createPhase>[0]["data"]) => createPhase({ data: i }), ...opts }),
    update: useMutation({ mutationFn: (i: Parameters<typeof updatePhase>[0]["data"]) => updatePhase({ data: i }), ...opts }),
    remove: useMutation({ mutationFn: (id: string) => deletePhase({ data: { id } }), ...opts }),
    reorder: useMutation({
      mutationFn: (ids: string[]) => reorderPhases({ data: { ids } }),
      onMutate: (ids: string[]) => {
        const prev = qc.getQueryData<Phase[]>(phasesQuery.queryKey);
        if (prev) qc.setQueryData<Phase[]>(phasesQuery.queryKey, ids.map((id) => prev.find((p) => p.id === id)!).filter(Boolean));
        return { prev };
      },
      onError: (e: unknown, _i: string[], ctx?: { prev?: Phase[] }) => {
        if (ctx?.prev) qc.setQueryData(phasesQuery.queryKey, ctx.prev);
        toast.error(errMsg(e));
      },
      onSettled: done,
    }),
  };
}
