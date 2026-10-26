import { useState } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { taskTitle } from "@/lib/schemas/tasks";
import { useCreateTask } from "@/lib/tasks/queries";
import { useTerm } from "@/lib/terminology/use-term";

/** Type a title and press Enter. Uses the default status and priority (chosen on the server). */
export function QuickAdd({ phaseId, parentTaskId, compact }: { phaseId?: string | null; parentTaskId?: string; compact?: boolean }) {
  const term = useTerm();
  const create = useCreateTask();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const noun = term(parentTaskId ? "subtask" : "task", "singular").toLowerCase();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const r = taskTitle.safeParse(title);
        if (!r.success) { setError(r.error.issues[0]?.message ?? "Invalid title"); return; }
        setError(null);
        setTitle("");
        create.mutate({ title: r.data, phase_id: phaseId ?? null, parent_task_id: parentTaskId ?? null }, {
          onError: () => setTitle(r.data),
        });
      }}
    >
      <div className="relative">
        <Plus className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label={`Add a ${noun}`}
          aria-invalid={!!error}
          placeholder={`Add a ${noun} and press Enter`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={compact ? "h-9 pl-9" : "h-10 pl-9"}
        />
      </div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </form>
  );
}
