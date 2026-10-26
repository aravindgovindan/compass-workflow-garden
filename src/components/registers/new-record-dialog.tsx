import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateIssue, useCreateRisk } from "@/lib/registers/queries";
import { useTerm } from "@/lib/terminology/use-term";

/** Start a risk or issue from a title, then fill in the rest in the drawer. */
export function NewRecordButton({ kind, onCreated }: { kind: "risk" | "issue"; onCreated: (id: string) => void }) {
  const term = useTerm();
  const one = term(kind, "singular");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const risk = useCreateRisk();
  const issue = useCreateIssue();
  const m = kind === "risk" ? risk : issue;
  const t = title.trim();
  const error = t.length > 200 ? "200 characters max" : null;
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!t || error) return;
    m.mutate(t, { onSuccess: (row) => { setOpen(false); setTitle(""); onCreated(row.id); } });
  }
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="size-4" />New {one.toLowerCase()}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>New {one.toLowerCase()}</DialogTitle>
              <DialogDescription>Give it a title; you can fill in the details next.</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="new-title">Title</Label>
              <Input id="new-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={!!error} />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={!t || !!error || m.isPending}>{m.isPending ? "Adding…" : "Add"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
