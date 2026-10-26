import { Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Choose visible list columns; the choice is saved per user. */
export function ColumnPicker({ choices, visible, onChange }: { choices: { id: string; label: string }[]; visible: string[]; onChange: (ids: string[]) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9"><Columns3 className="size-4" />Columns</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2">
        <ul className="max-h-72 space-y-0.5 overflow-y-auto">
          {choices.map((c) => {
            const on = visible.includes(c.id);
            return (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                  <Checkbox checked={on} onCheckedChange={() => onChange(on ? visible.filter((v) => v !== c.id) : [...visible, c.id])} />
                  <span className="truncate">{c.label}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
