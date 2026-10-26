/**
 * Fallback terminology used until the project's own terminology map
 * (stored in the database, configured in Settings) is loaded.
 */
export const DEFAULT_TERMS = {
  dashboard: { singular: "Dashboard", plural: "Dashboard" },
  task: { singular: "Task", plural: "Tasks" },
  milestone: { singular: "Milestone", plural: "Milestones" },
  risk: { singular: "Risk", plural: "Risks" },
  issue: { singular: "Issue", plural: "Issues" },
  team: { singular: "Team", plural: "Team" },
  activity: { singular: "Activity", plural: "Activity" },
  settings: { singular: "Settings", plural: "Settings" },
} as const;

export type TermKey = keyof typeof DEFAULT_TERMS;
