import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CONFIG_COLORS, swatchClass } from "@/lib/config/colors";
import { cn } from "@/lib/utils";

export function ColorDot({ color, className }: { color: string; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-3 shrink-0 rounded-full", swatchClass(color), className)} />;
}

export function ColorPicker({ value, onChange, label = "Color" }: { value: string; onChange: (c: string) => void; label?: string }) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`${label}: ${value}`}
        className="grid size-9 shrink-0 place-items-center rounded-md border bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ColorDot color={value} className="size-4" />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2">
        <div role="radiogroup" aria-label={label} className="grid grid-cols-4 gap-1.5">
          {CONFIG_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={c === value}
              aria-label={c}
              onClick={() => onChange(c)}
              className={cn(
                "grid size-8 place-items-center rounded-md hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                c === value && "bg-muted ring-1 ring-ring",
              )}
            >
              <ColorDot color={c} className="size-4" />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
