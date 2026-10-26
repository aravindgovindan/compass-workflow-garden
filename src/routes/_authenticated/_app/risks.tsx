import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, PageHeader } from "@/components/common/empty-state";
import { Multi } from "@/components/tasks/task-filters";
import { formatDate } from "@/components/tasks/shared";
import { NewRecordButton } from "@/components/registers/new-record-dialog";
import { RiskHeatmap } from "@/components/registers/risk-heatmap";
import { RiskDrawer } from "@/components/registers/risk-drawer";
import { label, LevelBadge, RegisterTable, StatusPill, type Col } from "@/components/registers/shared";
import type { RiskRow } from "@/functions/risks.functions";
import { guardSection } from "@/lib/auth/guard";
import { canWrite } from "@/lib/auth/roles";
import { useProjectConfig } from "@/lib/config/use-config";
import { risksQuery } from "@/lib/registers/queries";
import { NO_OWNER, riskSearch, tidySearch, type RiskFilters } from "@/lib/schemas/registers";
import { RISK_RATINGS, RISK_STATUSES } from "@/lib/risks/score";
import { useTerm } from "@/lib/terminology/use-term";

export const Route = createFileRoute("/_authenticated/_app/risks")({
  validateSearch: (s: Record<string, unknown>) => riskSearch.parse(s),
  beforeLoad: guardSection("risks"),
  head: () => ({ meta: [{ title: "Risks — Compass Workflow" }, { name: "description", content: "What could go wrong, and the plan for it." }] }),
  component: Page,
});

function Page() {
  const term = useTerm();
  const title = term("risk");
  useEffect(() => { document.title = `${title} — Compass Workflow`; }, [title]);
  const { me } = Route.useRouteContext();
  const writer = canWrite(me.membership?.role ?? null);
  const { item, ...filters } = Route.useSearch();
  const navigate = Route.useNavigate();
  const set = (patch: Partial<RiskFilters & { item: string | undefined }>) =>
    navigate({ search: ((prev: Record<string, unknown>) => tidySearch({ ...prev, ...patch })) as never, replace: true });
  const config = useProjectConfig();
  const list = useQuery(risksQuery(filters));
  const people = config.data?.members ?? [];
  const nameOf = (id: string | null) => people.find((m) => m.user_id === id)?.full_name ?? "—";
  const active = filters.status.length + filters.owner.length + filters.rating.length + filters.category.length + (filters.p ? 1 : 0);

  const cols: Col<RiskRow>[] = [
    { key: "title", label: "Title", sort: "title", cell: () => null },
    { key: "score", label: "Score", sort: "score", cell: (r) => <span className="flex items-center gap-2"><span className="w-5 tabular-nums">{r.score}</span><LevelBadge value={r.rating} /></span> },
    { key: "status", label: "Status", sort: "status", cell: (r) => <StatusPill value={r.status} /> },
    { key: "owner", label: "Owner", cell: (r) => nameOf(r.owner_id) },
    { key: "category", label: "Category", cell: (r) => r.category ?? "—" },
    { key: "review", label: "Review", sort: "review_date", cell: (r) => formatDate(r.review_date) || "—" },
  ];

  return (
    <>
      <PageHeader title={title} description="What could go wrong, and the plan for it."
        actions={writer && <NewRecordButton kind="risk" onCreated={(id) => set({ item: id })} />} />
      {list.isPending || config.isPending ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
      ) : list.error || config.error || !config.data ? (
        <ErrorState message={(list.error ?? config.error)?.message ?? "Could not load."} onRetry={() => { list.refetch(); config.refetch(); }} />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2" role="search">
              <Multi label="Status" value={filters.status} onChange={(v) => set({ status: v as RiskFilters["status"] })}
                options={RISK_STATUSES.map((s) => ({ value: s, label: label(s) }))} />
              <Multi label="Owner" value={filters.owner} onChange={(v) => set({ owner: v })}
                options={[{ value: NO_OWNER, label: "No owner" }, ...people.map((m) => ({ value: m.user_id, label: m.full_name }))]} />
              <Multi label="Rating" value={filters.rating} onChange={(v) => set({ rating: v as RiskFilters["rating"] })}
                options={RISK_RATINGS.map((s) => ({ value: s, label: label(s) }))} />
              <Multi label="Category" value={filters.category} onChange={(v) => set({ category: v })}
                options={list.data.categories.map((c) => ({ value: c, label: c }))} />
              {filters.p && filters.i && (
                <Button variant="secondary" size="sm" onClick={() => set({ p: undefined, i: undefined })}>
                  Probability {filters.p} × impact {filters.i}<X className="size-3.5" />
                </Button>
              )}
              {active > 0 && (
                <Button variant="ghost" size="sm" onClick={() => set({ status: [], owner: [], rating: [], category: [], p: undefined, i: undefined })}>
                  <X className="size-4" /> Clear ({active})
                </Button>
              )}
            </div>
            {list.data.rows.length === 0 ? (
              <EmptyState icon={ShieldAlert} title={active ? `No ${title.toLowerCase()} match these filters` : `No ${title.toLowerCase()} yet`}
                description={active ? "Try clearing a filter." : writer ? `Log what could go wrong, how likely it is and its impact.` : "Nothing has been logged yet."} />
            ) : (
              <RegisterTable rows={list.data.rows} cols={cols} sort={filters.sort} dir={filters.dir} caption={title}
                onSort={(sort, dir) => set({ sort: sort as RiskFilters["sort"], dir })} onOpen={(id) => set({ item: id })} />
            )}
          </div>
          <RiskHeatmap heat={list.data.heat} selected={{ p: filters.p, i: filters.i }} onSelect={(c) => set({ p: c.p, i: c.i })} />
        </div>
      )}
      {config.data && (
        <RiskDrawer id={item} config={config.data} canEdit={writer} onClose={() => set({ item: undefined })}
          onConverted={(issueId) => navigate({ to: "/issues", search: { item: issueId } as never })} />
      )}
    </>
  );
}
