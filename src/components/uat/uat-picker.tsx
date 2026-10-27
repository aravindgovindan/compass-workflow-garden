import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FlaskConical, LoaderCircle } from "lucide-react";
import { getUatAvailability } from "@/functions/uat.functions";
import { Button } from "@/components/ui/button";
import { useUatSignIn } from "./uat-banner";
import type { ProjectRole } from "@/lib/auth/roles";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

const order: ProjectRole[] = ["owner", "member", "stakeholder"];
const label: Record<ProjectRole, string> = { owner: "Owner", member: "Member", stakeholder: "Stakeholder" };

/** Role picker shown on sign-in only while a real owner has shared test access switched on. */
export function UatPicker() {
  const fetchAvail = useServerFn(getUatAvailability);
  const avail = useQuery({ queryKey: ["uat-availability", "projects-v2"], queryFn: () => fetchAvail() });
  const { signIn, busy } = useUatSignIn();
  const [projectId, setProjectId] = useState<string | null>(null);
  if (!avail.data?.available) return null;
  const projects = Array.isArray(avail.data.projects) ? avail.data.projects : [];
  const project = projects.find((p) => p.id === projectId) ?? projects[0];
  if (!project) return null;
  const roles = order.filter((r) => project.roles.includes(r));
  return (
    <section aria-labelledby="uat-heading" className="mb-6 rounded-xl border bg-accent/40 p-4">
      <h2 id="uat-heading" className="flex items-center gap-2 text-sm font-semibold"><FlaskConical className="size-4" aria-hidden />Try it as a tester</h2>
      <p className="mt-1 text-xs text-muted-foreground">Shared test logins — no account needed. Changes are visible to the project.</p>
      {projects.length > 1 && <Select value={project.id} onValueChange={setProjectId} disabled={!!busy}><SelectTrigger aria-label="Test project" className="mt-3"><SelectValue /></SelectTrigger><SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} · {p.code}</SelectItem>)}</SelectContent></Select>}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {roles.map((r) => (
          <Button key={r} variant="outline" size="sm" disabled={!!busy} onClick={() => signIn(r, project.id)}>
            {busy === r && <LoaderCircle className="size-3 animate-spin" />}{label[r]}
          </Button>
        ))}
      </div>
    </section>
  );
}
