import { useState } from "react";
import { Check, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SavingNote({ saving }: { saving: boolean }) {
  return (
    <span role="status" aria-live="polite" className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
      {saving ? <><Loader2 className="size-3.5 animate-spin" /> Saving…</> : <><Check className="size-3.5" /> Saved</>}
    </span>
  );
}

/** "Add" input + button with inline validation. */
export function AddRow({ placeholder, onAdd, pending, max = 40 }: {
  placeholder: string; onAdd: (name: string) => Promise<unknown>; pending: boolean; max?: number;
}) {
  const [name, setName] = useState("");
  const [touched, setTouched] = useState(false);
  const trimmed = name.trim();
  const error = !trimmed ? "Enter a name" : trimmed.length > max ? `${max} characters max` : null;
  return (
    <form
      className="flex flex-wrap items-start gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setTouched(true);
        if (error) return;
        try { await onAdd(trimmed); setName(""); setTouched(false); } catch { /* toast shown */ }
      }}
    >
      <div className="min-w-48 flex-1">
        <Input aria-label={placeholder} placeholder={placeholder} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={touched && !!error} />
        {touched && error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Plus />} Add
      </Button>
    </form>
  );
}
