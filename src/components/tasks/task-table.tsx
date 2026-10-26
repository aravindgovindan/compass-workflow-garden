import { useMemo, useRef } from "react";
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type Row, type SortingState } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { TaskListItem } from "@/functions/tasks.functions";
import type { ProjectConfig } from "@/functions/config.functions";
import type { Phase } from "@/functions/phases.functions";
import type { GroupBy } from "@/lib/tasks/view-params";
import { useTerm } from "@/lib/terminology/use-term";
import { buildColumns, type ColMeta } from "./columns";

type Item = { kind: "group"; key: string; label: string; count: number } | { kind: "row"; row: Row<TaskListItem> };

/** Virtualized list/table view: sortable columns, optional grouping, sticky header. */
export function TaskTable({ tasks, config, phases, visible, sort, dir, group, onSort, onOpen }: {
  tasks: TaskListItem[]; config: ProjectConfig; phases: Phase[]; visible: string[];
  sort: string; dir: "asc" | "desc"; group: GroupBy;
  onSort: (sort: string, dir: "asc" | "desc") => void; onOpen: (id: string) => void;
}) {
  const term = useTerm();
  const columns = useMemo(() => buildColumns(config, phases, term), [config, phases, term]);
  const columnVisibility = useMemo(
    () => Object.fromEntries(columns.map((c) => [c.id!, c.id === "title" || visible.includes(c.id!)])), [columns, visible]);
  const sorting: SortingState = sort && columns.some((c) => c.id === sort) ? [{ id: sort, desc: dir === "desc" }] : [];
  const table = useReactTable({
    data: tasks, columns, state: { sorting, columnVisibility },
    getRowId: (r) => r.id,
    onSortingChange: (u) => {
      const next = typeof u === "function" ? u(sorting) : u;
      onSort(next[0]?.id ?? "", next[0]?.desc ? "desc" : "asc");
    },
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const items = useMemo<Item[]>(() => groupRows(rows, group, config, phases, term), [rows, group, config, phases, term]);
  const headers = table.getHeaderGroups()[0]!.headers;
  const minWidth = headers.reduce((s, h) => s + ((h.column.columnDef.meta as ColMeta | undefined)?.width ?? 120), 0);

  const parentRef = useRef<HTMLDivElement>(null);
  const v = useVirtualizer({ count: items.length, getScrollElement: () => parentRef.current, estimateSize: (i) => (items[i]!.kind === "group" ? 36 : 40), overscan: 12 });

  return (
    <div ref={parentRef} role="table" aria-rowcount={tasks.length} className="max-h-[calc(100vh-17rem)] min-h-64 overflow-auto rounded-lg border bg-card">
      <div style={{ minWidth }}>
        <div role="row" className="sticky top-0 z-10 flex border-b bg-muted/95 text-xs font-medium text-muted-foreground backdrop-blur">
          {headers.map((h) => {
            const meta = h.column.columnDef.meta as ColMeta | undefined;
            const s = h.column.getIsSorted();
            return (
              <div key={h.id} role="columnheader" aria-sort={s ? (s === "asc" ? "ascending" : "descending") : "none"}
                style={{ width: meta?.width, flexGrow: h.id === "title" ? 1 : 0 }} className="shrink-0 px-3 py-2">
                <button type="button" onClick={h.column.getToggleSortingHandler()}
                  className="flex items-center gap-1 rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {flexRender(h.column.columnDef.header, h.getContext())}
                  {s === "asc" ? <ArrowUp className="size-3" /> : s === "desc" ? <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-40" />}
                </button>
              </div>
            );
          })}
        </div>
        <div style={{ height: v.getTotalSize(), position: "relative" }}>
          {v.getVirtualItems().map((vi) => {
            const it = items[vi.index]!;
            const style = { position: "absolute" as const, top: 0, left: 0, right: 0, height: vi.size, transform: `translateY(${vi.start}px)` };
            if (it.kind === "group") {
              return (
                <div key={`g-${it.key}`} role="row" style={style} className="flex items-center gap-2 border-b bg-secondary/60 px-3">
                  <span className="font-display text-sm font-semibold">{it.label}</span>
                  <span className="text-xs text-muted-foreground">{it.count}</span>
                </div>
              );
            }
            const t = it.row.original;
            return (
              <div key={t.id} role="row" tabIndex={t.id.startsWith("temp-") ? -1 : 0} style={style}
                onClick={() => !t.id.startsWith("temp-") && onOpen(t.id)}
                onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !t.id.startsWith("temp-")) { e.preventDefault(); onOpen(t.id); } }}
                className="flex cursor-pointer items-center border-b text-sm hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                {it.row.getVisibleCells().map((c) => {
                  const meta = c.column.columnDef.meta as ColMeta | undefined;
                  return (
                    <div key={c.id} role="cell" style={{ width: meta?.width, flexGrow: c.column.id === "title" ? 1 : 0 }} className="flex min-w-0 shrink-0 items-center overflow-hidden px-3">
                      {flexRender(c.column.columnDef.cell, c.getContext())}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function groupRows(rows: Row<TaskListItem>[], group: GroupBy, config: ProjectConfig, phases: Phase[], term: ReturnType<typeof useTerm>): Item[] {
  if (group === "none") return rows.map((row) => ({ kind: "row", row }));
  const keyOf = (t: TaskListItem) =>
    group === "status" ? t.status_id : group === "priority" ? t.priority_id : group === "phase" ? t.phase_id : t.assignee_id;
  const ordered: { key: string | null; label: string }[] =
    group === "status" ? config.statuses.map((s) => ({ key: s.id, label: s.name }))
    : group === "priority" ? [...config.priorities.map((p) => ({ key: p.id, label: p.name })), { key: null, label: "No priority" }]
    : group === "phase" ? [...phases.map((p) => ({ key: p.id, label: p.name })), { key: null, label: `No ${term("phase", "singular").toLowerCase()}` }]
    : [...[...config.members].sort((a, b) => a.full_name.localeCompare(b.full_name)).map((m) => ({ key: m.user_id, label: m.full_name })), { key: null, label: "Unassigned" }];
  const buckets = new Map<string | null, Row<TaskListItem>[]>();
  for (const r of rows) {
    const k = keyOf(r.original) ?? null;
    const known = ordered.some((o) => o.key === k) ? k : null;
    buckets.set(known, [...(buckets.get(known) ?? []), r]);
  }
  const out: Item[] = [];
  for (const g of ordered) {
    const list = buckets.get(g.key);
    if (!list?.length) continue;
    out.push({ kind: "group", key: g.key ?? "none", label: g.label, count: list.length });
    for (const row of list) out.push({ kind: "row", row });
  }
  return out;
}
