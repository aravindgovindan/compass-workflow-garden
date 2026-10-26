import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { projectAccess } from "@/lib/project-access.server";
import { taskList } from "@/lib/schemas/tasks";
import { issueFilters, riskFilters } from "@/lib/schemas/registers";
import { assertCanExport, csvFile } from "@/lib/exports/csv";
import { exportContext } from "@/lib/exports/context.server";
import { filteredTasks } from "@/lib/exports/task-list.server";
import { riskRows } from "@/lib/exports/risks-list.server";
import { issueRows } from "@/lib/exports/issues-list.server";
import { milestoneRows } from "@/lib/exports/milestones-list.server";
const human = (v: string) => v.replaceAll("_", " ");
export const exportTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => taskList.parse(i ?? {}))
  .handler(async ({ data, context }) => {
    const { projectId, role } = await projectAccess(context.supabase, context.userId);
    assertCanExport(role, "task");
    const [list, c] = await Promise.all([
      filteredTasks(context.supabase, projectId, data),
      exportContext(context.supabase, projectId, "task"),
    ]);
    const headers = [
      `${c.term("task")} ID`,
      `${c.term("task")} title`,
      "Description",
      `${c.term("subtask")} of`,
      "Status",
      "Priority",
      "Assignee",
      "Reporter",
      c.term("phase"),
      c.term("milestone"),
      "Start date",
      "Due date",
      "Estimate hours",
      "Labels",
      "Completed at",
      ...c.fields.map((f) => f.name),
    ];
    return {
      filename: c.filename,
      count: list.rows.length,
      csv: csvFile(
        headers,
        list.rows.map((r) => [
          r.id,
          r.title,
          r.description,
          r.parent_task_id,
          c.name(r.status_id),
          c.name(r.priority_id),
          c.name(r.assignee_id),
          c.name(r.reporter_id),
          c.name(r.phase_id),
          c.name(r.milestone_id),
          r.start_date,
          r.due_date,
          r.estimate_hours,
          r.label_ids.map(c.name).join("; "),
          r.completed_at,
          ...c.custom(r.custom_fields),
        ]),
      ),
    };
  });
export const exportMilestones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({}).parse(i ?? {}))
  .handler(async ({ context }) => {
    const { projectId, role } = await projectAccess(context.supabase, context.userId);
    assertCanExport(role, "milestone");
    const [rows, c] = await Promise.all([
      milestoneRows(context.supabase, projectId),
      exportContext(context.supabase, projectId, "milestone"),
    ]);
    return {
      filename: c.filename,
      count: rows.length,
      csv: csvFile(
        [
          `${c.term("milestone")} ID`,
          `${c.term("milestone")} name`,
          "Description",
          "Target date",
          "Owner",
          "Status",
          "Status override",
          `${c.term("task")} count`,
          `${c.term("task")} done`,
          "Percent complete",
        ],
        rows.map((r) => [
          r.id,
          r.name,
          r.description,
          r.target_date,
          c.name(r.owner_id),
          human(r.status),
          r.status_override ? human(r.status_override) : "",
          r.progress.total,
          r.progress.done,
          r.progress.percent,
        ]),
      ),
    };
  });
export const exportRisks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => riskFilters.parse(i ?? {}))
  .handler(async ({ data, context }) => {
    const { projectId, role } = await projectAccess(context.supabase, context.userId);
    assertCanExport(role, "risk");
    const [list, c] = await Promise.all([
      riskRows(context.supabase, projectId, data),
      exportContext(context.supabase, projectId, "risk"),
    ]);
    return {
      filename: c.filename,
      count: list.rows.length,
      csv: csvFile(
        [
          `${c.term("risk")} ID`,
          `${c.term("risk")} title`,
          "Description",
          "Category",
          "Probability",
          "Impact",
          "Score",
          "Rating",
          "Owner",
          "Mitigation plan",
          "Status",
          "Review date",
          ...c.fields.map((f) => f.name),
        ],
        list.rows.map((r) => [
          r.id,
          r.title,
          r.description,
          r.category,
          r.probability,
          r.impact,
          r.score,
          r.rating,
          c.name(r.owner_id),
          r.mitigation_plan,
          human(r.status),
          r.review_date,
          ...c.custom(r.custom_fields),
        ]),
      ),
    };
  });
export const exportIssues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => issueFilters.parse(i ?? {}))
  .handler(async ({ data, context }) => {
    const { projectId, role } = await projectAccess(context.supabase, context.userId);
    assertCanExport(role, "issue");
    const [list, c] = await Promise.all([
      issueRows(context.supabase, projectId, data),
      exportContext(context.supabase, projectId, "issue"),
    ]);
    return {
      filename: c.filename,
      count: list.rows.length,
      csv: csvFile(
        [
          `${c.term("issue")} ID`,
          `${c.term("issue")} title`,
          "Description",
          "Category",
          "Severity",
          "Raised by",
          "Owner",
          "Status",
          "Target date",
          "Resolution",
          `Source ${c.term("risk")}`,
          ...c.fields.map((f) => f.name),
        ],
        list.rows.map((r) => [
          r.id,
          r.title,
          r.description,
          r.category,
          r.severity,
          c.name(r.raised_by),
          c.name(r.owner_id),
          human(r.status),
          r.target_date,
          r.resolution,
          r.source_risk_id,
          ...c.custom(r.custom_fields),
        ]),
      ),
    };
  });
