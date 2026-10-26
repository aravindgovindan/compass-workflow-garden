import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { UserPlus, UserMinus, Copy, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, ErrorState } from "@/components/common/empty-state";
import { PickOne } from "@/components/tasks/shared";
import { PersonAvatar } from "@/components/tasks/person";
import { teamQuery, invitationsQuery, useCollaborationMutation } from "@/lib/collaboration/queries";
import {
  changeMember,
  inviteMember,
  revokeInvitation,
  type TeamPerson,
} from "@/functions/team.functions";
import { useTerm } from "@/lib/terminology/use-term";
import type { ProjectRole } from "@/lib/auth/roles";
export function TeamDirectory({ isOwner }: { isOwner: boolean }) {
  const term = useTerm();
  const q = useQuery(teamQuery);
  const inv = useQuery({ ...invitationsQuery, enabled: isOwner });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ProjectRole>("member");
  const [target, setTarget] = useState<TeamPerson | null>(null);
  const [reassign, setReassign] = useState<string | null>(null);
  const change = useCollaborationMutation(changeMember);
  const invite = useCollaborationMutation(inviteMember);
  const revoke = useCollaborationMutation(revokeInvitation);
  const router = useRouter();
  const qc = useQueryClient();
  const people = q.data ?? [];
  const options = [
    { value: "owner", label: "Owner" },
    { value: "member", label: term("member", "singular") },
    { value: "stakeholder", label: "Stakeholder" },
  ];
  async function refreshed() {
    await qc.invalidateQueries({ queryKey: ["project-config"] });
    await router.invalidate();
  }
  return (
    <div className="min-w-0 max-w-full space-y-6">
      <PageHeader
        title={term("team")}
        description={`${people.length} ${term("member", people.length === 1 ? "singular" : "plural").toLowerCase()}`}
        actions={
          isOwner ? (
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus className="size-4" />
              Invite
            </Button>
          ) : undefined
        }
      />
      {q.isPending ? (
        <Skeleton className="h-48 w-full" />
      ) : q.error ? (
        <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
      ) : (
        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="border-y bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Job title</th>
                <th className="p-3">Role</th>
                <th className="p-3">Open {term("task").toLowerCase()}</th>
                {isOwner && (
                  <th className="p-3">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {people.map((p) => (
                <tr key={p.user_id}>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <PersonAvatar name={p.full_name} />
                      <div>
                        <p className="font-medium">{p.full_name}</p>
                        <p className="break-all text-xs text-muted-foreground">{p.email ?? "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">{p.job_title ?? "—"}</td>
                  <td className="min-w-36 p-3">
                    {isOwner ? (
                      <PickOne
                        id={`role-${p.user_id}`}
                        label={`Role for ${p.full_name}`}
                        value={p.role}
                        disabled={change.isPending}
                        options={options}
                        onChange={(v) => {
                          if (v && v !== p.role && window.confirm(`Change ${p.full_name}'s role?`))
                            change.mutate(
                              {
                                userId: p.user_id,
                                role: v as ProjectRole,
                                deactivate: false,
                                reassignTo: null,
                              },
                              { onSuccess: refreshed },
                            );
                        }}
                      />
                    ) : (
                      options.find((o) => o.value === p.role)?.label
                    )}
                  </td>
                  <td className="p-3 tabular-nums">{p.open_tasks}</td>
                  {isOwner && (
                    <td className="p-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Deactivate"
                        aria-label={`Deactivate ${p.full_name}`}
                        onClick={() => {
                          setTarget(p);
                          setReassign(null);
                        }}
                      >
                        <UserMinus className="size-4" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {!people.length && (
            <p className="py-8 text-sm text-muted-foreground">
              No active {term("member").toLowerCase()}.
            </p>
          )}
        </div>
      )}
      {isOwner && (
        <section className="space-y-3 border-t pt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Invitations</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(`${window.location.origin}/login`);
                  toast.success("Sign-in address copied");
                } catch {
                  toast.error("Could not copy the sign-in address.");
                }
              }}
            >
              <Copy className="size-4" />
              Copy sign-in link
            </Button>
          </div>
          {inv.isPending ? (
            <Skeleton className="h-20 w-full" />
          ) : inv.error ? (
            <ErrorState message={inv.error.message} onRetry={() => inv.refetch()} />
          ) : (
            <ul className="divide-y">
              {inv.data?.map((i) => (
                <li
                  key={i.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="break-all font-medium">{i.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {options.find((o) => o.value === i.role)?.label} ·{" "}
                      {i.status.charAt(0).toUpperCase() + i.status.slice(1)}
                    </p>
                  </div>
                  {i.status === "pending" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Revoke invitation"
                      aria-label={`Revoke invitation to ${i.email}`}
                      disabled={revoke.isPending}
                      onClick={() => {
                        if (window.confirm("Revoke this invitation?")) revoke.mutate({ id: i.id });
                      }}
                    >
                      <X className="size-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {inv.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">No invitations yet.</p>
          )}
        </section>
      )}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite {term("member", "singular").toLowerCase()}</DialogTitle>
            <DialogDescription>
              Share the sign-in link with this person. No invitation email will be sent.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              invite.mutate(
                { email, role },
                {
                  onSuccess: () => {
                    setInviteOpen(false);
                    setEmail("");
                    toast.success("Invitation added");
                  },
                },
              );
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <PickOne
              id="invite-role"
              label="Invitation role"
              value={role}
              options={options}
              onChange={(v) => v && setRole(v as ProjectRole)}
            />
            <DialogFooter>
              <Button type="submit" disabled={invite.isPending}>
                {invite.isPending ? "Inviting…" : "Add invitation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!target}
        onOpenChange={(o) => {
          if (!o) setTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate {target?.full_name}?</DialogTitle>
            <DialogDescription>
              {target?.open_tasks ?? 0} open {term("task").toLowerCase()} will be reassigned or
              unassigned. Completed work keeps its attribution. Project access will end.
            </DialogDescription>
          </DialogHeader>
          <PickOne
            id="deactivate-reassign"
            label={`Reassign open ${term("task").toLowerCase()}`}
            value={reassign}
            allowNone
            noneLabel="Unassign"
            options={people
              .filter((p) => p.user_id !== target?.user_id)
              .map((p) => ({ value: p.user_id, label: p.full_name }))}
            onChange={setReassign}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={change.isPending}
              onClick={() => {
                if (target)
                  change.mutate(
                    {
                      userId: target.user_id,
                      role: target.role,
                      deactivate: true,
                      reassignTo: reassign,
                    },
                    {
                      onSuccess: async () => {
                        setTarget(null);
                        await refreshed();
                      },
                    },
                  );
              }}
            >
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
