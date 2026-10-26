import { describe, it, expect } from "vitest";
import { completion, isOverdue, statusCompletion } from "./rules";
describe("dashboard rules", () => {
  it("uses done category with custom status names", () =>
    expect(
      statusCompletion([
        { name: "Signed off", category: "done", count: 7 },
        { name: "In review", category: "in_progress", count: 5 },
      ]),
    ).toEqual({ done: 7, total: 12, percent: 58 }));
  it("empty projects are zero percent", () =>
    expect(completion(0, 0)).toEqual({ done: 0, total: 0, percent: 0 }));
  it("unfinished tasks due before today are overdue", () =>
    expect(isOverdue("2026-10-25", "in_progress", "2026-10-26")).toBe(true));
  it("today is not overdue", () =>
    expect(isOverdue("2026-10-26", "todo", "2026-10-26")).toBe(false));
  it("done tasks are not overdue", () =>
    expect(isOverdue("2026-10-25", "done", "2026-10-26")).toBe(false));
  it("undated tasks are not overdue", () =>
    expect(isOverdue(null, "todo", "2026-10-26")).toBe(false));
});
