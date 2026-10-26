import { useEffect, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import type { ProjectConfig } from "@/functions/config.functions";
import type { Phase } from "@/functions/phases.functions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useQuery } from "@tanstack/react-query";
import { milestonesQuery } from "@/lib/milestones/queries";
import { activeFilterCount, NO_ASSIGNEE, NO_MILESTONE, type TaskFilters } from "@/lib/tasks/view-params";
import { useTerm } from "@/lib/terminology/use-term";
import { Dot, PickOne } from "./shared";

type Opt = { value: string; label: string; color?: string };

export function TaskFilterBar({ filters, config, phases, onChange }: {
  filters: TaskFilters; config: ProjectConfig; phases: Phase[]; onChange: (patch: Partial<TaskFilters>) => void;
}) {
  const term = useTerm();
  const milestones = useQuery(milestonesQuery);
  const [q, setQ] = useState(filters.q);
  useEffect(() => setQ(filters.q), [filters.q]);
  useEffect(() => {
    if (q === filters.q) return;
    const t = setTimeout(() => onChange({ q }), 300);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const count = activeFilterCount(filters);
  return (
    <div className="flex flex-wrap items-center gap-2" role="search">
      <div className="relative w-full sm:w-64">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label={`Search ${term("task").toLowerCase()}`} placeholder="Search title and description" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 pl-9" />
      </div>
      <Multi label="Status" value={filters.status} onChange={(status) => onChange({ status })}
        options={config.statuses.map((s) => ({ value: s.id, label: s.name, color: s.color }))} />
      <Multi label="Assignee" value={filters.assignee} onChange={(assignee) => onChange({ assignee })}
        options={[{ value: NO_ASSIGNEE, label: "Unassigned" }, ...config.members.map((m) => ({ value: m.user_id, label: m.full_name }))]} />
      <Multi label="Priority" value={filters.priority} onChange={(priority) => onChange({ priority })}
        options={config.priorities.map((p) => ({ value: p.id, label: p.name, color: p.color }))} />
      <Multi label="Label" value={filters.label} onChange={(label) => onChange({ label })}
        options={config.labels.map((l) => ({ value: l.id, label: l.name, color: l.color }))} />
      <Multi label={term("phase", "singular")} value={filters.phase} onChange={(phase) => onChange({ phase })}
        options={phases.map((p) => ({ value: p.id, label: p.name }))} />
      <Multi label={term("milestone", "singular")} value={filters.milestone} onChange={(milestone) => onChange({ milestone })}
        options={[{ value: NO_MILESTONE, label: `No ${term("milestone", "singular").toLowerCase()}` }, ...(milestones.data ?? []).map((m) => ({ value: m.id, label: m.name }))]} />
      <DueFilter filters={filters} onChange={onChange} />
      <CustomFieldFilter filters={filters} config={config} onChange={onChange} />
      {count > 0 && (
        <Button variant="ghost" size="sm" onClick={() => onChange({ q: "", status: [], assignee: [], priority: [], label: [], phase: [], milestone: [], dueFrom: undefined, dueTo: undefined, overdue: false, cf: {} })}>
          <X className="size-4" /> Clear ({count})
        </Button>
      )}
    </div>
  );
}

function Trigger({ label, active }: { label: string; active: number | boolean }) {
  return (
    <PopoverTrigger asChild>
      <Button variant={active ? "secondary" : "outline"} size="sm" className="h-9">
        {label}{typeof active === "number" && active > 0 ? ` · ${active}` : ""}<ChevronDown className="size-3.5 opacity-60" />
      </Button>
    </PopoverTrigger>
  );
}

function Multi({ label, value, options, onChange }: { label: string; value: string[]; options: Opt[]; onChange: (v: string[]) => void }) {
  return (
    <Popover>
      <Trigger label={label} active={value.length} />
      <PopoverContent align="start" className="w-60 p-2">
        {options.length === 0 ? <p className="p-2 text-xs text-muted-foreground">Nothing to filter yet.</p> : (
          <ul className="max-h-64 space-y-0.5 overflow-y-auto">
            {options.map((o) => {
              const id = `f-${label}-${o.value}`;
              const on = value.includes(o.value);
              return (
                <li key={o.value}>
                  <label htmlFor={id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                    <Checkbox id={id} checked={on} onCheckedChange={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])} />
                    {o.color && <Dot color={o.color} />}<span className="truncate">{o.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        {value.length > 0 && <Button variant="ghost" size="sm" className="mt-1 w-full" onClick={() => onChange([])}>Clear</Button>}
      </PopoverContent>
    </Popover>
  );
}

function DueFilter({ filters, onChange }: { filters: TaskFilters; onChange: (p: Partial<TaskFilters>) => void }) {
  const n = [filters.dueFrom, filters.dueTo, filters.overdue].filter(Boolean).length;
  return (
    <Popover>
      <Trigger label="Due" active={n} />
      <PopoverContent align="start" className="w-64 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1"><Label htmlFor="due-from" className="text-xs">From</Label>
            <Input id="due-from" type="date" value={filters.dueFrom ?? ""} onChange={(e) => onChange({ dueFrom: e.target.value || undefined })} className="h-9" /></div>
          <div className="space-y-1"><Label htmlFor="due-to" className="text-xs">To</Label>
            <Input id="due-to" type="date" value={filters.dueTo ?? ""} onChange={(e) => onChange({ dueTo: e.target.value || undefined })} className="h-9" /></div>
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="overdue">Overdue only</Label>
          <Switch id="overdue" checked={filters.overdue} onCheckedChange={(overdue) => onChange({ overdue })} />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CustomFieldFilter({ filters, config, onChange }: { filters: TaskFilters; config: ProjectConfig; onChange: (p: Partial<TaskFilters>) => void }) {
  const defs = config.customFields.filter((f) => !f.archived);
  const [key, setKey] = useState<string | null>(null);
  const [val, setVal] = useState("");
  if (!defs.length) return null;
  const def = defs.find((d) => d.key === key);
  const set = (k: string, v: string | null) => {
    const cf = { ...filters.cf };
    if (v) cf[k] = v; else delete cf[k];
    onChange({ cf });
  };
  const choices: Opt[] | null = !def ? null
    : def.type === "dropdown" || def.type === "multi_select" ? def.options.map((o) => ({ value: o, label: o }))
    : def.type === "checkbox" ? [{ value: "true", label: "Yes" }, { value: "false", label: "No" }]
    : def.type === "user" ? config.members.map((m) => ({ value: m.user_id, label: m.full_name }))
    : null;
  return (
    <Popover>
      <Trigger label="Custom field" active={Object.keys(filters.cf).length} />
      <PopoverContent align="start" className="w-72 space-y-3">
        {Object.entries(filters.cf).map(([k, v]) => {
          const d = defs.find((x) => x.key === k);
          const shown = d?.type === "user" ? config.members.find((m) => m.user_id === v)?.full_name ?? v : d?.type === "checkbox" ? (v === "true" ? "Yes" : "No") : v;
          return (
            <div key={k} className="flex items-center justify-between gap-2 rounded bg-secondary px-2 py-1 text-xs">
              <span className="truncate">{d?.name ?? k}: {shown}</span>
              <button type="button" aria-label={`Remove ${d?.name ?? k} filter`} onClick={() => set(k, null)}><X className="size-3.5" /></button>
            </div>
          );
        })}
        <PickOne id="cf-field" label="Field" value={key} onChange={(k) => { setKey(k); setVal(""); }} allowNone noneLabel="Choose a field"
          options={defs.map((d) => ({ value: d.key, label: d.name }))} />
        {def && (choices
          ? <PickOne id="cf-value" label="Value" value={val || null} onChange={(v) => setVal(v ?? "")} allowNone noneLabel="Choose a value" options={choices} />
          : <Input aria-label="Value" type={def.type === "number" ? "number" : def.type === "date" ? "date" : "text"} value={val} onChange={(e) => setVal(e.target.value)} className="h-9" placeholder="Value" />)}
        <Button size="sm" className="w-full" disabled={!def || !val} onClick={() => { if (def) set(def.key, val); setKey(null); setVal(""); }}>Add filter</Button>
      </PopoverContent>
    </Popover>
  );
}
