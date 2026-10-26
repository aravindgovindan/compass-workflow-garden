import { useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/empty-state";
import { SavingNote } from "@/components/settings/shared";

/** Drawer frame shared by the risk and issue detail views (loading, error, saving state, delete). */
export function RecordSheet({ open, onClose, kind, title, state, saving, readOnly, onRetry, onDelete, children }: {
  open: boolean; onClose: () => void; kind: string; title?: string | undefined; state: "loading" | "error" | "ready";
  saving: boolean; readOnly: boolean; onRetry: () => void; onDelete: () => void; children?: ReactNode;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <div className="space-y-6 p-4">
          <SheetHeader className="space-y-2 p-0">
            <div className="flex items-center justify-between gap-2 pr-8">
              <SheetDescription className="text-xs uppercase tracking-wide">{kind}{readOnly ? " · read-only" : ""}</SheetDescription>
              {state === "ready" && !readOnly && <SavingNote saving={saving} />}
            </div>
            <SheetTitle className="sr-only">{title ?? kind}</SheetTitle>
          </SheetHeader>
          {state === "loading" && <div className="space-y-4"><Skeleton className="h-9 w-3/4" /><Skeleton className="h-24 w-full" /><Skeleton className="h-48 w-full" /></div>}
          {state === "error" && <ErrorState message="Could not load this item. It may have been deleted." onRetry={onRetry} />}
          {state === "ready" && children}
          {state === "ready" && !readOnly && (
            <div className="border-t pt-4">
              <Button variant="ghost" className="text-destructive" onClick={() => setConfirm(true)}><Trash2 className="size-4" />Delete {kind.toLowerCase()}</Button>
            </div>
          )}
        </div>
      </SheetContent>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{title}”?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone. The deletion is recorded in the activity log.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
