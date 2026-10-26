import { describe, expect, it } from "vitest";
import { assertCanWriteMilestone, milestoneProgress, milestoneStatus } from "./status";
import { canAccessSection } from "@/lib/auth/roles";

describe("milestone percent complete", () => {
  it("shows 0 of 0 without dividing by zero", () => {
    expect(milestoneProgress([])).toEqual({ done: 0, total: 0, percent: 0 });
  });
  it("counts only done-category statuses", () => {
    expect(milestoneProgress(["done", "todo", "in_progress", "done"])).toEqual({ done: 2, total: 4, percent: 50 });
  });
  it("is 100% when all done", () => {
    expect(milestoneProgress(["done", "done", "done"])).toEqual({ done: 3, total: 3, percent: 100 });
  });
  it("rounds, e.g. 7 of 12", () => {
    expect(milestoneProgress([...Array(7).fill("done"), ...Array(5).fill("todo")]).percent).toBe(58);
  });
});

describe("milestone computed status", () => {
  const today = "2026-10-26";
  const p = (done: number, total: number) => ({ done, total, percent: total ? Math.round((done / total) * 100) : 0 });
  it("achieved when all linked tasks are done, even past the date", () => {
    expect(milestoneStatus({ targetDate: "2026-10-01", progress: p(4, 4), today })).toBe("achieved");
  });
  it("missed when the date has passed and not complete", () => {
    expect(milestoneStatus({ targetDate: "2026-10-25", progress: p(3, 4), today })).toBe("missed");
    expect(milestoneStatus({ targetDate: "2026-10-25", progress: p(0, 0), today })).toBe("missed");
  });
  it("at risk within 7 days and under 80%", () => {
    expect(milestoneStatus({ targetDate: "2026-11-02", progress: p(7, 10), today })).toBe("at_risk");
    expect(milestoneStatus({ targetDate: today, progress: p(0, 0), today })).toBe("at_risk");
  });
  it("upcoming at 80%+ within 7 days, or more than 7 days away", () => {
    expect(milestoneStatus({ targetDate: "2026-11-02", progress: p(8, 10), today })).toBe("upcoming");
    expect(milestoneStatus({ targetDate: "2026-11-03", progress: p(0, 10), today })).toBe("upcoming");
  });
  it("override wins, and clearing it restores the computed status", () => {
    expect(milestoneStatus({ targetDate: "2026-10-25", progress: p(1, 4), override: "achieved", today })).toBe("achieved");
    expect(milestoneStatus({ targetDate: "2026-10-25", progress: p(1, 4), override: null, today })).toBe("missed");
  });
});

describe("milestone access", () => {
  it("stakeholders can open milestones but not write", () => {
    expect(canAccessSection("stakeholder", "milestones")).toBe(true);
    expect(() => assertCanWriteMilestone("stakeholder")).toThrow(/read-only/);
  });
  it("members write but cannot override; owners can", () => {
    expect(() => assertCanWriteMilestone("member")).not.toThrow();
    expect(() => assertCanWriteMilestone("member", { touchesOverride: true })).toThrow(/owner/);
    expect(() => assertCanWriteMilestone("owner", { touchesOverride: true })).not.toThrow();
  });
});
