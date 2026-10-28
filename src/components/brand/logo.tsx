import { Compass } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-display text-lg font-semibold", className)}>
      <span
        className={cn(
          "grid size-7 place-items-center rounded-md",
          inverted ? "bg-sidebar-primary text-sidebar-primary-foreground" : "bg-primary text-primary-foreground",
        )}
        aria-hidden
      >
        <Compass className="size-4" strokeWidth={2.5} />
      </span>
      Compass Workflow
    </span>
  );
}
