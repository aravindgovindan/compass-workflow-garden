import { RecordTabs } from "@/components/collaboration/record-tabs";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpLeft, Tag, Trash2, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/empty-state";
import { CustomFieldInput } from "@/components/custom-fields/custom-field-input";
import { InlineName } from "@/components/settings/inline-name";
import { SavingNote } from "@/components/settings/shared";
import type { ProjectConfig } from "@/functions/config.functions";
import type { Phase } from "@/functions/phases.functions";
import type { TaskDetail } from "@/functions/tasks.functions";
import { validateCustomValues } from "@/lib/custom-fields/validate";
import { taskDetailQuery, useDeleteTask, useTaskLabels, useTaskSaving, useUpdateTask } from "@/lib/tasks/queries";
import { useTerm } from "@/lib/terminology/use-term";
import { milestonesQuery } from "@/lib/milestones/queries";
import { Dot, PickOne } from "./shared";
import { QuickAdd } from "./quick-add";
import { Checklist } from "./checklist";

export function TaskDrawer({ taskId, config, phases, onOpen, onClose }: {
  taskId: string | undefined; config: ProjectConfig; phases: Phase[]; onOpen: (id: string) => void; onClose: () => void;
}) {
  const term = useTerm();
  return (
    <Sheet modal={false} open={!!taskId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {taskId ? <Body key={taskId} id={taskId} config={config} phases={phases} onOpen={onOpen} onClose={onClose} /> : (
          <SheetHeader><SheetTitle>{term("task", "singular")}</SheetTitle></SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Body({ id, config, phases, onOpen, onClose }: {
  id: string; config: ProjectConfig; phases: Phase[]; onOpen: (id: string) => void; onClose: () => void;
}) {
  const term = useTerm();
  const q = useQuery(taskDetailQuery(id));
  const saving = useTaskSaving(id);
  if (q.isPending) {
    return (
      <div className="space-y-4 p-4">
        <SheetHeader className="p-0"><SheetTitle className="sr-only">Loading</SheetTitle><SheetDescription className="sr-only">Loading</SheetDescription></SheetHeader>
        <Skeleton className="h-9 w-3/4" /><Skeleton className="h-24 w-full" /><Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (q.error || !q.data) {
    return (
      <div className="p-4">
        <SheetHeader className="p-0"><SheetTitle>{term("task", "singular")}</SheetTitle><SheetDescription className="sr-only">Error</SheetDescription></SheetHeader>
        <ErrorState message={q.error?.message ?? "Could not load this item."} onRetry={() => q.refetch()} />
      </div>
    );
  }
  const t = q.data;
  const kind = t.parent_task_id ? term("subtask", "singular") : term("task", "singular");
  return (
    <div className="space-y-6 p-4">
      <SheetHeader className="space-y-2 p-0">
        <div className="flex items-center justify-between gap-2 pr-8">
          <SheetDescription className="text-xs uppercase tracking-wide">{kind}</SheetDescription>
          <SavingNote saving={saving} />
        </div>
        {t.parent && (
          <button type="button" onClick={() => t.parent && onOpen(t.parent.id)} className="flex items-center gap-1 text-left text-xs text-primary hover:underline">
            <ArrowUpLeft className="size-3.5" />{t.parent.title}
          </button>
        )}
        <SheetTitle className="sr-only">{t.title}</SheetTitle>
      </SheetHeader>
      <RecordTabs entityType="task" entityId={t.id}>
      <Fields task={t} config={config} phases={phases} />
      {!t.parent_task_id && <Subtasks task={t} config={config} onOpen={onOpen} />}
      <Checklist task={t} />
      </RecordTabs>
      <DeleteTask task={t} onDeleted={() => (t.parent_task_id ? onOpen(t.parent_task_id) : onClose())} />
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label htmlFor={htmlFor} className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}

function Fields({ task: t, config, phases }: { task: TaskDetail; config: ProjectConfig; phases: Phase[] }) {
  const term = useTerm();
  const update = useUpdateTask(t.id);
  const milestones = useQuery(milestonesQuery);
  const save = (patch: Parameters<typeof update.mutate>[0]) => update.mutate(patch);
  const people = config.members.map((m) => ({ value: m.user_id, label: m.full_name }));
  return (
    <div className="space-y-4">
      <InlineName label="Title" value={t.title} max={200} onSave={(title) => save({ title })} />
      <Description value={t.description ?? ""} onSave={(description) => save({ description: description || null })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status" htmlFor="f-status">
          <PickOne id="f-status" label="Status" value={t.status_id} onChange={(v) => v && save({ status_id: v })}
            options={config.statuses.map((s) => ({ value: s.id, label: s.name, color: s.color }))} />
        </Field>
        <Field label="Priority" htmlFor="f-priority">
          <PickOne id="f-priority" label="Priority" value={t.priority_id} allowNone onChange={(v) => save({ priority_id: v })}
            options={config.priorities.map((p) => ({ value: p.id, label: p.name, color: p.color }))} />
        </Field>
        <Field label="Assignee" htmlFor="f-assignee">
          <PickOne id="f-assignee" label="Assignee" value={t.assignee_id} allowNone noneLabel="Unassigned" onChange={(v) => save({ assignee_id: v })} options={people} />
        </Field>
        <Field label="Reporter" htmlFor="f-reporter">
          <PickOne id="f-reporter" label="Reporter" value={t.reporter_id} allowNone onChange={(v) => save({ reporter_id: v })} options={people} />
        </Field>
        {!t.parent_task_id && (
          <Field label={term("phase", "singular")} htmlFor="f-phase">
            <PickOne id="f-phase" label={term("phase", "singular")} value={t.phase_id} allowNone onChange={(v) => save({ phase_id: v })}
              options={phases.map((p) => ({ value: p.id, label: p.name }))} />
          </Field>
        )}
        <Field label={term("milestone", "singular")} htmlFor="f-milestone">
          <PickOne id="f-milestone" label={term("milestone", "singular")} value={t.milestone_id} allowNone onChange={(v) => save({ milestone_id: v })}
            options={(milestones.data ?? []).map((m) => ({ value: m.id, label: m.name }))} />
        </Field>
        <Field label="Estimate (hours)" htmlFor="f-estimate">
          <Input id="f-estimate" type="number" min={0} step="0.25" className="h-9" defaultValue={t.estimate_hours ?? ""}
            onBlur={(e) => {
              const v = e.target.value === "" ? null : Number(e.target.value);
              if (v !== null && (!Number.isFinite(v) || v < 0)) return;
              if (v !== (t.estimate_hours === null ? null : Number(t.estimate_hours))) save({ estimate_hours: v });
            }} />
        </Field>
        <Field label="Start date" htmlFor="f-start">
          <Input id="f-start" type="date" className="h-9" defaultValue={t.start_date ?? ""} max={t.due_date ?? undefined}
            onBlur={(e) => { const v = e.target.value || null; if (v !== t.start_date) save({ start_date: v }); }} />
        </Field>
        <Field label="Due date" htmlFor="f-due">
          <Input id="f-due" type="date" className="h-9" defaultValue={t.due_date ?? ""} min={t.start_date ?? undefined}
            onBlur={(e) => { const v = e.target.value || null; if (v !== t.due_date) save({ due_date: v }); }} />
        </Field>
      </div>
      <Labels task={t} config={config} />
      <CustomFields task={t} config={config} />
      {t.completed_at && <p className="text-xs text-muted-foreground">Completed {new Date(t.completed_at).toLocaleString()}</p>}
    </div>
  );
}

function Description({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <Field label="Description" htmlFor="f-desc">
      <Textarea id="f-desc" rows={4} maxLength={10000} value={draft} placeholder="Add details…"
        onChange={(e) => setDraft(e.target.value)} onBlur={() => { if (draft !== value) onSave(draft); }} />
    </Field>
  );
}

function Labels({ task: t, config }: { task: TaskDetail; config: ProjectConfig }) {
  const set = useTaskLabels(t.id);
  const selected = config.labels.filter((l) => t.label_ids.includes(l.id));
  const toggle = (lid: string) =>
    set.mutate(t.label_ids.includes(lid) ? t.label_ids.filter((x) => x !== lid) : [...t.label_ids, lid]);
  return (
    <Field label="Labels">
      <div className="flex flex-wrap items-center gap-1.5">
        {selected.map((l) => (
          <span key={l.id} className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs">
            <Dot color={l.color} />{l.name}
            <button type="button" aria-label={`Remove ${l.name}`} onClick={() => toggle(l.id)} className="rounded hover:text-destructive">
              <X className="size-3" />
            </button>
          </span>
        ))}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7"><Tag className="size-3.5" />Labels</Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2">
            {config.labels.length === 0 ? (
              <p className="p-2 text-xs text-muted-foreground">No labels yet. The owner can add them in Settings.</p>
            ) : (
              <ul className="space-y-1">
                {config.labels.map((l) => (
                  <li key={l.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                      <Checkbox checked={t.label_ids.includes(l.id)} onCheckedChange={() => toggle(l.id)} />
                      <Dot color={l.color} />{l.name}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </Field>
  );
}

/** Custom fields: local draft, validated in the browser, auto-saved after a short pause. The server re-validates. */
function CustomFields({ task: t, config }: { task: TaskDetail; config: ProjectConfig }) {
  const update = useUpdateTask(t.id);
  const defs = config.customFields.filter((d) => d.entity_type === "task" && !d.archived);
  const stored = (t.custom_fields ?? {}) as Record<string, unknown>;
  const [draft, setDraft] = useState<Record<string, unknown>>(stored);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);
  if (defs.length === 0) return null;
  const memberIds = config.members.map((m) => m.user_id);
  function change(key: string, value: unknown) {
    const next = { ...draft, [key]: value };
    setDraft(next);
    const def = defs.find((d) => d.key === key);
    if (!def) return;
    const r = validateCustomValues([def], next, { memberIds });
    setErrors((e) => { const c = { ...e }; if (r.errors[key]) c[key] = r.errors[key]; else delete c[key]; return c; });
    clearTimeout(timers.current[key]);
    if (r.errors[key]) return;
    timers.current[key] = setTimeout(() => {
      update.mutate({ custom_fields: { [key]: value === "" ? null : value } });
    }, def.type === "text" || def.type === "long_text" || def.type === "number" || def.type === "url" ? 700 : 0);
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

function Subtasks({ task: t, config, onOpen }: { task: TaskDetail; config: ProjectConfig; onOpen: (id: string) => void }) {
  const term = useTerm();
  return (
    <section aria-labelledby="subtasks-h" className="space-y-2 border-t pt-4">
      <h3 id="subtasks-h" className="text-sm font-semibold">{term("subtask")} <span className="font-normal text-muted-foreground">({t.subtasks.length})</span></h3>
      {t.subtasks.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {t.subtasks.map((s) => {
            const st = config.statuses.find((x) => x.id === s.status_id);
            return (
              <li key={s.id}>
                <button type="button" onClick={() => onOpen(s.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                  {st && <Dot color={st.color} />}
                  <span className={`flex-1 truncate ${s.completed_at ? "text-muted-foreground line-through" : ""}`}>{s.title}</span>
                  <span className="text-xs text-muted-foreground">{st?.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <QuickAdd parentTaskId={t.id} compact />
    </section>
  );
}

function DeleteTask({ task: t, onDeleted }: { task: TaskDetail; onDeleted: () => void }) {
  const term = useTerm();
  const del = useDeleteTask();
  const [open, setOpen] = useState(false);
  const kind = (t.parent_task_id ? term("subtask", "singular") : term("task", "singular")).toLowerCase();
  const subs = t.subtasks.length;
  return (
    <div className="border-t pt-4">
      <Button variant="outline" size="sm" className="text-destructive" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" />Delete {kind}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {kind}?</AlertDialogTitle>
            <AlertDialogDescription>
              {subs > 0
                ? `Its ${subs} ${term("subtask", subs === 1 ? "singular" : "plural").toLowerCase()} will be deleted too. This can't be undone.`
                : "This can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                const r = await del.mutateAsync({ id: t.id, confirmSubtasks: true }).catch(() => null);
                if (r?.deleted) { setOpen(false); onDeleted(); }
              }}
            >
              {del.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
