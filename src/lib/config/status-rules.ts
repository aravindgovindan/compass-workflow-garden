export type StatusLite = { id: string; is_default: boolean };

/**
 * Whether a workflow status may be deleted. Returns an error message, or null when allowed.
 * - The last status cannot be removed.
 * - A status that is in use needs a replacement status (another existing status).
 */
export function checkStatusDeletion(
  statuses: StatusLite[],
  statusId: string,
  usageCount: number,
  replacementId?: string | null,
): string | null {
  if (!statuses.some((s) => s.id === statusId)) return "That status no longer exists.";
  if (statuses.length <= 1) return "A workflow needs at least one status.";
  if (usageCount > 0) {
    if (!replacementId) return `This status is used by ${usageCount} item(s). Choose a replacement status.`;
    if (replacementId === statusId) return "The replacement must be a different status.";
    if (!statuses.some((s) => s.id === replacementId)) return "The replacement status does not exist.";
  }
  return null;
}

/** After deleting a default status, pick the next default (first remaining by order). */
export function nextDefaultStatus(statuses: StatusLite[], deletedId: string): string | null {
  const deleted = statuses.find((s) => s.id === deletedId);
  if (!deleted?.is_default) return null;
  return statuses.find((s) => s.id !== deletedId)?.id ?? null;
}
