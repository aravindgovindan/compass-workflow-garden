import { RecordTabs } from "@/components/collaboration/record-tabs";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { InlineName } from "@/components/settings/inline-name";
import { PickOne } from "@/components/tasks/shared";
import type { ProjectConfig } from "@/functions/config.functions";
import type { IssueDetail } from "@/functions/issues.functions";
import { issueQuery, useDeleteIssue, useRegisterSaving, useUpdateIssue } from "@/lib/registers/queries";
import { ISSUE_SEVERITIES, ISSUE_STATUSES } from "@/lib/risks/score";
import { useTerm } from "@/lib/terminology/use-term";
import { Field, label, LevelBadge, RecordCustomFields, SaveOnBlur, StatusPill } from "./shared";
import { RecordSheet } from "./record-sheet";

export function IssueDrawer({ id, config, canEdit, onClose }: { id: string | undefined; config: ProjectConfig; canEdit: boolean; onClose: () => void }) {
  const term = useTerm();
  const q = useQuery({ ...issueQuery(id ?? ""), enabled: !!id });
  const saving = useRegisterSaving("issue", id ?? "");
  const del = useDeleteIssue();
  return (
    <RecordSheet open={!!id} onClose={onClose} kind={term("issue", "singular")} title={q.data?.title}
      state={q.isPending ? "loading" : q.error || !q.data ? "error" : "ready"} saving={saving} readOnly={!canEdit}
      onRetry={() => q.refetch()} onDelete={() => id && del.mutate(id, { onSuccess: onClose })}>
      {q.data && <RecordTabs entityType="issue" entityId={q.data.id}><Body key={q.data.id} x={q.data} config={config} canEdit={canEdit} /></RecordTabs>}
    </RecordSheet>
  );
}

function Body({ x, config, canEdit }: { x: IssueDetail; config: ProjectConfig; canEdit: boolean }) {
  const term = useTerm();
  const update = useUpdateIssue(x.id);
  const save = (patch: Parameters<typeof update.mutate>[0]) => update.mutate(patch);
  const ro = !canEdit;
  const people = config.members.map((m) => ({ value: m.user_id, label: m.full_name }));
  return (
    <div className="space-y-4">
      <InlineName label="Title" value={x.title} max={200} disabled={ro} onSave={(title) => save({ title })} />
      <div className="flex flex-wrap items-center gap-2 text-sm"><LevelBadge value={x.severity} /><StatusPill value={x.status} /></div>
      {x.source_risk && (
        <p className="text-xs text-muted-foreground">
          From {term("risk", "singular").toLowerCase()}:{" "}
          <Link to="/risks" search={{ item: x.source_risk.id } as never} className="text-primary hover:underline">{x.source_risk.title}</Link>
        </p>
      )}
      <Field label="Description" htmlFor="i-desc">
        <SaveOnBlur id="i-desc" multiline max={10000} disabled={ro} value={x.description ?? ""} onSave={(description) => save({ description })} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status" htmlFor="i-status">
          <PickOne id="i-status" label="Status" disabled={ro} value={x.status} onChange={(v) => v && save({ status: v as IssueDetail["status"] })}
            options={ISSUE_STATUSES.map((s) => ({ value: s, label: label(s) }))} />
        </Field>
        <Field label="Severity" htmlFor="i-sev">
          <PickOne id="i-sev" label="Severity" disabled={ro} value={x.severity} onChange={(v) => v && save({ severity: v as IssueDetail["severity"] })}
            options={ISSUE_SEVERITIES.map((s) => ({ value: s, label: label(s) }))} />
        </Field>
        <Field label="Owner" htmlFor="i-owner">
          <PickOne id="i-owner" label="Owner" disabled={ro} value={x.owner_id} allowNone noneLabel="No owner" onChange={(v) => save({ owner_id: v })} options={people} />
        </Field>
        <Field label="Raised by" htmlFor="i-raised">
          <PickOne id="i-raised" label="Raised by" disabled={ro} value={x.raised_by} allowNone onChange={(v) => save({ raised_by: v })} options={people} />
        </Field>
        <Field label="Target date" htmlFor="i-target">
          <Input id="i-target" type="date" className="h-9" disabled={ro} value={x.target_date ?? ""} onChange={(e) => save({ target_date: e.target.value || null })} />
        </Field>
        <Field label="Category" htmlFor="i-cat">
          <SaveOnBlur id="i-cat" max={60} disabled={ro} value={x.category ?? ""} placeholder="e.g. Supplier" onSave={(category) => save({ category })} />
        </Field>
      </div>
      <Field label="Resolution" htmlFor="i-res">
        <SaveOnBlur id="i-res" multiline max={10000} disabled={ro} value={x.resolution ?? ""} onSave={(resolution) => save({ resolution })} />
      </Field>
      <RecordCustomFields entity="issue" stored={(x.custom_fields ?? {}) as Record<string, unknown>} config={config} readOnly={ro}
        onSave={(custom_fields) => save({ custom_fields })} />
    </div>
  );
}
