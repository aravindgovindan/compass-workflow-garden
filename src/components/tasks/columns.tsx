import type { ColumnDef } from "@tanstack/react-table";
import type { TaskListItem } from "@/functions/tasks.functions";
import type { ProjectConfig } from "@/functions/config.functions";
import type { Phase } from "@/functions/phases.functions";
import type { CustomFieldDef } from "@/lib/custom-fields/types";
import type { TermKey, TermForm } from "@/lib/terminology/defaults";
import { CustomFieldValue } from "@/components/custom-fields/custom-field-value";
import { Dot, formatDate, isOverdue } from "./shared";
import { LabelChips, PersonAvatar } from "./person";

export type ColMeta = { width: number; label: string };
type Term = (k: TermKey, f?: TermForm) => string;

/** Column ids a user can toggle (title is always shown). */
export function columnChoices(config: ProjectConfig, term: Term): { id: string; label: string }[] {
  return [
    { id: "status", label: "Status" }, { id: "priority", label: "Priority" }, { id: "assignee", label: "Assignee" },
    { id: "reporter", label: "Reporter" }, { id: "phase", label: term("phase", "singular") }, { id: "labels", label: "Labels" },
    { id: "start_date", label: "Start" }, { id: "due_date", label: "Due" }, { id: "estimate_hours", label: "Estimate (h)" },
    { id: "updated_at", label: "Updated" },
    ...config.customFields.filter((f) => !f.archived).map((f) => ({ id: `cf:${f.key}`, label: f.name })),
  ];
}

export function buildColumns(config: ProjectConfig, phases: Phase[], term: Term): ColumnDef<TaskListItem, unknown>[] {
  const pos = <T extends { id: string }>(list: T[]) => new Map(list.map((x, i) => [x.id, i]));
  const statusPos = pos(config.statuses), prioPos = pos(config.priorities), phasePos = pos(phases);
  const name = (id: string | null) => config.members.find((m) => m.user_id === id)?.full_name ?? "";
  const rank = (m: Map<string, number>) => (id: string | null) => (id ? m.get(id) ?? 999 : 1000);
  const cols: ColumnDef<TaskListItem, unknown>[] = [
    { id: "title", accessorKey: "title", header: term("task", "singular"), meta: { width: 320, label: "Title" } as ColMeta,
      cell: ({ row }) => (
        <span className={`truncate font-medium ${row.original.completed_at ? "text-muted-foreground line-through" : ""}`}>{row.original.title}</span>
      ) },
    { id: "status", accessorFn: (r) => rank(statusPos)(r.status_id), header: "Status", meta: { width: 140, label: "Status" } as ColMeta,
      cell: ({ row }) => { const s = config.statuses.find((x) => x.id === row.original.status_id);
        return s ? <span className="flex items-center gap-2 truncate"><Dot color={s.color} />{s.name}</span> : null; } },
    { id: "priority", accessorFn: (r) => rank(prioPos)(r.priority_id), header: "Priority", meta: { width: 120, label: "Priority" } as ColMeta,
      cell: ({ row }) => { const p = config.priorities.find((x) => x.id === row.original.priority_id);
        return p ? <span className="flex items-center gap-2 truncate"><Dot color={p.color} />{p.name}</span> : <Muted />; } },
    { id: "assignee", accessorFn: (r) => name(r.assignee_id) || "\uffff", header: "Assignee", meta: { width: 170, label: "Assignee" } as ColMeta,
      cell: ({ row }) => row.original.assignee_id
        ? <span className="flex min-w-0 items-center gap-2"><PersonAvatar name={name(row.original.assignee_id)} /><span className="truncate">{name(row.original.assignee_id)}</span></span>
        : <Muted /> },
    { id: "reporter", accessorFn: (r) => name(r.reporter_id) || "\uffff", header: "Reporter", meta: { width: 150, label: "Reporter" } as ColMeta,
      cell: ({ row }) => <span className="truncate">{name(row.original.reporter_id) || "—"}</span> },
    { id: "phase", accessorFn: (r) => rank(phasePos)(r.phase_id), header: term("phase", "singular"), meta: { width: 150, label: "Phase" } as ColMeta,
      cell: ({ row }) => <span className="truncate">{phases.find((p) => p.id === row.original.phase_id)?.name ?? "—"}</span> },
    { id: "labels", accessorFn: (r) => r.label_ids.length, header: "Labels", meta: { width: 180, label: "Labels" } as ColMeta,
      cell: ({ row }) => <LabelChips ids={row.original.label_ids} labels={config.labels} max={2} /> },
    dateCol("start_date", "Start"),
    { id: "due_date", accessorFn: (r) => r.due_date ?? "9999", header: "Due", meta: { width: 100, label: "Due" } as ColMeta,
      cell: ({ row }) => row.original.due_date
        ? <span className={isOverdue(row.original.due_date, row.original.completed_at) ? "font-medium text-destructive" : ""}>{formatDate(row.original.due_date)}</span>
        : <Muted /> },
    { id: "estimate_hours", accessorFn: (r) => r.estimate_hours ?? -1, header: "Estimate (h)", meta: { width: 110, label: "Estimate" } as ColMeta,
      cell: ({ row }) => <span className="tabular-nums">{row.original.estimate_hours ?? "—"}</span> },
    { id: "updated_at", accessorKey: "updated_at", header: "Updated", meta: { width: 110, label: "Updated" } as ColMeta,
      cell: ({ row }) => <span>{new Date(row.original.updated_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span> },
  ];
  for (const f of config.customFields.filter((x) => !x.archived)) {
    const def: CustomFieldDef = { id: f.id, key: f.key, name: f.name, type: f.type, options: f.options, required: f.required };
    cols.push({
      id: `cf:${f.key}`, header: f.name, meta: { width: 160, label: f.name } as ColMeta,
      accessorFn: (r) => cfSortValue((r.custom_fields as Record<string, unknown> | null)?.[f.key]),
      cell: ({ row }) => <span className="truncate"><CustomFieldValue def={def} value={(row.original.custom_fields as Record<string, unknown> | null)?.[f.key]} members={config.members} /></span>,
    });
  }
  return cols;
}

function dateCol(id: "start_date", label: string): ColumnDef<TaskListItem, unknown> {
  return { id, accessorFn: (r) => r[id] ?? "9999", header: label, meta: { width: 100, label } as ColMeta,
    cell: ({ row }) => (row.original[id] ? <span>{formatDate(row.original[id])}</span> : <Muted />) };
}

function cfSortValue(v: unknown): string | number {
  if (v === undefined || v === null || v === "") return "\uffff";
  if (typeof v === "number") return v;
  if (Array.isArray(v)) return v.join(", ");
  return String(v).toLowerCase();
}

function Muted() {
  return <span className="text-muted-foreground">—</span>;
}
