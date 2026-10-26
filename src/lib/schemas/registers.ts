import { z } from "zod";
import { ISSUE_SEVERITIES, ISSUE_STATUSES, RISK_RATINGS, RISK_STATUSES } from "@/lib/risks/score";

const id = z.string().uuid();
const title = z.string().trim().min(1, "Title is required").max(200, "200 characters max");
const text = (max: number) => z.string().trim().max(max, `${max} characters max`).nullable().transform((v) => (v ? v : null));
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date").nullable();
const level = z.number().int().min(1).max(5);
const custom = z.record(z.string(), z.unknown());

const riskFields = z.object({
  description: text(10000), category: text(60), probability: level, impact: level, owner_id: id.nullable(),
  mitigation_plan: text(10000), status: z.enum(RISK_STATUSES), review_date: date, custom_fields: custom,
});
export const riskCreate = riskFields.partial().extend({ title });
export const riskUpdate = riskFields.partial().extend({ id, title: title.optional() });

const issueFields = z.object({
  description: text(10000), category: text(60), severity: z.enum(ISSUE_SEVERITIES), raised_by: id.nullable(),
  owner_id: id.nullable(), status: z.enum(ISSUE_STATUSES), target_date: date, resolution: text(10000), custom_fields: custom,
});
export const issueCreate = issueFields.partial().extend({ title });
export const issueUpdate = issueFields.partial().extend({ id, title: title.optional() });

export const riskConvert = z.object({ id, severity: z.enum(ISSUE_SEVERITIES) });

// ---- List filters (also the URL search params, so views are shareable) ----
export const NO_OWNER = "none";
const arr = <T extends z.ZodTypeAny>(t: T) =>
  z.preprocess((v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]), z.array(t).max(50)).catch([]);
const owner = arr(z.union([id, z.literal(NO_OWNER)]));
const category = arr(z.string().max(60));
const dir = z.enum(["asc", "desc"]).catch("desc");
const cell = z.coerce.number().int().min(1).max(5).optional().catch(undefined);

export const RISK_SORTS = ["score", "title", "status", "review_date", "updated_at"] as const;
export const riskFilters = z.object({
  status: arr(z.enum(RISK_STATUSES)), owner, rating: arr(z.enum(RISK_RATINGS)), category,
  p: cell, i: cell, sort: z.enum(RISK_SORTS).catch("score"), dir,
});
export const riskSearch = riskFilters.extend({ item: id.optional().catch(undefined) });
export type RiskFilters = z.infer<typeof riskFilters>;

export const ISSUE_SORTS = ["severity", "title", "status", "target_date", "updated_at"] as const;
export const issueFilters = z.object({
  status: arr(z.enum(ISSUE_STATUSES)), owner, severity: arr(z.enum(ISSUE_SEVERITIES)), category,
  sort: z.enum(ISSUE_SORTS).catch("severity"), dir,
});
export const issueSearch = issueFilters.extend({ item: id.optional().catch(undefined) });
export type IssueFilters = z.infer<typeof issueFilters>;

/** Drop empty and default values so shared links stay short. */
export function tidySearch<T extends Record<string, unknown>>(s: T): T {
  return Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0))) as T;
}
