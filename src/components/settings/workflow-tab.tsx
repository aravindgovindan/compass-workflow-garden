import { useState } from "react";
import { Loader2, Plus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { createStatus, deleteStatus, reorderConfig, updateStatus, type ProjectConfig } from "@/functions/config.functions";
import { useConfigMutation } from "@/lib/config/use-config";
import { STATUS_CATEGORIES, STATUS_CATEGORY_LABELS } from "@/lib/schemas/config";
import { useTerm } from "@/lib/terminology/use-term";
import { ColorDot, ColorPicker } from "./color-picker";
import { InlineName } from "./inline-name";
import { SortableList } from "./sortable-list";
import { AddRow, SavingNote } from "./shared";

type Status = ProjectConfig["statuses"][number];
type Category = (typeof STATUS_CATEGORIES)[number];

export function WorkflowTab({ statuses }: { statuses: Status[] }) {
  const term = useTerm();
  const [order, setOrder] = useState<string[] | null>(null);
  const [toDelete, setToDelete] = useState<Status | null>(null);
  const create = useConfigMutation(createStatus, "Status added");
  const update = useConfigMutation(updateStatus);
  const reorder = useConfigMutation(reorderConfig);
  const sorted = order ? order.map((id) => statuses.find((s) => s.id === id)).filter(Boolean) as Status[] : statuses;
  const busy = create.isPending || update.isPending || reorder.isPending;

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Workflow</h2>
          <p className="text-sm text-muted-foreground">
            The statuses a {term("task", "singular").toLowerCase()} moves through. Drag to reorder; the default is used for new items.
          </p>
        </div>
        <SavingNote saving={busy} />
      </div>
      <SortableList
        items={sorted}
        onReorder={(ids) => {
          setOrder(ids);
          reorder.mutate({ kind: "status", ids }, { onSettled: () => setOrder(null) });
        }}
        renderItem={(s) => (
          <>
            <ColorPicker value={s.color} onChange={(color) => update.mutate({ id: s.id, color: color as never })} />
            <InlineName label="Status name" value={s.name} onSave={(name) => update.mutate({ id: s.id, name })} />
            <Select value={s.category} onValueChange={(v) => update.mutate({ id: s.id, category: v as Category })}>
              <SelectTrigger className="h-9 w-36" aria-label="Category"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{STATUS_CATEGORY_LABELS[c]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              type="button" variant="ghost" size="icon"
              aria-label={s.is_default ? "Default status" : "Make default"} aria-pressed={s.is_default}
              title={s.is_default ? "Default status" : "Make default"}
              onClick={() => !s.is_default && update.mutate({ id: s.id, is_default: true })}
            >
              <Star className={s.is_default ? "fill-accent-foreground text-accent-foreground" : "text-muted-foreground"} />
            </Button>
            <Button type="button" variant="ghost" size="icon" aria-label={`Delete ${s.name}`} onClick={() => setToDelete(s)}
              disabled={statuses.length <= 1}>
              <Trash2 className="text-muted-foreground" />
            </Button>
          </>
        )}
      />
      <AddRow placeholder="New status name" pending={create.isPending}
        onAdd={(name) => create.mutateAsync({ name, color: "slate", category: "todo" })} />
      <DeleteStatusDialog status={toDelete} statuses={statuses} onClose={() => setToDelete(null)} />
    </section>
  );
}

function DeleteStatusDialog({ status, statuses, onClose }: { status: Status | null; statuses: Status[]; onClose: () => void }) {
  const [replacement, setReplacement] = useState<string>("");
  const del = useConfigMutation(deleteStatus, "Status deleted");
  const others = statuses.filter((s) => s.id !== status?.id);
  return (
    <Dialog open={!!status} onOpenChange={(o) => { if (!o) { setReplacement(""); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{status?.name}”?</DialogTitle>
          <DialogDescription>
            Anything currently in this status moves to the replacement you choose.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="replacement">Replacement status</Label>
          <Select value={replacement} onValueChange={setReplacement}>
            <SelectTrigger id="replacement"><SelectValue placeholder="Choose a status" /></SelectTrigger>
            <SelectContent>
              {others.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <span className="flex items-center gap-2"><ColorDot color={s.color} />{s.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={del.isPending}
            onClick={() => status && del.mutate({ id: status.id, replacementId: replacement || null }, { onSuccess: () => { setReplacement(""); onClose(); } })}>
            {del.isPending && <Loader2 className="animate-spin" />} Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { Plus };
