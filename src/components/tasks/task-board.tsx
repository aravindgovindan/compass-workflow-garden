import { useMemo, useState } from "react";
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCorners, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { TaskListItem } from "@/functions/tasks.functions";
import type { ProjectConfig } from "@/functions/config.functions";
import { columnCards, dropPosition } from "@/lib/tasks/board";
import { useMoveTask } from "@/lib/tasks/queries";
import { useTerm } from "@/lib/terminology/use-term";
import { Button } from "@/components/ui/button";
import { Dot, formatDate, isOverdue } from "./shared";
import { LabelChips, PersonAvatar } from "./person";

const PAGE = 50; // cards rendered per column before "Show more"

/** Kanban board: one column per workflow status, in configured order. */
export function TaskBoard({ tasks, config, onOpen }: { tasks: TaskListItem[]; config: ProjectConfig; onOpen: (id: string) => void }) {
  const move = useMoveTask();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [limits, setLimits] = useState<Record<string, number>>({});
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const columns = useMemo(() => config.statuses.map((s) => ({ status: s, cards: columnCards(tasks, s.id) })), [tasks, config.statuses]);
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const active = activeId ? byId.get(activeId) : undefined;

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const id = String(e.active.id);
    const task = byId.get(id);
    if (!task || !e.over) return;
    const overId = String(e.over.id);
    let statusId: string, index: number;
    if (overId.startsWith("col:")) {
      statusId = overId.slice(4);
      index = Number.MAX_SAFE_INTEGER;
    } else {
      const over = byId.get(overId);
      if (!over || over.id === id) return;
      statusId = over.status_id;
      const col = columnCards(tasks, statusId);
      const overIdx = col.findIndex((c) => c.id === overId);
      // Same column: moving down lands after the target, moving up lands before it.
      index = overIdx;
      if (statusId === task.status_id) {
        const fromIdx = col.findIndex((c) => c.id === id);
        if (fromIdx === overIdx) return;
      }
    }
    const position = dropPosition(tasks, id, statusId, index);
    if (statusId === task.status_id && position === task.position) return;
    move.mutate({ id, status_id: statusId, position });
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="flex gap-3 overflow-x-auto pb-3" role="list" aria-label="Board">
        {columns.map(({ status, cards }) => {
          const limit = limits[status.id] ?? PAGE;
          return (
            <Column key={status.id} id={status.id} name={status.name} color={status.color} count={cards.length}>
              <SortableContext items={cards.slice(0, limit).map((c) => c.id)} strategy={verticalListSortingStrategy}>
                {cards.slice(0, limit).map((t) => <SortableCard key={t.id} task={t} config={config} onOpen={onOpen} />)}
              </SortableContext>
              {cards.length > limit && (
                <Button variant="ghost" size="sm" className="w-full" onClick={() => setLimits((l) => ({ ...l, [status.id]: limit + PAGE }))}>
                  Show {Math.min(PAGE, cards.length - limit)} more
                </Button>
              )}
            </Column>
          );
        })}
      </div>
      <DragOverlay>{active ? <Card task={active} config={config} dragging /> : null}</DragOverlay>
    </DndContext>
  );
}

function Column({ id, name, color, count, children }: { id: string; name: string; color: string; count: number; children: React.ReactNode }) {
  const term = useTerm();
  const { setNodeRef, isOver } = useDroppable({ id: `col:${id}` });
  return (
    <section role="listitem" aria-label={`${name}, ${count}`} className="flex w-72 shrink-0 flex-col rounded-lg border bg-muted/40">
      <header className="flex items-center gap-2 px-3 py-2.5">
        <Dot color={color} /><h2 className="truncate font-display text-sm font-semibold">{name}</h2>
        <span className="ml-auto text-xs text-muted-foreground">{count}</span>
      </header>
      <div ref={setNodeRef} className={`flex max-h-[calc(100vh-17rem)] min-h-24 flex-col gap-2 overflow-y-auto px-2 pb-2 ${isOver ? "bg-accent/40" : ""}`}>
        {children}
        {count === 0 && <p className="px-1 py-4 text-center text-xs text-muted-foreground">No {term("task").toLowerCase()}</p>}
      </div>
    </section>
  );
}

function SortableCard({ task, config, onOpen }: { task: TaskListItem; config: ProjectConfig; onOpen: (id: string) => void }) {
  const pending = task.id.startsWith("temp-");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled: pending });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={isDragging ? "opacity-40" : ""}
      {...attributes} {...listeners}
      onClick={() => !pending && onOpen(task.id)}
      onKeyDown={(e) => { listeners?.["onKeyDown"]?.(e); if (e.key === "Enter" && !pending) onOpen(task.id); }}
      aria-label={task.title}>
      <Card task={task} config={config} />
    </div>
  );
}

function Card({ task, config, dragging }: { task: TaskListItem; config: ProjectConfig; dragging?: boolean }) {
  const priority = config.priorities.find((p) => p.id === task.priority_id);
  const assignee = config.members.find((m) => m.user_id === task.assignee_id);
  const overdue = isOverdue(task.due_date, task.completed_at);
  return (
    <article className={`cursor-grab space-y-2 rounded-md border bg-card p-2.5 text-sm shadow-sm hover:border-primary/40 ${dragging ? "rotate-1 shadow-lg" : ""}`}>
      <p className={`line-clamp-3 font-medium ${task.completed_at ? "text-muted-foreground line-through" : ""}`}>{task.title}</p>
      <LabelChips ids={task.label_ids} labels={config.labels} />
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {priority && <span className="flex items-center gap-1"><Dot color={priority.color} />{priority.name}</span>}
        {task.due_date && <span className={overdue ? "font-medium text-destructive" : ""}>{overdue ? "Overdue · " : ""}{formatDate(task.due_date)}</span>}
        <span className="ml-auto">{assignee && <PersonAvatar name={assignee.full_name} />}</span>
      </div>
    </article>
  );
}
