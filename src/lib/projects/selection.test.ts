import { describe, expect, it } from "vitest";
import { assertProjectSelection, selectMembership } from "./selection";

const memberships = [{ project_id: "B", role: "member" }, { project_id: "A", role: "owner" }];
describe("multiple project selection", () => {
  it("uses the selected project and its role rather than the first membership", () => {
    expect(selectMembership(memberships, "A")).toEqual({ project_id: "A", role: "owner" });
    expect(selectMembership(memberships, "B")).toEqual({ project_id: "B", role: "member" });
  });
  it("falls back to the most recent available project for missing or stale selection", () => {
    expect(selectMembership(memberships, null)?.project_id).toBe("B");
    expect(selectMembership(memberships, "removed")?.project_id).toBe("B");
  });
  it("rejects unauthorized project switches", () => {
    expect(() => assertProjectSelection(memberships, "other")).toThrow("Project access denied");
    expect(assertProjectSelection(memberships, "A").role).toBe("owner");
  });
  it("denies project context to a non-member", () => {
    expect(selectMembership([], "A")).toBeNull();
    expect(() => assertProjectSelection([], "A")).toThrow();
  });
});