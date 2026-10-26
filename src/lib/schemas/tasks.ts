import { z } from "zod";

const id = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date").nullable();

export const taskTitle = z.string().trim().min(1, "Title is required").max(200, "200 characters max");

export const taskCreate = z.object({
  title: taskTitle,
  parent_task_id: id.nullish(),
  phase_id: id.nullish(),
  status_id: id.nullish(),
  priority_id: id.nullish(),
});

export const taskUpdate = z
  .object({
    id,
    title: taskTitle.optional(),
    description: z.string().max(10000, "10,000 characters max").nullable().optional(),
    parent_task_id: id.nullable().optional(),
    phase_id: id.nullable().optional(),
    status_id: id.optional(),
    priority_id: id.nullable().optional(),
    assignee_id: id.nullable().optional(),
    reporter_id: id.nullable().optional(),
    start_date: date.optional(),
    due_date: date.optional(),
    estimate_hours: z.number().min(0, "Must be 0 or more").max(99999).nullable().optional(),
    custom_fields: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((v) => !v.start_date || !v.due_date || v.due_date >= v.start_date, {
    path: ["due_date"],
    message: "Due date must be on or after the start date",
  });

export const taskMove = z.object({ id, status_id: id, position: z.number().finite() });
export const taskDelete = z.object({ id, confirmSubtasks: z.boolean().default(false) });
export const taskLabelsSet = z.object({ id, labelIds: z.array(id).max(50) });

export const taskList = z.object({
  search: z.string().trim().max(200).optional(),
  statusIds: z.array(id).optional(),
  priorityIds: z.array(id).optional(),
  assigneeIds: z.array(id).optional(),
  phaseIds: z.array(id).optional(),
  topLevelOnly: z.boolean().default(true),
  sort: z.enum(["position", "title", "due_date", "created_at", "updated_at"]).default("position"),
  dir: z.enum(["asc", "desc"]).default("asc"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(500).default(200),
});

export const checklistAdd = z.object({ taskId: id, text: z.string().trim().min(1, "Required").max(300) });
export const checklistUpdate = z.object({
  id,
  text: z.string().trim().min(1, "Required").max(300).optional(),
  done: z.boolean().optional(),
});
export const checklistReorder = z.object({ taskId: id, ids: z.array(id).min(1).max(200) });
export const byId = z.object({ id });

export const phaseInput = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(80, "80 characters max"),
    description: z.string().max(2000).nullable().optional(),
    start_date: date.optional(),
    end_date: date.optional(),
  })
  .refine((v) => !v.start_date || !v.end_date || v.end_date >= v.start_date, {
    path: ["end_date"],
    message: "End date must be on or after the start date",
  });
export const phaseUpdate = z
  .object({
    id,
    name: z.string().trim().min(1, "Name is required").max(80).optional(),
    description: z.string().max(2000).nullable().optional(),
    start_date: date.optional(),
    end_date: date.optional(),
  })
  .refine((v) => !v.start_date || !v.end_date || v.end_date >= v.start_date, {
    path: ["end_date"],
    message: "End date must be on or after the start date",
  });
export const phaseReorder = z.object({ ids: z.array(id).min(1).max(200) });
