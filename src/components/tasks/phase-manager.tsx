import { useState } from "react";
import { Layers, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SortableList } from "@/components/settings/sortable-list";
import { InlineName } from "@/components/settings/inline-name";
import { AddRow, SavingNote } from "@/components/settings/shared";
import type { Phase } from "@/functions/phases.functions";
import { usePhaseActions } from "@/lib/tasks/queries";
import { useTerm } from "@/lib/terminology/use-term";

export function PhaseManager({ phases }: { phases: Phase[] }) {
  const term = useTerm();
  const a = usePhaseActions();
  const [open, setOpen] = useState(false);
  const saving = a.create.isPending || a.update.isPending || a.remove.isPending || a.reorder.isPending;
  const one = term("phase", "singular");
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm"><Layers className="size-4" />{term("phase")}</Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{term("phase")}</SheetTitle>
          <SheetDescription>
            Group the work into {term("phase").toLowerCase()}. Drag to reorder. Deleting a {one.toLowerCase()} keeps its {term("task").toLowerCase()}.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-4 px-4 pb-6">
          <div className="flex justify-end"><SavingNote saving={saving} /></div>
          {phases.length > 0 ? (
            <SortableList
              items={phases}
              onReorder={(ids) => a.reorder.mutate(ids)}
              renderItem={(p) => (
                <div className="w-full space-y-2">
                  <div className="flex items-start gap-2">
                    <InlineName label={`${one} name`} value={p.name} max={80} onSave={(name) => a.update.mutate({ id: p.id, name })} />
                    <Button variant="ghost" size="icon" aria-label={`Delete ${p.name}`} onClick={() => a.remove.mutate(p.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Input type="date" aria-label={`${p.name} start date`} className="h-8 w-auto" defaultValue={p.start_date ?? ""}
                      max={p.end_date ?? undefined}
                      onBlur={(e) => { const v = e.target.value || null; if (v !== p.start_date) a.update.mutate({ id: p.id, start_date: v }); }} />
                    <span>to</span>
                    <Input type="date" aria-label={`${p.name} end date`} className="h-8 w-auto" defaultValue={p.end_date ?? ""}
                      min={p.start_date ?? undefined}
                      onBlur={(e) => { const v = e.target.value || null; if (v !== p.end_date) a.update.mutate({ id: p.id, end_date: v }); }} />
                  </div>
                </div>
              )}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No {term("phase").toLowerCase()} yet.</p>
          )}
          <AddRow placeholder={`New ${one.toLowerCase()} name`} max={80} pending={a.create.isPending} onAdd={(name) => a.create.mutateAsync({ name })} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
