import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveTerminology, type ProjectConfig } from "@/functions/config.functions";
import { useConfigMutation } from "@/lib/config/use-config";
import { DEFAULT_TERMS, EDITABLE_TERM_KEYS, resolveTerm, type EditableTermKey } from "@/lib/terminology/defaults";

type Row = { key: EditableTermKey; singular: string; plural: string };

export function TerminologyTab({ terms }: { terms: ProjectConfig["terms"] }) {
  const initial = (): Row[] =>
    EDITABLE_TERM_KEYS.map((key) => ({ key, singular: resolveTerm(terms, key, "singular"), plural: resolveTerm(terms, key, "plural") }));
  const [rows, setRows] = useState<Row[]>(initial);
  useEffect(() => setRows(initial()), [terms]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useConfigMutation(saveTerminology, "Terminology saved");
  const err = (v: string) => (!v.trim() ? "Required" : v.trim().length > 40 ? "40 characters max" : null);
  const invalid = rows.some((r) => err(r.singular) || err(r.plural));
  const dirty = JSON.stringify(rows) !== JSON.stringify(initial());
  const set = (i: number, f: "singular" | "plural", v: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [f]: v } : r)));

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Terminology</h2>
        <p className="text-sm text-muted-foreground">Rename things to match how your team talks, e.g. Task → Story, Milestone → Gate.</p>
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); if (!invalid) save.mutate({ terms: rows.map((r) => ({ ...r, singular: r.singular.trim(), plural: r.plural.trim() })) }); }}
        className="space-y-4"
      >
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="hidden grid-cols-[1fr_1fr_1fr] gap-3 border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground sm:grid">
            <span>Default</span><span>Singular</span><span>Plural</span>
          </div>
          {rows.map((r, i) => (
            <div key={r.key} className="grid grid-cols-2 gap-3 border-b px-4 py-3 last:border-0 sm:grid-cols-[1fr_1fr_1fr]">
              <span className="col-span-2 self-center text-sm font-medium sm:col-span-1">{DEFAULT_TERMS[r.key].singular}</span>
              {(["singular", "plural"] as const).map((f) => (
                <div key={f}>
                  <Input aria-label={`${DEFAULT_TERMS[r.key].singular} ${f}`} value={r[f]} onChange={(e) => set(i, f, e.target.value)} aria-invalid={!!err(r[f])} />
                  {err(r[f]) && <p className="mt-1 text-xs text-destructive">{err(r[f])}</p>}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={invalid || !dirty || save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" />} Save terminology
          </Button>
          <Button type="button" variant="outline" disabled={!dirty || save.isPending} onClick={() => setRows(initial())}>Reset</Button>
        </div>
      </form>
    </section>
  );
}
