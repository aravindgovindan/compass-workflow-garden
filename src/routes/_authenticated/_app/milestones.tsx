import { ExportButton } from "@/components/exports/export-button";
import { exportMilestones } from "@/functions/exports.functions";
import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronDown,
  Flag,
  ListTodo,
  Pencil,
  Plus,
  Trash2,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState, ErrorState, PageHeader } from "@/components/common/empty-state";
import { MilestoneStatusBadge, ProgressBar } from "@/components/milestones/milestone-bits";
import { MilestoneForm } from "@/components/milestones/milestone-form";
import { LinkedTasks } from "@/components/milestones/linked-tasks";
import type { MilestoneItem } from "@/functions/milestones.functions";
import type { ProjectConfig } from "@/functions/config.functions";
import { guardSection } from "@/lib/auth/guard";
import { canAccessSection, canConfigure, canWrite } from "@/lib/auth/roles";
import { useProjectConfig } from "@/lib/config/use-config";
import { milestonesQuery, useDeleteMilestone } from "@/lib/milestones/queries";
import { useTerm } from "@/lib/terminology/use-term";

export const Route = createFileRoute("/_authenticated/_app/milestones")({
  beforeLoad: guardSection("milestones"),
  head: () => ({
    meta: [
      { title: "Milestones — Compass Workflow" },
      { name: "description", content: "Key dates and how close you are." },
      { property: "og:title", content: "Milestones — Compass Workflow" },
      { property: "og:description", content: "Key dates and how close you are." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const term = useTerm();
  const title = term("milestone");
  useEffect(() => {
    document.title = `${title} — Compass Workflow`;
  }, [title]);
  const { me } = Route.useRouteContext();
  const role = me.membership?.role ?? null;
  const config = useProjectConfig();
  const list = useQuery(milestonesQuery);
  const [creating, setCreating] = useState(false);
  const writer = canWrite(role);

  return (
    <>
      <PageHeader
        title={title}
        description="Key dates and how close you are."
        actions={
          <div className="flex flex-wrap gap-2">
            <ExportButton kind="milestone" fn={exportMilestones} data={{}} />
            {writer && (
              <Button onClick={() => setCreating(true)}>
                <Plus className="size-4" />
                New {term("milestone", "singular").toLowerCase()}
              </Button>
            )}
          </div>
        }
      />
      {list.isPending || config.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : list.error || config.error || !config.data ? (
        <ErrorState
          message={(list.error ?? config.error)?.message ?? "Could not load."}
          onRetry={() => {
            list.refetch();
            config.refetch();
          }}
        />
      ) : list.data.length === 0 ? (
        <EmptyState
          icon={Flag}
          title={`No ${title.toLowerCase()} yet`}
          description={
            writer
              ? `Add a ${term("milestone", "singular").toLowerCase()} with a target date, then link ${term("task").toLowerCase()} to track progress.`
              : "Nothing has been planned yet."
          }
          action={
            writer && (
              <Button onClick={() => setCreating(true)}>
                <Plus className="size-4" />
                New {term("milestone", "singular").toLowerCase()}
              </Button>
            )
          }
        />
      ) : (
        <ol className="relative space-y-4 border-l border-border pl-6">
          {list.data.map((m) => (
            <MilestoneCard
              key={m.id}
              m={m}
              config={config.data}
              canEdit={writer}
              isOwner={canConfigure(role)}
              canSeeTasks={canAccessSection(role, "tasks")}
            />
          ))}
        </ol>
      )}
      {creating && config.data && (
        <MilestoneForm
          open
          onOpenChange={setCreating}
          config={config.data}
          isOwner={canConfigure(role)}
        />
      )}
    </>
  );
}

function MilestoneCard({
  m,
  config,
  canEdit,
  isOwner,
  canSeeTasks,
}: {
  m: MilestoneItem;
  config: ProjectConfig;
  canEdit: boolean;
  isOwner: boolean;
  canSeeTasks: boolean;
}) {
  const term = useTerm();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const del = useDeleteMilestone();
  const owner = config.members.find((x) => x.user_id === m.owner_id)?.full_name;
  const date = new Date(`${m.target_date}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return (
    <li className="relative">
      <span
        aria-hidden
        className="absolute -left-[31px] top-5 size-3 rounded-full border-2 border-background bg-primary"
      />
      <article className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold">{m.name}</h2>
              <MilestoneStatusBadge value={m.status} overridden={!!m.status_override} />
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CalendarDays className="size-3.5" />
                {date}
              </span>
              <span className="flex items-center gap-1">
                <User className="size-3.5" />
                {owner ?? "No owner"}
              </span>
            </div>
          </div>
          <div className="flex gap-1">
            {canSeeTasks && (
              <Button variant="ghost" size="sm" asChild>
                <Link to="/tasks" search={{ milestone: [m.id] } as never}>
                  <ListTodo className="size-4" />
                  View {term("task").toLowerCase()}
                </Link>
              </Button>
            )}
            {canEdit && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Edit ${m.name}`}
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${m.name}`}
                  onClick={() => setConfirm(true)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </>
            )}
          </div>
        </div>
        {m.description && (
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{m.description}</p>
        )}
        <ProgressBar progress={m.progress} className="mt-3" />
        {canSeeTasks && <Collapsible className="mt-3">
          <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-primary hover:underline [&[data-state=open]>svg]:rotate-180">
            Linked {term("task").toLowerCase()}
            <ChevronDown className="size-3.5 transition-transform" />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <LinkedTasks milestoneId={m.id} canEdit={canEdit} />
          </CollapsibleContent>
        </Collapsible>}
      </article>
      {editing && (
        <MilestoneForm
          open
          onOpenChange={setEditing}
          milestone={m}
          config={config}
          isOwner={isOwner}
        />
      )}
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{m.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Linked {term("task").toLowerCase()} stay; they just lose the link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => del.mutate(m.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
