export type ProjectRole = "owner" | "member" | "stakeholder";

export type Section =
  | "dashboard"
  | "tasks"
  | "milestones"
  | "risks"
  | "issues"
  | "team"
  | "activity"
  | "settings";

/** Sections a stakeholder may open (read-only). */
export const STAKEHOLDER_SECTIONS: readonly Section[] = ["dashboard", "milestones", "risks", "issues"];

/**
 * Whether a role may open a section. `null` means the user has no project yet
 * (first run); they may move around so the setup flow can guide them.
 */
export function canAccessSection(role: ProjectRole | null, section: Section): boolean {
  if (role === null) return true;
  if (role === "stakeholder") return STAKEHOLDER_SECTIONS.includes(section);
  if (section === "settings") return role === "owner";
  return true;
}

/** Create and update work, comment. */
export function canWrite(role: ProjectRole | null): boolean {
  return role === "owner" || role === "member";
}

/** Change project profile and configuration. */
export function canConfigure(role: ProjectRole | null): boolean {
  return role === "owner";
}
