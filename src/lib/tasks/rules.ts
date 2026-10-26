import { canWrite, type ProjectRole } from "@/lib/auth/roles";
import { validateCustomValues } from "@/lib/custom-fields/validate";
import type { CustomFieldDef, CustomValues } from "@/lib/custom-fields/types";

export type StatusCategory = "todo" | "in_progress" | "done";

/**
 * Mirrors the tasks_integrity() DB trigger (the source of truth):
 * entering a done-category status sets completed_at, staying done keeps it, leaving clears it.
 */
export function nextCompletedAt(prev: string | null, category: StatusCategory, now: Date = new Date()): string | null {
  if (category !== "done") return null;
  return prev ?? now.toISOString();
}

/** One level of sub-tasks: returns an error message, or null when allowed. Also enforced in the DB. */
export function checkSubtaskParent(
  parent: { id: string; parent_task_id: string | null } | null,
  opts: { taskId?: string; taskHasChildren?: boolean } = {},
): string | null {
  if (!parent) return null;
  if (parent.id === opts.taskId) return "A task cannot be its own parent.";
  if (parent.parent_task_id) return "Sub-tasks cannot have their own sub-tasks.";
  if (opts.taskHasChildren) return "A task with sub-tasks cannot become a sub-task.";
  return null;
}

/** Server-side write check for work items. Stakeholders are read-only. */
export function assertCanWriteTasks(role: ProjectRole | null): void {
  if (!canWrite(role)) throw new Error("You have read-only access to this project.");
}

/** Merge a custom-field patch into stored values and validate the result. Throws with field errors. */
export function mergeCustomFields(
  defs: CustomFieldDef[],
  stored: CustomValues,
  patch: CustomValues,
  memberIds: string[],
): CustomValues {
  const r = validateCustomValues(defs, { ...stored, ...patch }, { memberIds });
  if (!r.ok) throw new Error(Object.values(r.errors).join(" "));
  return r.values;
}

/** Position to drop an item between two neighbours (fractional ordering). */
export function positionBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return 0;
  if (before === null) return (after as number) - 1;
  if (after === null) return before + 1;
  return (before + after) / 2;
}
