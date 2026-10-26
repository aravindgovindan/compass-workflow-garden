import { positionBetween } from "./rules";

type Card = { id: string; status_id: string; position: number };

/** Cards of one column in board order. */
export function columnCards<T extends Card>(rows: T[], statusId: string): T[] {
  return rows.filter((r) => r.status_id === statusId).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

/**
 * New position for `movingId` dropped at `index` in the target column
 * (index counted among the column's other cards, i.e. excluding the moving card).
 */
export function dropPosition<T extends Card>(rows: T[], movingId: string, statusId: string, index: number): number {
  const others = columnCards(rows, statusId).filter((r) => r.id !== movingId);
  const i = Math.max(0, Math.min(index, others.length));
  return positionBetween(others[i - 1]?.position ?? null, others[i]?.position ?? null);
}

/** Optimistic local move. */
export function applyMove<T extends Card>(rows: T[], id: string, statusId: string, position: number): T[] {
  return rows.map((r) => (r.id === id ? { ...r, status_id: statusId, position } : r));
}
