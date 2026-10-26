import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { MILESTONE_STATUS_LABEL, type MilestoneStatus, type Progress } from "@/lib/milestones/status";

const badge = cva("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", {
  variants: {
    value: {
      upcoming: "bg-secondary text-secondary-foreground",
      at_risk: "bg-health-amber-soft text-accent-foreground",
      achieved: "bg-health-green-soft text-health-green",
      missed: "bg-health-red-soft text-health-red",
    },
  },
});

export function MilestoneStatusBadge({ value, overridden }: { value: MilestoneStatus; overridden?: boolean }) {
  return (
    <span className={badge({ value })} title={overridden ? "Set by the owner" : "Calculated from linked items"}>
      {MILESTONE_STATUS_LABEL[value]}{overridden ? " · set" : ""}
    </span>
  );
}

export function ProgressBar({ progress, className }: { progress: Progress; className?: string }) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={progress.percent} aria-label={`${progress.percent}% complete`}>
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress.percent}%` }} />
      </div>
      <p className="text-xs tabular-nums text-muted-foreground">{progress.done} of {progress.total} done · {progress.percent}%</p>
    </div>
  );
}
