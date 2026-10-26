import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PickOne } from "@/components/tasks/shared";
import type { ProjectConfig } from "@/functions/config.functions";
import type { MilestoneItem } from "@/functions/milestones.functions";
import { milestoneCreate } from "@/lib/schemas/milestones";
import { MILESTONE_STATUSES, MILESTONE_STATUS_LABEL, type MilestoneStatus } from "@/lib/milestones/status";
import { useCreateMilestone, useUpdateMilestone } from "@/lib/milestones/queries";
import { useTerm } from "@/lib/terminology/use-term";

export function MilestoneForm({ open, onOpenChange, milestone, config, isOwner }: {
  open: boolean; onOpenChange: (o: boolean) => void; milestone?: MilestoneItem; config: ProjectConfig; isOwner: boolean;
}) {
  const term = useTerm();
  const one = term("milestone", "singular");
  const [name, setName] = useState(milestone?.name ?? "");
  const [description, setDescription] = useState(milestone?.description ?? "");
  const [date, setDate] = useState(milestone?.target_date ?? "");
  const [owner, setOwner] = useState<string | null>(milestone?.owner_id ?? null);
  const [override, setOverride] = useState<MilestoneStatus | null>(milestone?.status_override ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const create = useCreateMilestone();
  const update = useUpdateMilestone();
  const pending = create.isPending || update.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = { name, description: description || null, target_date: date, owner_id: owner,
      ...(isOwner ? { status_override: override } : {}) };
    const r = milestoneCreate.safeParse(input);
    if (!r.success) {
      setErrors(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    const done = { onSuccess: () => onOpenChange(false) };
    if (milestone) update.mutate({ id: milestone.id, ...r.data }, done);
    else create.mutate(r.data, done);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{milestone ? `Edit ${one.toLowerCase()}` : `New ${one.toLowerCase()}`}</DialogTitle>
          <DialogDescription>Progress is calculated from the linked {term("task").toLowerCase()}.</DialogDescription>
        </DialogHeader>
        <form id="ms-form" onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="ms-name">Name</Label>
            <Input id="ms-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors["name"]} autoFocus />
            {errors["name"] && <p className="text-xs text-destructive">{errors["name"]}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ms-desc">Description</Label>
            <Textarea id="ms-desc" value={description} maxLength={5000} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ms-date">Target date</Label>
              <Input id="ms-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={!!errors["target_date"]} />
              {errors["target_date"] && <p className="text-xs text-destructive">{errors["target_date"]}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ms-owner">Owner</Label>
              <PickOne id="ms-owner" label="Owner" value={owner} allowNone noneLabel="No owner" onChange={setOwner}
                options={config.members.map((m) => ({ value: m.user_id, label: m.full_name }))} />
            </div>
          </div>
          {isOwner && (
            <div className="space-y-1.5">
              <Label htmlFor="ms-override">Status</Label>
              <PickOne id="ms-override" label="Status" value={override} allowNone noneLabel="Automatic (calculated)"
                onChange={(v) => setOverride(v as MilestoneStatus | null)}
                options={MILESTONE_STATUSES.map((s) => ({ value: s, label: `Set: ${MILESTONE_STATUS_LABEL[s]}` }))} />
              <p className="text-xs text-muted-foreground">Only owners can set this. Choose Automatic to clear it.</p>
            </div>
          )}
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="ms-form" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
