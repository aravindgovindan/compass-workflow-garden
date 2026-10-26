/**
 * Fallback terminology used when the project's own terminology map
 * (stored in the database, configured in Settings) is missing a term.
 */
export const DEFAULT_TERMS = {
  task: { singular: "Task", plural: "Tasks" },
  subtask: { singular: "Sub-task", plural: "Sub-tasks" },
  phase: { singular: "Phase", plural: "Phases" },
  milestone: { singular: "Milestone", plural: "Milestones" },
  risk: { singular: "Risk", plural: "Risks" },
  issue: { singular: "Issue", plural: "Issues" },
  member: { singular: "Member", plural: "Members" },
  // Section names (not editable entities)
  dashboard: { singular: "Dashboard", plural: "Dashboard" },
  team: { singular: "Team", plural: "Team" },
  activity: { singular: "Activity", plural: "Activity" },
  settings: { singular: "Settings", plural: "Settings" },
} as const;

export type TermKey = keyof typeof DEFAULT_TERMS;

/** Entity terms the owner can rename in Settings (matches the DB check constraint). */
export const EDITABLE_TERM_KEYS = ["task", "subtask", "phase", "milestone", "risk", "issue", "member"] as const;
export type EditableTermKey = (typeof EDITABLE_TERM_KEYS)[number];

export type TermForm = "singular" | "plural";
export type TermMap = Partial<Record<string, { singular?: string | null; plural?: string | null }>>;

/** Look up a term, falling back to the default label when missing or blank. Works on server and client. */
export function resolveTerm(map: TermMap | null | undefined, key: TermKey, form: TermForm = "plural"): string {
  const v = map?.[key]?.[form]?.trim();
  return v ? v : DEFAULT_TERMS[key][form];
}

export function toTermMap(rows: { key: string; singular: string; plural: string }[]): TermMap {
  return Object.fromEntries(rows.map((r) => [r.key, { singular: r.singular, plural: r.plural }]));
}
