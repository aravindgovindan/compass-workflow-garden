import { describe, expect, it } from "vitest";
import { projectProfileSchema } from "./project";

const base = { name: "Apollo", code: "apollo", status: "active", health: "green" } as const;

describe("project profile rules", () => {
  it("uppercases the project code", () => {
    expect(projectProfileSchema.parse(base).code).toBe("APOLLO");
  });

  it("rejects codes shorter than 2 or longer than 10 characters", () => {
    expect(projectProfileSchema.safeParse({ ...base, code: "A" }).success).toBe(false);
    expect(projectProfileSchema.safeParse({ ...base, code: "ABCDEFGHIJK" }).success).toBe(false);
  });

  it("rejects codes that start with a number or contain symbols", () => {
    expect(projectProfileSchema.safeParse({ ...base, code: "1APO" }).success).toBe(false);
    expect(projectProfileSchema.safeParse({ ...base, code: "AP-1" }).success).toBe(false);
  });

  it("rejects a target end date before the start date", () => {
    const r = projectProfileSchema.safeParse({ ...base, start_date: "2026-05-10", target_end_date: "2026-05-01" });
    expect(r.success).toBe(false);
  });

  it("accepts an end date equal to the start date", () => {
    const r = projectProfileSchema.safeParse({ ...base, start_date: "2026-05-10", target_end_date: "2026-05-10" });
    expect(r.success).toBe(true);
  });

  it("only allows Green, Amber or Red health", () => {
    expect(projectProfileSchema.safeParse({ ...base, health: "blue" }).success).toBe(false);
  });
});
