import { describe, expect, it } from "vitest";
import { assertCanWriteRegister, canConvertRisk, heatmapCounts, issueFromRisk, ratingFor, riskScore } from "./score";
import { canAccessSection, canWrite } from "@/lib/auth/roles";
import { riskFilters } from "@/lib/schemas/registers";

describe("risk score and rating", () => {
  it("score is probability × impact", () => {
    expect(riskScore(3, 4)).toEqual({ score: 12, rating: "high" });
    expect(riskScore(1, 1)).toEqual({ score: 1, rating: "low" });
    expect(riskScore(5, 5)).toEqual({ score: 25, rating: "critical" });
  });
  it("band boundaries 4/5, 9/10, 14/15", () => {
    expect(ratingFor(4)).toBe("low");
    expect(ratingFor(5)).toBe("medium");
    expect(ratingFor(9)).toBe("medium");
    expect(ratingFor(10)).toBe("high");
    expect(ratingFor(14)).toBe("high");
    expect(ratingFor(15)).toBe("critical");
  });
  it("rejects values outside 1–5", () => {
    expect(() => riskScore(0, 3)).toThrow();
    expect(() => riskScore(3, 6)).toThrow();
    expect(() => riskScore(2.5, 3)).toThrow();
  });
  it("heatmap counts only open and mitigating risks", () => {
    const heat = heatmapCounts([
      { probability: 5, impact: 4, status: "open" },
      { probability: 5, impact: 4, status: "mitigating" },
      { probability: 5, impact: 4, status: "closed" },
      { probability: 1, impact: 1, status: "occurred" },
    ]);
    expect(heat[4]?.[3]).toBe(2);
    expect(heat[0]?.[0]).toBe(0);
  });
});

describe("convert risk to issue", () => {
  const risk = { id: "r1", title: "Vendor late", description: "d", category: "Supply", owner_id: "u1", status: "open" };
  it("copies title, description and owner and links the source risk", () => {
    expect(issueFromRisk(risk, "high")).toMatchObject({
      title: "Vendor late", description: "d", owner_id: "u1", source_risk_id: "r1", severity: "high", status: "open",
    });
  });
  it("cannot convert the same risk twice", () => {
    expect(canConvertRisk({ status: "open" }, 0)).toBe(true);
    expect(canConvertRisk({ status: "occurred" }, 1)).toBe(false);
  });
});

describe("register access", () => {
  it("stakeholders can open risks and issues but not write", () => {
    expect(canAccessSection("stakeholder", "risks")).toBe(true);
    expect(canAccessSection("stakeholder", "issues")).toBe(true);
    expect(canWrite("stakeholder")).toBe(false);
    expect(() => assertCanWriteRegister("stakeholder")).toThrow(/read-only/);
  });
  it("owners and members can write", () => {
    expect(() => assertCanWriteRegister("owner")).not.toThrow();
    expect(() => assertCanWriteRegister("member")).not.toThrow();
  });
});

describe("register filters from the URL", () => {
  it("parses arrays and drops bad values", () => {
    const f = riskFilters.parse({ status: "open", rating: ["high", "bogus"], p: "3", i: "9", sort: "nope" });
    expect(f.status).toEqual(["open"]);
    expect(f.rating).toEqual([]);
    expect(f.p).toBe(3);
    expect(f.i).toBeUndefined();
    expect(f.sort).toBe("score");
  });
});
