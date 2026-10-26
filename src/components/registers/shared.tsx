import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CustomFieldInput } from "@/components/custom-fields/custom-field-input";
import { CustomFieldValue } from "@/components/custom-fields/custom-field-value";
import type { ProjectConfig } from "@/functions/config.functions";
import type { CustomFieldEntity } from "@/lib/custom-fields/types";
import { validateCustomValues } from "@/lib/custom-fields/validate";
import { ENUM_LABELS, type RiskRating } from "@/lib/risks/score";
import { cn } from "@/lib/utils";

export const label = (v: string | null | undefined) => (v ? ENUM_LABELS[v] ?? v : "");

/** Badge colors for a rating or severity band. */
export const LEVEL_CLASS: Record<RiskRating, string> = {
  low: "bg-health-green-soft text-health-green",
  medium: "bg-health-amber-soft text-foreground",
  high: "bg-health-red-soft text-health-red",
  critical: "bg-health-red text-primary-foreground",
};

export function LevelBadge({ value, prefix }: { value: string; prefix?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium", LEVEL_CLASS[value as RiskRating])}>
      {prefix}{label(value)}
    </span>
  );
}

export function StatusPill({ value }: { value: string }) {
  return <span className="inline-flex rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">{label(value)}</span>;
}

export function Field({ label: l, htmlFor, children, className }: { label: string; htmlFor?: string; children: ReactNode; className?: string }) {
  return <div className={cn("space-y-1.5", className)}><Label htmlFor={htmlFor} className="text-xs text-muted-foreground">{l}</Label>{children}</div>;
}

/** Text that saves on blur (empty saves null). */
export function SaveOnBlur({ id, value, onSave, max, multiline, disabled, placeholder }: {
  id: string; value: string; onSave: (v: string | null) => void; max: number; multiline?: boolean; disabled?: boolean; placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const tooLong = draft.length > max;
  const commit = () => { if (!tooLong && draft.trim() !== value) onSave(draft.trim() || null); };
  const props = { id, value: draft, disabled: disabled ?? false, placeholder, "aria-invalid": tooLong, onBlur: commit };
  return (
    <div>
      {multiline ? <Textarea {...props} rows={3} onChange={(e) => setDraft(e.target.value)} />
        : <Input {...props} className="h-9" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />}
      {tooLong && <p className="mt-1 text-xs text-destructive">{max} characters max</p>}
    </div>
  );
}

/** Configured custom fields for a risk or issue: editable with auto-save, or read-only. The server re-validates. */
export function RecordCustomFields({ entity, stored, config, readOnly, onSave }: {
  entity: CustomFieldEntity; stored: Record<string, unknown>; config: ProjectConfig; readOnly: boolean; onSave: (patch: Record<string, unknown>) => void;
}) {
  const defs = config.customFields.filter((d) => d.entity_type === entity && !d.archived);
  const [draft, setDraft] = useState(stored);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);
  if (defs.length === 0) return null;
  if (readOnly) {
    return (
      <dl className="grid gap-3 border-t pt-4 sm:grid-cols-2">
        {defs.map((d) => (
          <div key={d.id}><dt className="text-xs text-muted-foreground">{d.name}</dt><dd className="text-sm"><CustomFieldValue def={d} value={stored[d.key]} members={config.members} /></dd></div>
        ))}
      </dl>
    );
  }
  const memberIds = config.members.map((m) => m.user_id);
  function change(key: string, value: unknown) {
    const next = { ...draft, [key]: value };
    setDraft(next);
    const def = defs.find((d) => d.key === key)!;
    const r = validateCustomValues([def], next, { memberIds });
    setErrors((e) => { const c = { ...e }; if (r.errors[key]) c[key] = r.errors[key]; else delete c[key]; return c; });
    clearTimeout(timers.current[key]);
    if (r.errors[key]) return;
    timers.current[key] = setTimeout(() => onSave({ [key]: value === "" ? null : value }),
      ["text", "long_text", "number", "url"].includes(def.type) ? 700 : 0);
  }
  return (
    <div className="space-y-4 border-t pt-4">
      {defs.map((d) => (
        <CustomFieldInput key={d.id} def={d} value={draft[d.key] ?? (d.type === "multi_select" ? [] : d.type === "checkbox" ? false : "")}
          onChange={(v) => change(d.key, v)} members={config.members} error={errors[d.key]} />
      ))}
    </div>
  );
}

export type Col<T> = { key: string; label: string; sort?: string; className?: string; cell: (r: T) => ReactNode };

/** Sortable list with a sticky header; rows open the detail drawer. */
export function RegisterTable<T extends { id: string; title: string }>({ rows, cols, sort, dir, onSort, onOpen, caption }: {
  rows: T[]; cols: Col<T>[]; sort: string; dir: "asc" | "desc"; onSort: (sort: string, dir: "asc" | "desc") => void; onOpen: (id: string) => void; caption: string;
}) {
  return (
    <div className="max-h-[70vh] overflow-auto rounded-lg border bg-card">
      <table className="w-full min-w-[640px] text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 z-10 bg-muted/95 text-left text-xs text-muted-foreground backdrop-blur">
          <tr>
            {cols.map((c) => {
              const active = c.sort === sort;
              return (
                <th key={c.key} scope="col" aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined} className={cn("px-3 py-2 font-medium", c.className)}>
                  {c.sort ? (
                    <button type="button" className="inline-flex items-center gap-1 hover:text-foreground"
                      onClick={() => onSort(c.sort!, active && dir === "desc" ? "asc" : "desc")}>
                      {c.label}{active ? (dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ChevronsUpDown className="size-3 opacity-50" />}
                    </button>
                  ) : c.label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="cursor-pointer border-t hover:bg-muted/50" onClick={() => onOpen(r.id)}>
              {cols.map((c, i) => (
                <td key={c.key} className={cn("px-3 py-2 align-middle", c.className)}>
                  {i === 0 ? (
                    <button type="button" className="text-left font-medium hover:underline focus-visible:underline" onClick={(e) => { e.stopPropagation(); onOpen(r.id); }}>
                      {r.title}
                    </button>
                  ) : c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
