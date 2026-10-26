import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createLabel, createPriority, deleteLabel, deletePriority, reorderConfig, updateLabel, updatePriority, type ProjectConfig,
} from "@/functions/config.functions";
import { useConfigMutation } from "@/lib/config/use-config";
import { ColorPicker } from "./color-picker";
import { InlineName } from "./inline-name";
import { SortableList } from "./sortable-list";
import { AddRow, SavingNote } from "./shared";

export function ListsTab({ priorities, labels }: { priorities: ProjectConfig["priorities"]; labels: ProjectConfig["labels"] }) {
  const [order, setOrder] = useState<string[] | null>(null);
  const cP = useConfigMutation(createPriority, "Priority added");
  const uP = useConfigMutation(updatePriority);
  const dP = useConfigMutation(deletePriority, "Priority deleted");
  const rP = useConfigMutation(reorderConfig);
  const cL = useConfigMutation(createLabel, "Label added");
  const uL = useConfigMutation(updateLabel);
  const dL = useConfigMutation(deleteLabel, "Label deleted");
  const sorted = order ? (order.map((id) => priorities.find((p) => p.id === id)).filter(Boolean) as typeof priorities) : priorities;
  const busy = [cP, uP, dP, rP, cL, uL, dL].some((m) => m.isPending);

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Priorities</h2>
            <p className="text-sm text-muted-foreground">Ordered from lowest to highest. Drag to reorder.</p>
          </div>
          <SavingNote saving={busy} />
        </div>
        {sorted.length ? (
          <SortableList
            items={sorted}
            onReorder={(ids) => { setOrder(ids); rP.mutate({ kind: "priority", ids }, { onSettled: () => setOrder(null) }); }}
            renderItem={(p) => (
              <>
                <ColorPicker value={p.color} onChange={(c) => uP.mutate({ id: p.id, color: c as never })} />
                <InlineName label="Priority name" value={p.name} onSave={(name) => uP.mutate({ id: p.id, name })} />
                <Button variant="ghost" size="icon" aria-label={`Delete ${p.name}`} onClick={() => dP.mutate({ id: p.id })}>
                  <Trash2 className="text-muted-foreground" />
                </Button>
              </>
            )}
          />
        ) : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No priorities yet.</p>}
        <AddRow placeholder="New priority name" pending={cP.isPending} onAdd={(name) => cP.mutateAsync({ name, color: "slate" })} />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Labels</h2>
          <p className="text-sm text-muted-foreground">Tags for grouping work, like “Frontend” or “Legal”.</p>
        </div>
        {labels.length ? (
          <ul className="divide-y rounded-lg border bg-card">
            {labels.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <ColorPicker value={l.color} onChange={(c) => uL.mutate({ id: l.id, color: c as never })} />
                <InlineName label="Label name" value={l.name} onSave={(name) => uL.mutate({ id: l.id, name })} />
                <Button variant="ghost" size="icon" aria-label={`Delete ${l.name}`} onClick={() => dL.mutate({ id: l.id })}>
                  <Trash2 className="text-muted-foreground" />
                </Button>
              </li>
            ))}
          </ul>
        ) : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No labels yet. Add your first one below.</p>}
        <AddRow placeholder="New label name" pending={cL.isPending} onAdd={(name) => cL.mutateAsync({ name, color: "teal" })} />
      </section>
    </div>
  );
}
