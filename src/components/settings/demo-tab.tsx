import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Database, LoaderCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getDemoState, loadDemo, removeDemo } from "@/functions/demo.functions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/empty-state";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { friendlyError } from "@/lib/errors";
import { useTerm } from "@/lib/terminology/use-term";

export function DemoTab() {
  const term = useTerm();
  const qc = useQueryClient();
  const state = useQuery({ queryKey: ["demo-state"], queryFn: useServerFn(getDemoState) });
  const load = useServerFn(loadDemo);
  const remove = useServerFn(removeDemo);
  const [confirm, setConfirm] = useState(false);
  const action = useMutation({
    mutationFn: (kind: "load" | "remove") => kind === "load" ? load({ data: {} }) : remove({ data: { confirmation: "REMOVE DEMO" } }),
    onSuccess: async (result, kind) => {
      toast.success(result.changed ? kind === "load" ? "Demo data loaded" : "Demo data removed" : kind === "load" ? "Demo data is already loaded" : "No demo data to remove");
      await qc.invalidateQueries();
      setConfirm(false);
    },
    onError: (e) => toast.error(friendlyError(e)),
  });
  if (state.isPending) return <Skeleton className="h-48 w-full" />;
  if (state.error) return <ErrorState message={friendlyError(state.error)} onRetry={() => state.refetch()} />;
  return <section className="max-w-2xl space-y-5">
    <div><h2 className="text-lg font-semibold">Demo data</h2><p className="mt-2 text-sm text-muted-foreground">Customer onboarding launch sample: 40 {term("task").toLowerCase()}, including 8 {term("subtask").toLowerCase()}, 3 {term("phase").toLowerCase()}, 4 {term("milestone").toLowerCase()}, 8 {term("risk").toLowerCase()}, and 5 {term("issue").toLowerCase()}, with checklists and team discussions.</p></div>
    <p role="status" className="text-sm font-medium">{state.data?.loaded ? `Demo loaded${state.data.loadedAt ? ` on ${new Date(state.data.loadedAt).toLocaleDateString()}` : ""}` : "No demo data loaded"}</p>
    <div className="flex flex-wrap gap-3"><Button disabled={action.isPending} onClick={() => action.mutate("load")}>{action.isPending && action.variables === "load" ? <LoaderCircle className="size-4 animate-spin" /> : <Database className="size-4" />}{state.data?.loaded ? "Reload demo safely" : "Load demo data"}</Button><Button variant="outline" disabled={!state.data?.loaded || action.isPending} onClick={() => setConfirm(true)}><Trash2 className="size-4" />Remove demo data</Button></div>
    <p className="text-sm text-muted-foreground">Real records, project settings, team members and activity history are kept. If this project contains only demo records, removing them leaves a blank project.</p>
    {action.error && <ErrorState message={friendlyError(action.error)} />}
    <AlertDialog open={confirm} onOpenChange={setConfirm}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove demo data?</AlertDialogTitle><AlertDialogDescription>All tracked demo records will be removed, including changes made to those records. Real records and activity history stay. New comments on demo records must be removed first.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={action.isPending}>Cancel</AlertDialogCancel><AlertDialogAction disabled={action.isPending} onClick={(e) => { e.preventDefault(); action.mutate("remove"); }}>{action.isPending ? "Removing…" : "Remove demo"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}