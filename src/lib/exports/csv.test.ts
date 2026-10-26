import { describe, it, expect } from "vitest";
import { csvCell, csvFile, canExport, assertCanExport } from "./csv";
describe("CSV exports", () => {
  it("escapes commas", () => expect(csvCell("a,b")).toBe('"a,b"'));
  it("escapes quotes", () => expect(csvCell('a"b')).toBe('"a""b"'));
  it("escapes line breaks", () => expect(csvCell("a\nb")).toBe('"a\nb"'));
  it.each(["=", "+", "-", "@"])("neutralizes formulas starting with %s", (prefix) =>
    expect(csvCell(`${prefix}SUM(1)`)).toBe(`'${prefix}SUM(1)`),
  );
  it("blocks formulas after whitespace", () => expect(csvCell(" \t=1+1")).toBe("' \t=1+1"));
  it("escapes headers too", () => expect(csvFile(["=formula"], [])).toBe("\uFEFF'=formula\r\n"));
  it("uses CRLF and handles empty values", () =>
    expect(csvFile(["A", "B"], [[null, "x"]])).toBe("\uFEFFA,B\r\n,x\r\n"));
  it("owners export every type", () => {
    for (const kind of ["task", "milestone", "risk", "issue"] as const)
      expect(canExport("owner", kind)).toBe(true);
  });
  it("members export every type", () => {
    for (const kind of ["task", "milestone", "risk", "issue"] as const)
      expect(canExport("member", kind)).toBe(true);
  });
  it("stakeholders cannot export tasks", () => {
    expect(canExport("stakeholder", "task")).toBe(false);
    expect(() => assertCanExport("stakeholder", "task")).toThrow();
  });
  it("stakeholders export milestones risks issues", () => {
    for (const kind of ["milestone", "risk", "issue"] as const)
      expect(canExport("stakeholder", kind)).toBe(true);
  });
  it("no membership grants no exports", () => {
    for (const kind of ["task", "milestone", "risk", "issue"] as const)
      expect(canExport(null, kind)).toBe(false);
  });
});
