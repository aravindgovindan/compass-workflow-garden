import { z } from "zod";
import { milestoneStatus } from "@/lib/milestones/status";
export function completion(done: number, total: number) {
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}
export function statusCompletion(
  statuses: readonly { name?: string; category: string; count: number }[],
) {
  return completion(
    statuses.filter((s) => s.category === "done").reduce((n, s) => n + s.count, 0),
    statuses.reduce((n, s) => n + s.count, 0),
  );
}
export function isOverdue(due: string | null, category: string, today: string) {
  return !!due && due < today && category !== "done";
}
export const milestoneSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  target_date: z.string(),
  owner_id: z.string().nullable(),
  status_override: z.enum(["upcoming", "at_risk", "achieved", "missed"]).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  project_id: z.string(),
  done: z.number(),
  total: z.number(),
});
export function summarizeMilestone(row: z.infer<typeof milestoneSummarySchema>, today?: string) {
  const { done, total, ...rest } = row;
  const progress = completion(done, total);
  return {
    ...rest,
    progress,
    status: milestoneStatus({
      targetDate: row.target_date,
      progress,
      override: row.status_override,
      ...(today ? { today } : {}),
    }),
  };
}
export const snapshotSchema = z.object({
  project: z.object({
    id: z.string(),
    name: z.string(),
    code: z.string(),
    status: z.string(),
    health: z.enum(["green", "amber", "red"]),
    start_date: z.string().nullable(),
    target_end_date: z.string().nullable(),
    objectives: z.string().nullable(),
  }),
  today: z.string(),
  total: z.number(),
  done: z.number(),
  overdue_count: z.number(),
  statuses: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      color: z.string(),
      category: z.string(),
      count: z.number(),
    }),
  ),
  assignees: z.array(
    z.object({ assignee_id: z.string().nullable(), name: z.string(), count: z.number() }),
  ),
  milestones: z.array(milestoneSummarySchema),
  risks: z.array(z.object({ rating: z.string(), count: z.number() })),
  issues: z.array(z.object({ severity: z.string(), count: z.number() })),
  overdue: z
    .array(z.object({ id: z.string(), title: z.string(), due_date: z.string() }))
    .optional(),
  activity: z
    .array(
      z.object({
        id: z.string(),
        entity_type: z.string(),
        entity_id: z.string(),
        action: z.string(),
        created_at: z.string(),
        actor_name: z.string(),
      }),
    )
    .optional(),
});
