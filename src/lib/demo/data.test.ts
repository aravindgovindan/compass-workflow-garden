import { describe, expect, it } from "vitest";
import { assertDemoOwner, buildDemo } from "./data";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const demo = () => buildDemo({ statuses: [{ id: id(1), category: "todo" }, { id: id(2), category: "in_progress" }, { id: id(3), category: "done" }], priorities: [{ id: id(4) }], terms: { task: { singular: "Story", plural: "Stories" } }, fields: { task: {}, risk: {}, issue: {} }, userId: id(9), name: "Avery" }, new Date("2026-10-26T12:00:00Z"));

describe("demo data", () => {
  it("contains the requested demo volume", () => {
    const d = demo();
    expect([d.tasks.length, d.tasks.filter((t) => t.parent !== null).length, d.phases.length, d.milestones.length, d.risks.length, d.issues.length]).toEqual([40, 8, 3, 4, 8, 5]);
  });
  it("uses configured statuses and terminology", () => {
    const d = demo();
    expect(new Set(d.tasks.map((t) => t.status_id))).toEqual(new Set([id(1), id(2), id(3)]));
    expect(d.tasks[0]?.description).toContain("Demo story");
  });
  it("dates records relative to the UTC load date", () => {
    expect(demo().milestones.map((m) => m.target_date)).toEqual(["2026-10-21", "2026-10-31", "2026-11-09", "2026-11-23"]);
  });
  it("only lets owners manage demo data", () => {
    expect(() => assertDemoOwner("owner")).not.toThrow();
    expect(() => assertDemoOwner("member")).toThrow();
    expect(() => assertDemoOwner("stakeholder")).toThrow();
  });
});