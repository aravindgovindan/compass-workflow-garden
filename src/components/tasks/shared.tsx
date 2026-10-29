import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { swatchClass } from "@/lib/config/colors";

export const NONE = "__none";

export function Dot({ color }: { color: string }) {
  return <span aria-hidden className={`inline-block size-2.5 shrink-0 rounded-full ${swatchClass(color)}`} />;
}

export function formatDate(d: string | null): string {
  if (!d) return "";
  return new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function isOverdue(due: string | null, completedAt: string | null): boolean {
  if (!due || completedAt) return false;
  return due < new Date().toISOString().slice(0, 10);
}

function unlockBodySoon() {
  for (const ms of [0, 150, 400]) {
    setTimeout(() => {
      if (document.body.style.pointerEvents === "none" && !document.querySelector("[role=listbox]")) {
        document.body.style.pointerEvents = "";
      }
    }, ms);
  }
}

/** Select with optional "none" choice; value null means none. */
export function PickOne({
  id, label, value, onChange, options, allowNone, noneLabel = "None", disabled,
}: {
  id: string; label: string; value: string | null; onChange: (v: string | null) => void;
  options: { value: string; label: string; color?: string }[]; allowNone?: boolean; noneLabel?: string; disabled?: boolean;
}) {
  return (
    <Select
      value={value ?? NONE}
      onValueChange={(v) => {
        // Let the menu finish closing before the page re-renders (e.g. URL updates),
        // otherwise Radix can leave the body pointer lock in place.
        requestAnimationFrame(() => onChange(v === NONE ? null : v));
        unlockBodySoon();
      }}
      onOpenChange={(open) => { if (!open) unlockBodySoon(); }}
      disabled={disabled ?? false}
    >
      <SelectTrigger id={id} aria-label={label} className="h-9"><SelectValue /></SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value={NONE}>{noneLabel}</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            <span className="flex items-center gap-2">{o.color && <Dot color={o.color} />}{o.label}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
