import { describe, expect, it } from "vitest";
import { assertCanWriteTasks, checkSubtaskParent, mergeCustomFields, nextCompletedAt, positionBetween } from "./rules";
import { taskUpdate } from "@/lib/schemas/tasks";
import type { CustomFieldDef } from "@/lib/custom-fields/types";

describe("completed_at", () => {
  const now = new Date("2026-10-26T10:00:00.000Z");
  it("is set when a task enters a done status", () => {
    expect(nextCompletedAt(null, "done", now)).toBe("2026-10-26T10:00:00.000Z");
  });
  it("is kept when moving between done statuses", () => {
    expect(nextCompletedAt("2026-10-01T00:00:00.000Z", "done", now)).toBe("2026-10-01T00:00:00.000Z");
  });
  it("is cleared when a task leaves done", () => {
    expect(nextCompletedAt("2026-10-01T00:00:00.000Z", "in_progress", now)).toBeNull();
    expect(nextCompletedAt("2026-10-01T00:00:00.000Z", "todo", now)).toBeNull();
  });
});

describe("sub-task depth", () => {
  it("allows a top-level parent", () => {
    expect(checkSubtaskParent({ id: "a", parent_task_id: null })).toBeNull();
  });
  it("blocks a sub-task of a sub-task", () => {
    expect(checkSubtaskParent({ id: "b", parent_task_id: "a" })).toMatch(/cannot have their own/);
  });
  it("blocks a task with sub-tasks becoming a sub-task, and self-parenting", () => {
    expect(checkSubtaskParent({ id: "a", parent_task_id: null }, { taskId: "c", taskHasChildren: true })).toMatch(/cannot become/);
    expect(checkSubtaskParent({ id: "c", parent_task_id: null }, { taskId: "c" })).toMatch(/own parent/);
  });
});

describe("custom fields on save", () => {
  const defs: CustomFieldDef[] = [
    { id: "1", key: "cost", name: "Cost", type: "number", options: [], required: false },
    { id: "2", key: "team", name: "Team", type: "dropdown", options: ["Ops", "Dev"], required: true },
  ];
  it("merges a valid patch with stored values", () => {
    expect(mergeCustomFields(defs, { team: "Ops" }, { cost: "12" }, [])).toEqual({ team: "Ops", cost: 12 });
  });
  it("rejects an invalid value", () => {
    expect(() => mergeCustomFields(defs, { team: "Ops" }, { team: "Sales" }, [])).toThrow(/listed options/);
  });
  it("rejects clearing a required field", () => {
    expect(() => mergeCustomFields(defs, { team: "Ops" }, { team: null }, [])).toThrow(/Team is required/);
  });
});

describe("stakeholders cannot write", () => {
  it("throws for stakeholders and no-role, allows owner and member", () => {
    expect(() => assertCanWriteTasks("stakeholder")).toThrow(/read-only/);
    expect(() => assertCanWriteTasks(null)).toThrow();
    expect(() => assertCanWriteTasks("owner")).not.toThrow();
    expect(() => assertCanWriteTasks("member")).not.toThrow();
  });
});

describe("task input", () => {
  it("rejects a due date before the start date", () => {
    const r = taskUpdate.safeParse({ id: "11111111-1111-4111-8111-111111111111", start_date: "2026-10-20", due_date: "2026-10-10" });
    expect(r.success).toBe(false);
  });
  it("positions between neighbours", () => {
    expect(positionBetween(1, 2)).toBe(1.5);
    expect(positionBetween(null, 0)).toBe(-1);
    expect(positionBetween(3, null)).toBe(4);
  });
});
