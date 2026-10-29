import { ExportButton } from "@/components/exports/export-button";
import { exportTasks } from "@/functions/exports.functions";
import { useEffect, useMemo } from "react";
import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { KanbanSquare, List, ListTodo } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EmptyState, ErrorState, PageHeader } from "@/components/common/empty-state";
import { QuickAdd } from "@/components/tasks/quick-add";
import { TaskTable } from "@/components/tasks/task-table";
import { TaskBoard } from "@/components/tasks/task-board";
import { TaskFilterBar } from "@/components/tasks/task-filters";
import { SavedViewsMenu } from "@/components/tasks/saved-views-menu";
import { ColumnPicker } from "@/components/tasks/column-picker";
import { columnChoices } from "@/components/tasks/columns";
import { TaskDrawer } from "@/components/tasks/task-drawer";
import { PhaseManager } from "@/components/tasks/phase-manager";
import { PickOne } from "@/components/tasks/shared";
import { guardSection } from "@/lib/auth/guard";
import { useProjectConfig } from "@/lib/config/use-config";
import { phasesQuery, tasksListQuery } from "@/lib/tasks/queries";
import { useSetViewPrefs, viewPrefsQuery } from "@/lib/tasks/view-queries";
import {
  parseTaskSearch,
  toFilters,
  viewState,
  type GroupBy,
  type TaskFilters,
} from "@/lib/tasks/view-params";
import { DEFAULT_LIST_COLUMNS } from "@/lib/tasks/views";
import { useTerm } from "@/lib/terminology/use-term";

const DEFAULTS = {
  q: "",
  status: [],
  assignee: [],
  priority: [],
  label: [],
  phase: [],
  milestone: [],
  overdue: false,
  cf: {},
  sort: "",
  dir: "asc",
  group: "phase",
};

