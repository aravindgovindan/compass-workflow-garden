/** Memberships must already be filtered to active, caller-accessible rows. */
export function selectMembership<T extends { project_id: string }>(memberships: T[], activeProjectId: string | null | undefined): T | null {
  return memberships.find((m) => m.project_id === activeProjectId) ?? memberships[0] ?? null;
}

export function assertProjectSelection<T extends { project_id: string }>(memberships: T[], projectId: string): T {
  const membership = memberships.find((m) => m.project_id === projectId);
  if (!membership) throw new Error("Project access denied.");
  return membership;
}