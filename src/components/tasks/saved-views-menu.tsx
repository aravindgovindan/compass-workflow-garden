import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, ChevronDown, Trash2 } from "lucide-react";
import type { SavedView } from "@/functions/views.functions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { savedViewsQuery, useSavedViewActions } from "@/lib/tasks/view-queries";

/** Save, load, rename and delete the current user's own views. */
export function SavedViewsMenu({ current, mode, onLoad }: {
  current: Record<string, unknown>; mode: "list" | "board"; onLoad: (v: SavedView) => void;
}) {
  const views = useQuery(savedViewsQuery);
  const { save, rename, remove } = useSavedViewActions();
  const [dialog, setDialog] = useState<"save" | "manage" | null>(null);
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9"><Bookmark className="size-4" />Views<ChevronDown className="size-3.5 opacity-60" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel>My saved views</DropdownMenuLabel>
          {views.isPending ? <p className="px-2 py-1.5 text-xs text-muted-foreground">Loading…</p>
            : views.error ? <p className="px-2 py-1.5 text-xs text-destructive">Could not load views.</p>
            : !views.data?.length ? <p className="px-2 py-1.5 text-xs text-muted-foreground">No saved views yet.</p>
            : views.data.map((v) => (
              <DropdownMenuItem key={v.id} onSelect={() => onLoad(v)}>
                <span className="truncate">{v.name}</span><span className="ml-auto text-xs text-muted-foreground">{v.view_type === "board" ? "Board" : "List"}</span>
              </DropdownMenuItem>
            ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => { setName(""); setErr(null); setDialog("save"); }}>Save current view…</DropdownMenuItem>
          {!!views.data?.length && <DropdownMenuItem onSelect={() => setDialog("manage")}>Manage views…</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog === "save"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Save current view</DialogTitle></DialogHeader>
          <form className="space-y-2" onSubmit={(e) => {
            e.preventDefault();
            const n = name.trim();
            if (!n) { setErr("Name is required"); return; }
            save.mutate({ name: n.slice(0, 80), view_type: mode, filters: current }, { onSuccess: () => setDialog(null) });
          }}>
            <Label htmlFor="view-name">Name</Label>
            <Input id="view-name" autoFocus value={name} maxLength={80} onChange={(e) => setName(e.target.value)} aria-invalid={!!err} />
            {err && <p className="text-xs text-destructive">{err}</p>}
            <p className="text-xs text-muted-foreground">Saves the filters, sort, grouping and {mode} layout. Using an existing name replaces it.</p>
            <DialogFooter><Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save view"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "manage"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Manage views</DialogTitle></DialogHeader>
          <ul className="space-y-2">
            {views.data?.map((v) => <ManageRow key={v.id} view={v} onRename={(n) => rename.mutate({ id: v.id, name: n })} onDelete={() => remove.mutate(v.id)} />)}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ManageRow({ view, onRename, onDelete }: { view: SavedView; onRename: (n: string) => void; onDelete: () => void }) {
  const [n, setN] = useState(view.name);
  const commit = () => { const t = n.trim(); if (t && t !== view.name) onRename(t.slice(0, 80)); else setN(view.name); };
  return (
    <li className="flex items-center gap-2">
      <Input aria-label={`Rename ${view.name}`} value={n} maxLength={80} onChange={(e) => setN(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }} className="h-9" />
      <Button variant="ghost" size="icon" aria-label={`Delete ${view.name}`} onClick={onDelete}><Trash2 className="size-4" /></Button>
    </li>
  );
}
