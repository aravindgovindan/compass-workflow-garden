import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Link2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { milestoneTasksQuery, useLinkTasks, useUnlinkTask } from "@/lib/milestones/queries";
import { tasksListQuery } from "@/lib/tasks/queries";
import { NO_MILESTONE, parseTaskSearch, toFilters } from "@/lib/tasks/view-params";
import { useTerm } from "@/lib/terminology/use-term";

/** Linked items of one milestone; writers can unlink and link more. */
export function LinkedTasks({ milestoneId, canEdit }: { milestoneId: string; canEdit: boolean }) {
  const term = useTerm();
  const q = useQuery(milestoneTasksQuery(milestoneId));
  const unlink = useUnlinkTask();
  const [linking, setLinking] = useState(false);
  if (q.isPending) return <Skeleton className="h-16 w-full" />;
  if (q.error) return <p className="text-xs text-destructive">{q.error.message}</p>;
  return (
    <div className="space-y-2">
      {q.data.length === 0 ? (
        <p className="text-xs text-muted-foreground">No {term("task").toLowerCase()} linked yet.</p>
      ) : (
        <ul className="divide-y rounded-md border text-sm">
          {q.data.map((t) => (
            <li key={t.id} className="flex items-center gap-2 px-3 py-1.5">
              {t.done ? <Check className="size-3.5 shrink-0 text-health-green" aria-label="Done" /> : <span className="size-3.5 shrink-0" />}
              <span className={`min-w-0 flex-1 truncate ${t.done ? "text-muted-foreground line-through" : ""}`}>{t.title}</span>
              {canEdit && (
                <Button variant="ghost" size="icon" className="size-7" aria-label={`Unlink ${t.title}`}
                  disabled={unlink.isPending} onClick={() => unlink.mutate(t.id)}><X className="size-3.5" /></Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <>
          <Button variant="outline" size="sm" onClick={() => setLinking(true)}><Link2 className="size-4" />Link {term("task").toLowerCase()}</Button>
          {linking && <LinkDialog milestoneId={milestoneId} onClose={() => setLinking(false)} />}
        </>
      )}
    </div>
  );
}

function LinkDialog({ milestoneId, onClose }: { milestoneId: string; onClose: () => void }) {
  const term = useTerm();
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const filters = useMemo(() => toFilters(parseTaskSearch({ milestone: [NO_MILESTONE], q: search })), [search]);
  const list = useQuery(tasksListQuery(filters));
  const link = useLinkTasks();
  const rows = list.data?.rows.slice(0, 200) ?? [];
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link {term("task").toLowerCase()}</DialogTitle>
          <DialogDescription>Showing {term("task").toLowerCase()} that are not linked to any {term("milestone", "singular").toLowerCase()}.</DialogDescription>
        </DialogHeader>
        <Input aria-label="Search" placeholder="Search by title" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="max-h-72 overflow-y-auto rounded-md border">
          {list.isPending ? <Skeleton className="h-24 w-full" /> : list.error ? (
            <p className="p-3 text-xs text-destructive">{list.error.message}</p>
          ) : rows.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">Nothing to link.</p>
          ) : (
            <ul>
              {rows.map((t) => {
                const on = picked.includes(t.id);
                return (
                  <li key={t.id}>
                    <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted">
                      <Checkbox checked={on} onCheckedChange={() => setPicked(on ? picked.filter((x) => x !== t.id) : [...picked, t.id])} />
                      <span className="truncate">{t.title}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={!picked.length || link.isPending}
            onClick={() => link.mutate({ milestoneId, taskIds: picked }, { onSuccess: onClose })}>
            {link.isPending ? "Linking…" : `Link ${picked.length || ""}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
