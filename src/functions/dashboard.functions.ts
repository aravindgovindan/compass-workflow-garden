import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { projectAccess, fail } from "@/lib/project-access.server";
import { completion, snapshotSchema, summarizeMilestone } from "@/lib/dashboard/rules";
export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { projectId, role } = await projectAccess(context.supabase, context.userId);
    const r = await context.supabase.rpc("dashboard_snapshot", { _project_id: projectId });
    if (r.error) fail("load the dashboard", r.error);
    const data = snapshotSchema.parse(r.data);
    const milestones = data.milestones
      .map((m) => summarizeMilestone(m, data.today))
      .filter((m) => m.target_date >= data.today && m.status !== "achieved")
      .slice(0, 5);
    const { overdue, activity, ...publicData } = data;
    return {
      ...publicData,
      milestones,
      progress: completion(data.done, data.total),
      ...(role === "stakeholder" ? {} : { overdue: overdue ?? [], activity: activity ?? [] }),
    };
  });
export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;
