import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LoaderCircle, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { getUatAdmin, provisionUatAccounts, updateUatSettings } from "@/functions/uat.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/empty-state";
import { friendlyError } from "@/lib/errors";

function toLocal(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function UatTab() {
  const qc = useQueryClient();
  const fetchAdmin = useServerFn(getUatAdmin);
  const state = useQuery({ queryKey: ["uat-admin"], queryFn: () => fetchAdmin() });
  const save = useServerFn(updateUatSettings);
  const provision = useServerFn(provisionUatAccounts);
  const [enabled, setEnabled] = useState(false);
  const [expires, setExpires] = useState("");
  const [feedback, setFeedback] = useState("");
  useEffect(() => {
    if (!state.data) return;
    setEnabled(state.data.settings.enabled);
    setExpires(toLocal(state.data.settings.expires_at));
    setFeedback(state.data.settings.feedback_url ?? "");
  }, [state.data]);

  const saveM = useMutation({
    mutationFn: () => save({ data: { enabled, expiresAt: expires ? new Date(expires).toISOString() : null, feedbackUrl: feedback.trim() || null } }),
    onSuccess: async () => { toast.success("Shared test access saved"); await qc.invalidateQueries({ queryKey: ["uat-admin"] }); },
    onError: (e) => toast.error(friendlyError(e)),
  });
  const provM = useMutation({
    mutationFn: () => provision(),
    onSuccess: async () => { toast.success("Shared test accounts are ready"); await qc.invalidateQueries(); },
    onError: (e) => toast.error(friendlyError(e)),
  });

  if (state.isPending) return <Skeleton className="h-48 w-full" />;
  if (state.error) return <ErrorState message={friendlyError(state.error)} onRetry={() => state.refetch()} />;
  const ready = state.data.roles.length === 3;
  return (
    <section className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Shared test access</h2>
        <p className="mt-2 text-sm text-muted-foreground">Lets testers sign in from the sign-in page as a shared Owner, Member or Stakeholder without an account. They work on this project's real data, but cannot manage the team, invitations, demo data, the project name or code, or this tab.</p>
      </div>
      <p role="status" className="text-sm font-medium">{state.data.active ? "Open to testers now" : "Closed to testers"} · {ready ? "3 shared accounts ready" : "Shared accounts not set up"}</p>
      <div className="flex items-center gap-3">
        <Button variant="outline" disabled={provM.isPending} onClick={() => provM.mutate()}>
          {provM.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <UserPlus className="size-4" />}{ready ? "Repair shared accounts" : "Set up shared accounts"}
        </Button>
      </div>
      <form className="space-y-4 rounded-xl border p-4" onSubmit={(e) => { e.preventDefault(); saveM.mutate(); }}>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="uat-enabled">Allow shared test sign-in</Label>
          <Switch id="uat-enabled" checked={enabled} onCheckedChange={setEnabled} disabled={!ready && !enabled} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="uat-expires">Close automatically at (optional)</Label>
          <Input id="uat-expires" type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="uat-feedback">Feedback link (optional)</Label>
          <Input id="uat-feedback" type="url" placeholder="https://forms.example.com/…" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
        </div>
        <Button type="submit" disabled={saveM.isPending}>{saveM.isPending && <LoaderCircle className="size-4 animate-spin" />}Save</Button>
      </form>
      <p className="text-sm text-muted-foreground">Turning this off signs testers out on their next action (within a minute when idle). Use Demo data to reset sample records between sessions.</p>
    </section>
  );
}
