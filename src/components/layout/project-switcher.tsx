import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import type { CurrentUser } from "@/functions/session.functions";
import { switchActiveProject } from "@/functions/project.functions";
import { useProjectMutation } from "@/lib/projects/use-project-mutation";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { HealthBadge } from "@/components/common/health-badge";
import { CreateProjectDialog } from "@/components/project/create-project-dialog";

const roleLabel = { owner: "Owner", member: "Member", stakeholder: "Stakeholder" };

export function ProjectSwitcher({ me, busy, onBusy }: { me: CurrentUser; busy: boolean; onBusy: (busy: boolean) => void }) {
  const [creating, setCreating] = useState(false);
  const switchProject = useServerFn(switchActiveProject);
  const mutation = useProjectMutation((projectId: string) => switchProject({ data: { projectId } }), onBusy);
  const active = me.membership;
  if (!active) return null;
  if (me.uat) return <div className="truncate px-2 py-2 text-sm text-sidebar-foreground">{active.project.name}</div>;
  return <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" aria-label="Switch project" disabled={busy} className="h-auto w-full justify-between gap-2 px-2 py-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
          <span className="min-w-0 text-left"><span className="block truncate font-medium">{active.project.name}</span><span className="block truncate text-xs text-sidebar-foreground/60">{active.project.code} · {roleLabel[active.role]}</span></span><ChevronsUpDown className="size-4 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="start" className="w-72 max-w-[calc(100vw-2rem)]">
        <DropdownMenuLabel>Projects</DropdownMenuLabel>
        {me.projects.map((project) => <DropdownMenuItem key={project.id} disabled={busy} onSelect={() => { if (project.id !== active.project.id) mutation.mutate(project.id); }}>
          <span className="flex size-4 shrink-0 items-center">{project.id === active.project.id && <Check className="size-4" />}</span>
          <span className="min-w-0 flex-1"><span className="block truncate font-medium">{project.name}</span><span className="block text-xs text-muted-foreground">{project.code} · {roleLabel[project.role]}</span></span><HealthBadge value={project.health} />
        </DropdownMenuItem>)}
        <DropdownMenuSeparator /><DropdownMenuItem disabled={busy} onSelect={() => setCreating(true)}><Plus />New project</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    {creating && <CreateProjectDialog open={creating} onOpenChange={setCreating} onBusy={onBusy} />}
  </>;
}