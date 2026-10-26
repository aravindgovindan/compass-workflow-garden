import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, PageHeader } from "@/components/common/empty-state";
import { Multi } from "@/components/tasks/task-filters";
import { formatDate } from "@/components/tasks/shared";
import { NewRecordButton } from "@/components/registers/new-record-dialog";
import { IssueDrawer } from "@/components/registers/issue-drawer";
import { label, LevelBadge, RegisterTable, StatusPill, type Col } from "@/components/registers/shared";
import type { IssueRow } from "@/functions/issues.functions";
import { guardSection } from "@/lib/auth/guard";
import { canWrite } from "@/lib/auth/roles";
import { useProjectConfig } from "@/lib/config/use-config";
import { issuesQuery } from "@/lib/registers/queries";
import { issueSearch, NO_OWNER, tidySearch, type IssueFilters } from "@/lib/schemas/registers";
import { ISSUE_SEVERITIES, ISSUE_STATUSES } from "@/lib/risks/score";
import { useTerm } from "@/lib/terminology/use-term";

export const Route = createFileRoute("/_authenticated/_app/issues")({
  validateSearch: (s: Record<string, unknown>) => issueSearch.parse(s),
  beforeLoad: guardSection("issues"),
  head: () => ({ meta: [{ title: "Issues — Compass Workflow" }, { name: "description", content: "Problems that need resolving now." }] }),
  component: Page,
});

function Page() {
  const term = useTerm();
  const title = term("issue");
  useEffect(() => { document.title = `${title} — Compass Workflow`; }, [title]);
  const { me } = Route.useRouteContext();
  const writer = canWrite(me.membership?.role ?? null);
  const { item, ...filters } = Route.useSearch();
  const navigate = Route.useNavigate();
  const set = (patch: Partial<IssueFilters & { item: string | undefined }>) =>
    navigate({ search: ((prev: Record<string, unknown>) => tidySearch({ ...prev, ...patch })) as never, replace: true });
  const config = useProjectConfig();
  const list = useQuery(issuesQuery(filters));
  const people = config.data?.members ?? [];
  const nameOf = (id: string | null) => people.find((m) => m.user_id === id)?.full_name ?? "—";
  const today = new Date().toISOString().slice(0, 10);
  const active = filters.status.length + filters.owner.length + filters.severity.length + filters.category.length;

  const cols: Col<IssueRow>[] = [
    { key: "title", label: "Title", sort: "title", cell: () => null },
    { key: "severity", label: "Severity", sort: "severity", cell: (r) => <LevelBadge value={r.severity} /> },
    { key: "status", label: "Status", sort: "status", cell: (r) => <StatusPill value={r.status} /> },
    { key: "owner", label: "Owner", cell: (r) => nameOf(r.owner_id) },
    { key: "category", label: "Category", cell: (r) => r.category ?? "—" },
    {
      key: "target", label: "Target", sort: "target_date", cell: (r) => {
        const late = !!r.target_date && r.target_date < today && (r.status === "open" || r.status === "in_progress");
        return <span className={late ? "font-medium text-destructive" : undefined}>{formatDate(r.target_date) || "—"}{late && <span className="sr-only"> (overdue)</span>}</span>;
      },
    },
  ];

  return (
    <>
      <PageHeader title={title} description="Problems that need resolving now."
        actions={writer && <NewRecordButton kind="issue" onCreated={(id) => set({ item: id })} />} />
      {list.isPending || config.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : list.error || config.error || !config.data ? (
        <ErrorState message={(list.error ?? config.error)?.message ?? "Could not load."} onRetry={() => { list.refetch(); config.refetch(); }} />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2" role="search">
            <Multi label="Status" value={filters.status} onChange={(v) => set({ status: v as IssueFilters["status"] })}
              options={ISSUE_STATUSES.map((s) => ({ value: s, label: label(s) }))} />
            <Multi label="Owner" value={filters.owner} onChange={(v) => set({ owner: v })}
              options={[{ value: NO_OWNER, label: "No owner" }, ...people.map((m) => ({ value: m.user_id, label: m.full_name }))]} />
            <Multi label="Severity" value={filters.severity} onChange={(v) => set({ severity: v as IssueFilters["severity"] })}
              options={ISSUE_SEVERITIES.map((s) => ({ value: s, label: label(s) }))} />
            <Multi label="Category" value={filters.category} onChange={(v) => set({ category: v })}
              options={list.data.categories.map((c) => ({ value: c, label: c }))} />
            {active > 0 && (
              <Button variant="ghost" size="sm" onClick={() => set({ status: [], owner: [], severity: [], category: [] })}><X className="size-4" /> Clear ({active})</Button>
            )}
          </div>
          {list.data.rows.length === 0 ? (
            <EmptyState icon={AlertTriangle} title={active ? `No ${title.toLowerCase()} match these filters` : `No ${title.toLowerCase()} yet`}
              description={active ? "Try clearing a filter." : writer ? "Log problems that need resolving, or convert a risk that has happened." : "Nothing has been logged yet."} />
          ) : (
            <RegisterTable rows={list.data.rows} cols={cols} sort={filters.sort} dir={filters.dir} caption={title}
              onSort={(sort, dir) => set({ sort: sort as IssueFilters["sort"], dir })} onOpen={(id) => set({ item: id })} />
          )}
        </div>
      )}
      {config.data && <IssueDrawer id={item} config={config.data} canEdit={writer} onClose={() => set({ item: undefined })} />}
    </>
  );
}
