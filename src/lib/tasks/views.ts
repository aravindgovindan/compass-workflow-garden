/** Saved views and view preferences are private to one user. Mirrors the saved_views RLS policies. */
export function isOwnView(view: { user_id: string } | null | undefined, userId: string): boolean {
  return !!view && view.user_id === userId;
}

export function assertOwnView(view: { user_id: string } | null | undefined, userId: string): void {
  if (!isOwnView(view, userId)) throw new Error("That view no longer exists.");
}

export const DEFAULT_LIST_COLUMNS = ["status", "priority", "assignee", "labels", "due_date"] as const;
