import type { ProjectRole } from "@/lib/auth/roles";

export const RISK_STATUSES = ["open", "mitigating", "closed", "occurred"] as const;
export const RISK_RATINGS = ["low", "medium", "high", "critical"] as const;
export const ISSUE_SEVERITIES = ["low", "medium", "high", "critical"] as const;
export const ISSUE_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
export type RiskStatus = (typeof RISK_STATUSES)[number];
export type RiskRating = (typeof RISK_RATINGS)[number];
export type IssueSeverity = (typeof ISSUE_SEVERITIES)[number];
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

/** Risks still in play; these are counted on the heatmap. */
export const ACTIVE_RISK_STATUSES: readonly RiskStatus[] = ["open", "mitigating"];

export const ENUM_LABELS: Record<string, string> = {
  open: "Open", mitigating: "Mitigating", closed: "Closed", occurred: "Occurred",
  in_progress: "In progress", resolved: "Resolved",
  low: "Low", medium: "Medium", high: "High", critical: "Critical",
};

/** Rating bands: Low 1–4, Medium 5–9, High 10–14, Critical 15–25 (mirrors risk_rating_for() in the DB). */
export function ratingFor(score: number): RiskRating {
  if (score >= 15) return "critical";
  if (score >= 10) return "high";
  if (score >= 5) return "medium";
  return "low";
}

/** Score = probability × impact (each 1–5), plus its rating. */
export function riskScore(probability: number, impact: number): { score: number; rating: RiskRating } {
  for (const v of [probability, impact]) {
    if (!Number.isInteger(v) || v < 1 || v > 5) throw new Error("Probability and impact must be whole numbers from 1 to 5.");
  }
  const score = probability * impact;
  return { score, rating: ratingFor(score) };
}

/** Counts of active risks per cell: heat[probability-1][impact-1]. */
export function heatmapCounts(risks: { probability: number; impact: number; status: string }[]): number[][] {
  const heat = Array.from({ length: 5 }, () => Array<number>(5).fill(0));
  for (const r of risks) {
    if (!ACTIVE_RISK_STATUSES.includes(r.status as RiskStatus)) continue;
    const row = heat[r.probability - 1];
    if (row && r.impact >= 1 && r.impact <= 5) row[r.impact - 1] = (row[r.impact - 1] ?? 0) + 1;
  }
  return heat;
}

/** Owners and members write risks and issues; stakeholders are read-only. */
export function assertCanWriteRegister(role: ProjectRole | null) {
  if (role !== "owner" && role !== "member") throw new Error("You have read-only access.");
}

type ConvertibleRisk = { id: string; title: string; description: string | null; category: string | null; owner_id: string | null; status: string };

/** A risk can be converted unless it has already been turned into an issue. */
export function canConvertRisk(risk: { status: string }, existingIssueCount: number): boolean {
  return !(risk.status === "occurred" && existingIssueCount > 0);
}

/** The issue created from a risk (mirrors convert_risk_to_issue() in the DB). */
export function issueFromRisk(risk: ConvertibleRisk, severity: IssueSeverity) {
  return {
    title: risk.title, description: risk.description, category: risk.category,
    owner_id: risk.owner_id, source_risk_id: risk.id, severity, status: "open" as IssueStatus,
  };
}

/** Suggested severity for the new issue: same band as the risk rating. */
export const severityForRating = (r: RiskRating): IssueSeverity => r;
