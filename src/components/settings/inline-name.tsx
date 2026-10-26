import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

/** Text input that saves on blur/Enter, with inline validation. */
export function InlineName({
  value,
  onSave,
  label,
  max = 40,
  disabled,
}: {
  value: string;
  onSave: (v: string) => void;
  label: string;
  max?: number;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const trimmed = draft.trim();
  const error = !trimmed ? "Required" : trimmed.length > max ? `${max} characters max` : null;
  function commit() {
    if (error) return;
    if (trimmed !== value) onSave(trimmed);
  }
  return (
    <div className="min-w-32 flex-1">
      <Input
        aria-label={label}
        aria-invalid={!!error}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setDraft(value);
        }}
        className="h-9"
      />
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
