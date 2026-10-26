import { swatchClass } from "@/lib/config/colors";

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1]![0] : "")).toUpperCase();
}

export function PersonAvatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span
      title={name}
      aria-label={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary ${size === "sm" ? "size-6 text-[10px]" : "size-7 text-xs"}`}
    >
      {initials(name)}
    </span>
  );
}

export function LabelChips({ ids, labels, max = 3 }: { ids: string[]; labels: { id: string; name: string; color: string }[]; max?: number }) {
  const list = ids.map((id) => labels.find((l) => l.id === id)).filter((l): l is NonNullable<typeof l> => !!l);
  if (!list.length) return null;
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1">
      {list.slice(0, max).map((l) => (
        <span key={l.id} className="flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[11px] text-secondary-foreground">
          <span aria-hidden className={`size-1.5 rounded-full ${swatchClass(l.color)}`} />{l.name}
        </span>
      ))}
      {list.length > max && <span className="text-[11px] text-muted-foreground">+{list.length - max}</span>}
    </span>
  );
}
