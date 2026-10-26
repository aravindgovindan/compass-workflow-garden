import { canConfigure, canWrite, type ProjectRole } from "@/lib/auth/roles";

export const MILESTONE_STATUSES = ["upcoming", "at_risk", "achieved", "missed"] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export const MILESTONE_STATUS_LABEL: Record<MilestoneStatus, string> = {
  upcoming: "Upcoming", at_risk: "At risk", achieved: "Achieved", missed: "Missed",
};

export const AT_RISK_DAYS = 7;
export const AT_RISK_BELOW_PERCENT = 80;

export type Progress = { done: number; total: number; percent: number };

/** Percent complete from linked tasks in done-category statuses. 0 of 0 → 0%. */
export function milestoneProgress(categories: readonly string[]): Progress {
  const total = categories.length;
  const done = categories.filter((c) => c === "done").length;
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

function daysBetween(fromISO: string, toISO: string): number {
  const a = Date.UTC(+fromISO.slice(0, 4), +fromISO.slice(5, 7) - 1, +fromISO.slice(8, 10));
  const b = Date.UTC(+toISO.slice(0, 4), +toISO.slice(5, 7) - 1, +toISO.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

/**
 * Computed milestone status. An owner's override always wins.
 * - Achieved: has linked tasks and all are done
 * - Missed: target date has passed and not complete
 * - At risk: target date within 7 days and under 80% complete
 * - Upcoming: otherwise
 */
export function milestoneStatus(input: {
  targetDate: string; progress: Progress; override?: MilestoneStatus | null; today?: string;
}): MilestoneStatus {
  if (input.override) return input.override;
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const { done, total, percent } = input.progress;
  if (total > 0 && done === total) return "achieved";
  const days = daysBetween(today, input.targetDate);
  if (days < 0) return "missed";
  if (days <= AT_RISK_DAYS && percent < AT_RISK_BELOW_PERCENT) return "at_risk";
  return "upcoming";
}

/** Server-side write check: owners/members write; only owners set or clear the override. */
export function assertCanWriteMilestone(role: ProjectRole | null, opts: { touchesOverride?: boolean } = {}): void {
  if (!canWrite(role)) throw new Error("You have read-only access to this project.");
  if (opts.touchesOverride && !canConfigure(role)) throw new Error("Only the project owner can override a milestone's status.");
}
