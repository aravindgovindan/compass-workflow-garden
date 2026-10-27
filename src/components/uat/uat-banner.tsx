import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FlaskConical, LoaderCircle, LogOut, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser, type CurrentUser } from "@/functions/session.functions";
import { startUatSession } from "@/functions/uat.functions";
import { Button } from "@/components/ui/button";
import { UAT_ROLES } from "@/lib/uat/rules";
import { friendlyError } from "@/lib/errors";
import type { ProjectRole } from "@/lib/auth/roles";

const label: Record<ProjectRole, string> = { owner: "Owner", member: "Member", stakeholder: "Stakeholder" };

/** Signs into a shared UAT role with a one-time token from the server. */
export function useUatSignIn() {
  const start = useServerFn(startUatSession);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<ProjectRole | null>(null);
  async function signIn(role: ProjectRole) {
    setBusy(role);
    try {
      const { tokenHash } = await start({ data: { role } });
      await qc.cancelQueries();
      qc.clear();
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
      if (error) throw new Error("Could not start the test session. Please try again.");
      await navigate({ to: "/dashboard", replace: true });
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }
  return { signIn, busy };
}

export function UatBanner({ me }: { me: CurrentUser }) {
  const { signIn, busy } = useUatSignIn();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const check = useServerFn(getCurrentUser);
  const role = me.membership?.role;

  async function exit(message?: string) {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    if (message) toast.info(message);
    navigate({ to: "/login", replace: true });
  }

  // Detect the kill switch or expiry while the tester is idle on a page.
  useEffect(() => {
    const id = window.setInterval(async () => {
      try {
        const now = await check();
        if (now.uat?.revoked) void exit("Shared test access has ended.");
      } catch { /* transient; next request re-checks */ }
    }, 60_000);
    return () => window.clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!me.uat || !role) return null;
  return (
    <div role="region" aria-label="Shared test access" className="flex flex-wrap items-center gap-2 border-b bg-accent px-4 py-2 text-sm text-accent-foreground">
      <FlaskConical className="size-4 shrink-0" aria-hidden />
      <span className="font-medium">Shared test account: {label[role]}</span>
      <span className="hidden text-xs opacity-80 md:inline">Others may use this login at the same time.</span>
      <div className="ml-auto flex flex-wrap items-center gap-1">
        {UAT_ROLES.filter((r) => r !== role).map((r) => (
          <Button key={r} size="sm" variant="ghost" className="h-7" disabled={!!busy} onClick={() => signIn(r)}>
            {busy === r && <LoaderCircle className="size-3 animate-spin" />}Switch to {label[r]}
          </Button>
        ))}
        {me.uat.feedbackUrl && (
          <Button asChild size="sm" variant="ghost" className="h-7">
            <a href={me.uat.feedbackUrl} target="_blank" rel="noopener noreferrer"><MessageSquare className="size-3" />Feedback</a>
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-7" onClick={() => exit()}><LogOut className="size-3" />Exit</Button>
      </div>
    </div>
  );
}
