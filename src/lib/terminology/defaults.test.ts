import { describe, expect, it } from "vitest";
import { resolveTerm, toTermMap } from "./defaults";

describe("terminology fallback", () => {
  it("uses the project's renamed term", () => {
    const map = toTermMap([{ key: "task", singular: "Story", plural: "Stories" }]);
    expect(resolveTerm(map, "task", "singular")).toBe("Story");
    expect(resolveTerm(map, "task")).toBe("Stories");
  });
  it("falls back to the default when a term is missing", () => {
    expect(resolveTerm({}, "milestone", "singular")).toBe("Milestone");
    expect(resolveTerm(null, "risk")).toBe("Risks");
  });
  it("falls back when a term is blank", () => {
    expect(resolveTerm({ issue: { singular: "  ", plural: "" } }, "issue")).toBe("Issues");
  });
});
