import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const health = cva("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", {
  variants: {
    value: {
      green: "bg-health-green-soft text-health-green",
      amber: "bg-health-amber-soft text-accent-foreground",
      red: "bg-health-red-soft text-health-red",
    },
  },
});
const dot = { green: "bg-health-green", amber: "bg-health-amber", red: "bg-health-red" } as const;
const label = { green: "Green", amber: "Amber", red: "Red" } as const;

export function HealthBadge({ value, className }: { value: "green" | "amber" | "red"; className?: string }) {
  return (
    <span className={cn(health({ value }), className)}>
      <span className={cn("size-1.5 rounded-full", dot[value])} aria-hidden />
      {label[value]}
    </span>
  );
}
