import { z } from "zod";
import { canConfigure, type ProjectRole } from "@/lib/auth/roles";
import type { CustomFieldDef, CustomValues } from "@/lib/custom-fields/types";
import { validateCustomValues } from "@/lib/custom-fields/validate";
import { resolveTerm, type TermMap } from "@/lib/terminology/defaults";
import { mentionToken } from "@/lib/collaboration/rules";

export function assertDemoOwner(role: ProjectRole | null) {
  if (!canConfigure(role)) throw new Error("Only the project owner can manage demo data.");
}

export const demoAction = z.object({ confirmation: z.literal("REMOVE DEMO") });
const id = z.string().uuid();
export const demoPayloadSchema = z.object({
  phases: z.array(z.object({ name: z.string().min(1).max(80), start_date: z.string(), end_date: z.string() })).length(3),
  milestones: z.array(z.object({ name: z.string().min(1).max(120), description: z.string(), target_date: z.string() })).length(4),
  tasks: z.array(z.object({ title: z.string().min(1).max(200), description: z.string(), phase: z.number().int().min(0).max(2), milestone: z.number().int().min(0).max(3), parent: z.number().int().min(0).max(31).nullable(), status_id: id, priority_id: id.nullable(), start_date: z.string(), due_date: z.string(), custom_fields: z.record(z.unknown()) })).length(40),
  risks: z.array(z.object({ title: z.string(), description: z.string(), probability: z.number().int().min(1).max(5), impact: z.number().int().min(1).max(5), mitigation_plan: z.string(), status: z.enum(["open", "mitigating"]), review_date: z.string(), custom_fields: z.record(z.unknown()) })).length(8),
  issues: z.array(z.object({ title: z.string(), description: z.string(), severity: z.enum(["low", "medium", "high", "critical"]), status: z.enum(["open", "in_progress", "resolved"]), target_date: z.string(), custom_fields: z.record(z.unknown()) })).length(5),
  comments: z.array(z.object({ entity_type: z.enum(["task", "risk", "issue"]), index: z.number().int().min(0), body: z.string().min(1).max(5000) })),
});

export function demoCustomValues(defs: CustomFieldDef[], today: string, userId: string, memberIds = [userId]): CustomValues {
  const values: CustomValues = {};
  for (const d of defs.filter((f) => !f.archived)) {
    values[d.key] = d.default_value ?? ({ text: "Launch readiness", long_text: "Reviewed with the delivery team.", number: 3, date: today, dropdown: d.options[0], multi_select: d.options.slice(0, 1), user: userId, checkbox: false, url: "https://compass-workflow.lovable.app" }[d.type]);
  }
  const checked = validateCustomValues(defs, values, { memberIds });
  if (!checked.ok) throw new Error(`Demo data needs valid custom fields: ${Object.values(checked.errors).join(" ")}`);
  return checked.values;
}

const titles = ["Agree delivery objectives", "Interview customer support", "Map the current workflow", "Review customer feedback", "Define acceptance criteria", "Confirm project scope", "Review delivery budget", "Approve launch brief", "Design intake form", "Prototype approval flow", "Review accessibility", "Validate reporting needs", "Build intake workflow", "Implement approval rules", "Prepare migration mapping", "Review data quality", "Run integration checks", "Test failure recovery", "Review security controls", "Document operating procedures", "Run pilot onboarding", "Collect pilot feedback", "Resolve usability findings", "Prepare support training", "Review launch checklist", "Complete acceptance testing", "Confirm rollback plan", "Approve release candidate", "Publish team guidance", "Coordinate go-live support", "Monitor adoption", "Review outcomes"];
const riskTitles = ["Supplier response delays", "Incomplete source data", "Pilot participation drops", "Approval bottleneck", "Accessibility gaps", "Support capacity shortfall", "Late scope changes", "Release rollback uncertainty"];
const issueTitles = ["Missing customer contact fields", "Approval emails contain stale links", "Pilot access request backlog", "Duplicate intake records", "Training guide screenshots outdated"];

export function buildDemo(config: { statuses: { id: string; category: string }[]; priorities: { id: string }[]; terms: TermMap; fields: Record<"task" | "risk" | "issue", CustomValues>; userId: string; name: string }, now = new Date()) {
  const date = (offset: number) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset)).toISOString().slice(0, 10);
  const fallback = config.statuses[0];
  if (!fallback) throw new Error("Add a workflow status before loading demo data.");
  const status = (i: number) => config.statuses.find((s) => s.category === (i < 10 ? "done" : i < 22 ? "in_progress" : "todo"))?.id ?? fallback.id;
  const term = (key: "task" | "phase" | "milestone" | "risk" | "issue") => resolveTerm(config.terms, key, "singular").toLowerCase();
  const tasks = Array.from({ length: 40 }, (_, i) => ({ title: i < 32 ? titles[i] ?? "Review launch readiness" : `Verify evidence: ${titles[i - 32]}`, description: `Demo ${term("task")} for a customer onboarding launch. Confirm acceptance criteria and record the outcome.`, phase: i < 32 ? Math.min(2, Math.floor(i / 11)) : 0, milestone: i < 32 ? Math.floor(i / 8) : 0, parent: i < 32 ? null : i - 32, status_id: status(i), priority_id: config.priorities[i % Math.max(1, config.priorities.length)]?.id ?? null, start_date: date(-28 + Math.min(i, 20)), due_date: date(i < 32 ? -12 + i : 5 + i - 32), custom_fields: config.fields.task }));
  const mention = mentionToken(config.name.slice(0, 100) || "Project owner", config.userId);
  return demoPayloadSchema.parse({
    phases: ["Discovery", "Delivery", "Launch"].map((name, i) => ({ name, start_date: date(-28 + i * 14), end_date: date(-15 + i * 21) })),
    milestones: ["Discovery sign-off", "Pilot ready", "Launch approval", "Adoption review"].map((name, i) => ({ name, description: `Demo ${term("milestone")} for the onboarding launch.`, target_date: date([-5, 5, 14, 28][i] ?? 28) })),
    tasks,
    risks: riskTitles.map((title, i) => ({ title, description: `Demo ${term("risk")}: review likelihood with the team.`, probability: i % 5 + 1, impact: (i * 2) % 5 + 1, mitigation_plan: "Confirm a fallback, assign an action owner and review at the next checkpoint.", status: i % 2 ? "mitigating" : "open", review_date: date(i - 2), custom_fields: config.fields.risk })),
    issues: issueTitles.map((title, i) => ({ title, description: `Demo ${term("issue")}: reproduce, resolve and verify with the pilot team.`, severity: (["high", "critical", "medium", "low", "medium"] as const)[i], status: i === 4 ? "resolved" : i % 2 ? "in_progress" : "open", target_date: date(i * 3 - 2), custom_fields: config.fields.issue })),
    comments: (["task", "task", "risk", "risk", "issue", "issue"] as const).map((entity_type, i) => ({ entity_type, index: i % 2, body: `${mention} Please review the evidence before the next checkpoint. The pilot team has confirmed the next action.` })),
  });
}