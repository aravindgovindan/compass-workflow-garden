import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ListTodo } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, PageHeader } from "@/components/common/empty-state";
import { QuickAdd } from "@/components/tasks/quick-add";
import { TaskList } from "@/components/tasks/task-list";
import { TaskDrawer } from "@/components/tasks/task-drawer";
import { PhaseManager } from "@/components/tasks/phase-manager";
import { guardSection } from "@/lib/auth/guard";
import { useProjectConfig } from "@/lib/config/use-config";
import { phasesQuery, tasksListQuery } from "@/lib/tasks/queries";
import { useTerm } from "@/lib/terminology/use-term";

export const Route = createFileRoute("/_authenticated/_app/tasks")({
  beforeLoad: guardSection("tasks"),
  validateSearch: (s: Record<string, unknown>): { task?: string } =>
    typeof s["task"] === "string" && s["task"] ? { task: s["task"] } : {},
  head: () => ({ meta: [{ title: "Tasks — PlanAProject" }, { name: "description", content: "Plan and track the work." }] }),
  component: Page,
});

function Page() {
  const term = useTerm();
  const title = term("task");
  useEffect(() => { document.title = `${title} — PlanAProject`; }, [title]);
  const { task } = Route.useSearch();
  const navigate = Route.useNavigate();
  const open = (id: string) => navigate({ search: (p) => ({ ...p, task: id }) });
  const close = () => navigate({ search: ({ task: _t, ...rest }) => rest });

  const config = useProjectConfig();
  const tasks = useQuery(tasksListQuery);
  const phases = useQuery(phasesQuery);
  const loading = config.isPending || tasks.isPending || phases.isPending;
  const error = config.error || tasks.error || phases.error;

  return (
    <>
      <PageHeader title={title} description="Plan and track the work." actions={phases.data && <PhaseManager phases={phases.data} />} />
      {loading ? (
        <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-64 w-full" /></div>
      ) : error || !config.data || !tasks.data || !phases.data ? (
        <ErrorState message={error?.message ?? "Could not load the list."} onRetry={() => { tasks.refetch(); phases.refetch(); config.refetch(); }} />
      ) : (
        <div className="space-y-6">
          <QuickAdd />
          {tasks.data.rows.length === 0 && phases.data.length === 0 ? (
            <EmptyState icon={ListTodo} title={`No ${title.toLowerCase()} yet`}
              description={`Type a title above and press Enter to add your first ${term("task", "singular").toLowerCase()}.`} />
          ) : (
            <TaskList tasks={tasks.data.rows} phases={phases.data} config={config.data} onOpen={open} />
          )}
          <TaskDrawer taskId={task} config={config.data} phases={phases.data} onOpen={open} onClose={close} />
        </div>
      )}
    </>
  );
}
