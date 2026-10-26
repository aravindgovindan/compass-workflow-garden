import { describe, expect, it } from "vitest";
import { canAccessSection, canConfigure, canWrite } from "./roles";

describe("role access", () => {
  it("stakeholders can open only dashboard, milestones, risks and issues", () => {
    expect(canAccessSection("stakeholder", "dashboard")).toBe(true);
    expect(canAccessSection("stakeholder", "milestones")).toBe(true);
    expect(canAccessSection("stakeholder", "risks")).toBe(true);
    expect(canAccessSection("stakeholder", "issues")).toBe(true);
    expect(canAccessSection("stakeholder", "tasks")).toBe(false);
    expect(canAccessSection("stakeholder", "team")).toBe(false);
    expect(canAccessSection("stakeholder", "activity")).toBe(false);
    expect(canAccessSection("stakeholder", "settings")).toBe(false);
  });

  it("only the owner can open settings", () => {
    expect(canAccessSection("owner", "settings")).toBe(true);
    expect(canAccessSection("member", "settings")).toBe(false);
  });

  it("owners and members can write; stakeholders cannot", () => {
    expect(canWrite("owner")).toBe(true);
    expect(canWrite("member")).toBe(true);
    expect(canWrite("stakeholder")).toBe(false);
  });

  it("only the owner can configure", () => {
    expect(canConfigure("owner")).toBe(true);
    expect(canConfigure("member")).toBe(false);
    expect(canConfigure("stakeholder")).toBe(false);
  });
});
