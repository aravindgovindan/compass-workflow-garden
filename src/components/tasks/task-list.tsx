import { CheckSquare, GitBranch } from "lucide-react";
import type { TaskListItem } from "@/functions/tasks.functions";
import type { Phase } from "@/functions/phases.functions";
import type { ProjectConfig } from "@/functions/config.functions";
import { useTerm } from "@/lib/terminology/use-term";
import { Dot, formatDate, isOverdue } from "./shared";
import { QuickAdd } from "./quick-add";

/** Tasks grouped by phase (configured order), then "no phase". */
export function TaskList({ tasks, phases, config, onOpen }: {
  tasks: TaskListItem[]; phases: Phase[]; config: ProjectConfig; onOpen: (id: string) => void;
}) {
  const term = useTerm();
  const statusPos = new Map(config.statuses.map((s, i) => [s.id, i]));
  const sorted = [...tasks].sort((a, b) =>
    (statusPos.get(a.status_id) ?? 99) - (statusPos.get(b.status_id) ?? 99) || a.position - b.position);
  const groups = [
    ...phases.map((p) => ({ id: p.id, name: p.name, range: [p.start_date, p.end_date] as const })),
    { id: null as string | null, name: `No ${term("phase", "singular").toLowerCase()}`, range: [null, null] as const },
  ];
  return (
    <div className="space-y-6">
      {groups.map((g) => {
        const rows = sorted.filter((t) => t.phase_id === g.id);
        if (g.id === null && rows.length === 0 && phases.length > 0) return null;
        return (
          <section key={g.id ?? "none"} aria-labelledby={`grp-${g.id ?? "none"}`} className="space-y-2">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <h2 id={`grp-${g.id ?? "none"}`} className="font-display text-base font-semibold">{g.name}</h2>
              <span className="text-xs text-muted-foreground">
                {rows.length} {term("task", rows.length === 1 ? "singular" : "plural").toLowerCase()}
                {g.range[0] || g.range[1] ? ` · ${formatDate(g.range[0]) || "…"} – ${formatDate(g.range[1]) || "…"}` : ""}
              </span>
            </div>
            <ul className="divide-y rounded-lg border bg-card">
              {rows.map((t) => <Row key={t.id} task={t} config={config} onOpen={onOpen} />)}
              <li className="p-2"><QuickAdd phaseId={g.id} compact /></li>
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Row({ task, config, onOpen }: { task: TaskListItem; config: ProjectConfig; onOpen: (id: string) => void }) {
  const term = useTerm();
  const status = config.statuses.find((s) => s.id === task.status_id);
  const priority = config.priorities.find((p) => p.id === task.priority_id);
  const assignee = config.members.find((m) => m.user_id === task.assignee_id);
  const pending = task.id.startsWith("temp-");
  const overdue = isOverdue(task.due_date, task.completed_at);
  return (
    <li>
      <button
        type="button"
        disabled={pending}
        onClick={() => onOpen(task.id)}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-60"
      >
        <span className="flex w-28 shrink-0 items-center gap-2 text-xs text-muted-foreground">
          {status && <Dot color={status.color} />}<span className="truncate">{status?.name ?? "…"}</span>
        </span>
        <span className={`min-w-0 flex-1 truncate text-sm font-medium ${task.completed_at ? "text-muted-foreground line-through" : ""}`}>
          {task.title}
        </span>
        <span className="flex items-center gap-3 text-xs text-muted-foreground">
          {task.subtask_count > 0 && (
            <span className="flex items-center gap-1" title={term("subtask")}><GitBranch className="size-3.5" />{task.subtask_count}</span>
          )}
          {task.checklist_total > 0 && (
            <span className="flex items-center gap-1" title="Checklist"><CheckSquare className="size-3.5" />{task.checklist_done}/{task.checklist_total}</span>
          )}
          {priority && <span className="flex items-center gap-1"><Dot color={priority.color} />{priority.name}</span>}
          {assignee && <span className="max-w-28 truncate">{assignee.full_name}</span>}
          {task.due_date && <span className={overdue ? "font-medium text-destructive" : ""}>{formatDate(task.due_date)}</span>}
        </span>
      </button>
    </li>
  );
}
