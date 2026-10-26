import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InlineName } from "@/components/settings/inline-name";
import { PickOne } from "@/components/tasks/shared";
import type { ProjectConfig } from "@/functions/config.functions";
import type { RiskDetail } from "@/functions/risks.functions";
import { riskQuery, useConvertRisk, useDeleteRisk, useRegisterSaving, useUpdateRisk } from "@/lib/registers/queries";
import { canConvertRisk, ISSUE_SEVERITIES, RISK_STATUSES, riskScore, severityForRating, type IssueSeverity } from "@/lib/risks/score";
import { useTerm } from "@/lib/terminology/use-term";
import { Field, label, LevelBadge, RecordCustomFields, SaveOnBlur, StatusPill } from "./shared";
import { RecordSheet } from "./record-sheet";

const LEVELS = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }));

export function RiskDrawer({ id, config, canEdit, onClose, onConverted }: {
  id: string | undefined; config: ProjectConfig; canEdit: boolean; onClose: () => void; onConverted: (issueId: string) => void;
}) {
  const term = useTerm();
  const q = useQuery({ ...riskQuery(id ?? ""), enabled: !!id });
  const saving = useRegisterSaving("risk", id ?? "");
  const del = useDeleteRisk();
  return (
    <RecordSheet open={!!id} onClose={onClose} kind={term("risk", "singular")} title={q.data?.title}
      state={q.isPending ? "loading" : q.error || !q.data ? "error" : "ready"} saving={saving} readOnly={!canEdit}
      onRetry={() => q.refetch()} onDelete={() => id && del.mutate(id, { onSuccess: onClose })}>
      {q.data && <Body key={q.data.id} r={q.data} config={config} canEdit={canEdit} onConverted={onConverted} />}
    </RecordSheet>
  );
}

function Body({ r, config, canEdit, onConverted }: { r: RiskDetail; config: ProjectConfig; canEdit: boolean; onConverted: (id: string) => void }) {
  const term = useTerm();
  const update = useUpdateRisk(r.id);
  const save = (patch: Parameters<typeof update.mutate>[0]) => update.mutate(patch);
  const ro = !canEdit;
  const people = config.members.map((m) => ({ value: m.user_id, label: m.full_name }));
  const { score, rating } = riskScore(r.probability, r.impact);
  return (
    <div className="space-y-4">
      <InlineName label="Title" value={r.title} max={200} disabled={ro} onSave={(title) => save({ title })} />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Score</span><span className="font-semibold tabular-nums">{score}</span>
        <LevelBadge value={rating} /><StatusPill value={r.status} />
      </div>
      <Field label="Description" htmlFor="r-desc">
        <SaveOnBlur id="r-desc" multiline max={10000} disabled={ro} value={r.description ?? ""} onSave={(description) => save({ description })} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status" htmlFor="r-status">
          <PickOne id="r-status" label="Status" disabled={ro} value={r.status} onChange={(v) => v && save({ status: v as RiskDetail["status"] })}
            options={RISK_STATUSES.map((s) => ({ value: s, label: label(s) }))} />
        </Field>
        <Field label="Owner" htmlFor="r-owner">
          <PickOne id="r-owner" label="Owner" disabled={ro} value={r.owner_id} allowNone noneLabel="No owner" onChange={(v) => save({ owner_id: v })} options={people} />
        </Field>
        <Field label="Probability (1–5)" htmlFor="r-prob">
          <PickOne id="r-prob" label="Probability" disabled={ro} value={String(r.probability)} onChange={(v) => v && save({ probability: Number(v) })} options={LEVELS} />
        </Field>
        <Field label="Impact (1–5)" htmlFor="r-impact">
          <PickOne id="r-impact" label="Impact" disabled={ro} value={String(r.impact)} onChange={(v) => v && save({ impact: Number(v) })} options={LEVELS} />
        </Field>
        <Field label="Category" htmlFor="r-cat">
          <SaveOnBlur id="r-cat" max={60} disabled={ro} value={r.category ?? ""} placeholder="e.g. Technical" onSave={(category) => save({ category })} />
        </Field>
        <Field label="Review date" htmlFor="r-review">
          <Input id="r-review" type="date" className="h-9" disabled={ro} value={r.review_date ?? ""} onChange={(e) => save({ review_date: e.target.value || null })} />
        </Field>
      </div>
      <Field label="Mitigation plan" htmlFor="r-mit">
        <SaveOnBlur id="r-mit" multiline max={10000} disabled={ro} value={r.mitigation_plan ?? ""} onSave={(mitigation_plan) => save({ mitigation_plan })} />
      </Field>
      <RecordCustomFields entity="risk" stored={(r.custom_fields ?? {}) as Record<string, unknown>} config={config} readOnly={ro}
        onSave={(custom_fields) => save({ custom_fields })} />
      {r.issues.length > 0 && (
        <div className="space-y-1.5 border-t pt-4">
          <p className="text-xs text-muted-foreground">Became {term("issue", r.issues.length === 1 ? "singular" : "plural").toLowerCase()}</p>
          <ul className="space-y-1">
            {r.issues.map((i) => (
              <li key={i.id}><Link to="/issues" search={{ item: i.id } as never} className="text-sm text-primary hover:underline">{i.title}</Link> <StatusPill value={i.status} /></li>
            ))}
          </ul>
        </div>
      )}
      {canEdit && canConvertRisk(r, r.issues.length) && <Convert risk={r} onConverted={onConverted} />}
    </div>
  );
}

function Convert({ risk, onConverted }: { risk: RiskDetail; onConverted: (id: string) => void }) {
  const term = useTerm();
  const issue = term("issue", "singular").toLowerCase();
  const [open, setOpen] = useState(false);
  const [severity, setSeverity] = useState<IssueSeverity>(severityForRating(risk.rating));
  const convert = useConvertRisk();
  return (
    <div className="border-t pt-4">
      <Button variant="outline" onClick={() => setOpen(true)}><AlertTriangle className="size-4" />Convert to {issue}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert to {issue}?</DialogTitle>
            <DialogDescription>
              Creates a new {issue} with this {term("risk", "singular").toLowerCase()}'s title, description and owner, and marks it as Occurred.
            </DialogDescription>
          </DialogHeader>
          <Field label="Severity" htmlFor="cv-sev">
            <PickOne id="cv-sev" label="Severity" value={severity} onChange={(v) => v && setSeverity(v as IssueSeverity)}
              options={ISSUE_SEVERITIES.map((s) => ({ value: s, label: label(s) }))} />
          </Field>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={convert.isPending} onClick={() => convert.mutate({ id: risk.id, severity }, {
              onSuccess: (res) => { setOpen(false); onConverted(res.issueId); },
            })}>{convert.isPending ? "Converting…" : "Convert"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