export const Route = createFileRoute("/_authenticated/_app/tasks")({
  beforeLoad: guardSection("tasks"),
  validateSearch: (s: Record<string, unknown>) => parseTaskSearch(s),
  search: { middlewares: [stripSearchParams(DEFAULTS as never)] },
  head: () => ({
    meta: [
      { title: "Tasks — Compass Workflow" },
      { name: "description", content: "Plan and track the work in a list or on a board." },
      { property: "og:title", content: "Tasks — Compass Workflow" },
      { property: "og:description", content: "Plan and track the work in a list or on a board." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const term = useTerm();
  const title = term("task");
  useEffect(() => {
    document.title = `${title} — Compass Workflow`;
  }, [title]);
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const filters = useMemo(() => toFilters(search), [search]);
  const open = (id: string) => navigate({ search: (p) => ({ ...p, task: id }) });
  const close = () => navigate({ search: ({ task: _t, ...rest }) => rest });
  const setFilters = (patch: Partial<TaskFilters>) =>
    navigate({ search: (p) => ({ ...p, ...patch }), replace: true });

  const config = useProjectConfig();
  const tasks = useQuery(tasksListQuery(filters));
  const phases = useQuery(phasesQuery);
  const prefs = useQuery(viewPrefsQuery);
  const setPrefs = useSetViewPrefs();
  const mode = prefs.data?.view_mode ?? "list";
  const visible = prefs.data?.list_columns.length
    ? prefs.data.list_columns
    : [...DEFAULT_LIST_COLUMNS];

  const loading = config.isPending || tasks.isPending || phases.isPending;
  const error = config.error || tasks.error || phases.error;
  const filtered = Object.values(filters).some((v) =>
    Array.isArray(v) ? v.length : v && typeof v === "object" ? Object.keys(v).length : v,
  );

  return (
    <>
      <PageHeader
        title={title}
        description="Plan and track the work."
        actions={phases.data && <PhaseManager phases={phases.data} />}
      />
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : error || !config.data || !tasks.data || !phases.data ? (
        <ErrorState
          message={error?.message ?? "Could not load the list."}
          onRetry={() => {
            tasks.refetch();
            phases.refetch();
            config.refetch();
          }}
        />
      ) : (
        <div className="space-y-4">
          <QuickAdd />
          <TaskFilterBar
            filters={filters}
            config={config.data}
            phases={phases.data}
            onChange={setFilters}
          />
          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={mode}
              aria-label="Layout"
              onValueChange={(v) => v && setPrefs.mutate({ view_mode: v as "list" | "board" })}
            >
              <ToggleGroupItem value="list" aria-label="List">
                <List className="size-4" />
                List
              </ToggleGroupItem>
              <ToggleGroupItem value="board" aria-label="Board">
                <KanbanSquare className="size-4" />
                Board
              </ToggleGroupItem>
            </ToggleGroup>
            {mode === "list" && (
              <div className="w-44">
                <PickOne
                  id="group-by"
                  label="Group by"
                  value={search.group ?? "phase"}
                  onChange={(g) =>
                    navigate({
                      search: (p) => ({ ...p, group: (g ?? "none") as GroupBy }),
                      replace: true,
                    })
                  }
                  options={[
                    { value: "none", label: "No grouping" },
                    { value: "status", label: "Group: Status" },
                    { value: "assignee", label: "Group: Assignee" },
                    { value: "phase", label: `Group: ${term("phase", "singular")}` },
                    { value: "priority", label: "Group: Priority" },
                  ]}
                />
              </div>
            )}
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {tasks.data.rows.length}{" "}
              {term("task", tasks.data.rows.length === 1 ? "singular" : "plural").toLowerCase()}
              {tasks.isFetching ? " · updating…" : ""}
            </span>
            <div className="ml-auto flex flex-wrap gap-2">
              <ExportButton
                kind="task"
                fn={exportTasks}
                data={{
                  topLevelOnly: true,
                  search: filters.q || undefined,
                  statusIds: filters.status,
                  priorityIds: filters.priority,
                  assigneeIds: filters.assignee,
                  phaseIds: filters.phase,
                  milestoneIds: filters.milestone,
                  labelIds: filters.label,
                  dueFrom: filters.dueFrom,
                  dueTo: filters.dueTo,
                  overdue: filters.overdue,
                  cf: filters.cf,
                  sort:
                    (["position", "title", "due_date", "created_at", "updated_at"] as const).find(
                      (x) => x === search.sort,
                    ) ?? "position",
                  dir: search.dir === "desc" ? "desc" : "asc",
                }}
              />
              {mode === "list" && (
                <ColumnPicker
                  choices={columnChoices(config.data, term)}
                  visible={visible}
                  onChange={(ids) => setPrefs.mutate({ list_columns: ids })}
                />
              )}
              <SavedViewsMenu
                current={viewState(search)}
                mode={mode}
                onLoad={(v) => {
                  navigate({ search: () => parseTaskSearch(v.filters) });
                  if (v.view_type !== mode) setPrefs.mutate({ view_mode: v.view_type });
                }}
              />
            </div>
          </div>
          {tasks.data.rows.length === 0 ? (
            <EmptyState
              icon={ListTodo}
              title={
                filtered
                  ? `No ${title.toLowerCase()} match these filters`
                  : `No ${title.toLowerCase()} yet`
              }
              description={
                filtered
                  ? "Try removing a filter or clearing the search."
                  : `Type a title above and press Enter to add your first ${term("task", "singular").toLowerCase()}.`
              }
            />
          ) : mode === "board" ? (
            <TaskBoard tasks={tasks.data.rows} config={config.data} onOpen={open} />
          ) : (
            <TaskTable
              tasks={tasks.data.rows}
              config={config.data}
              phases={phases.data}
              visible={visible}
              sort={search.sort}
              dir={search.dir as "asc" | "desc"}
              group={search.group as GroupBy}
              onSort={(sort, dir) =>
                navigate({ search: (p) => ({ ...p, sort, dir }), replace: true })
              }
              onOpen={open}
            />
          )}
          <TaskDrawer
            taskId={search.task}
            config={config.data}
            phases={phases.data}
            onOpen={open}
            onClose={close}
          />
        </div>
      )}
    </>
  );
}
