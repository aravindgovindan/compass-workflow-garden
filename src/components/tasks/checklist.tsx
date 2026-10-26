import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { SortableList } from "@/components/settings/sortable-list";
import { InlineName } from "@/components/settings/inline-name";
import { AddRow } from "@/components/settings/shared";
import type { TaskDetail } from "@/functions/tasks.functions";
import { useChecklistActions } from "@/lib/tasks/queries";

export function Checklist({ task }: { task: TaskDetail }) {
  const a = useChecklistActions(task.id);
  const items = task.checklist;
  const done = items.filter((i) => i.done).length;
  return (
    <section aria-labelledby="checklist-h" className="space-y-2 border-t pt-4">
      <div className="flex items-center justify-between gap-3">
        <h3 id="checklist-h" className="text-sm font-semibold">Checklist</h3>
        {items.length > 0 && <span className="text-xs text-muted-foreground">{done}/{items.length}</span>}
      </div>
      {items.length > 0 && (
        <>
          <Progress value={(done / items.length) * 100} aria-label="Checklist progress" className="h-1.5" />
          <SortableList
            items={items}
            onReorder={(ids) => a.reorder.mutate(ids)}
            renderItem={(i) => (
              <>
                <Checkbox checked={i.done} aria-label={`Mark "${i.text}" ${i.done ? "not done" : "done"}`}
                  onCheckedChange={(c) => a.update.mutate({ id: i.id, done: c === true })} />
                <InlineName label="Checklist item" value={i.text} max={300} onSave={(text) => a.update.mutate({ id: i.id, text })} />
                <Button variant="ghost" size="icon" aria-label={`Delete "${i.text}"`} onClick={() => a.remove.mutate(i.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </>
            )}
          />
        </>
      )}
      <AddRow placeholder="Add a checklist item" max={300} pending={a.add.isPending} onAdd={(text) => a.add.mutateAsync(text)} />
    </section>
  );
}
