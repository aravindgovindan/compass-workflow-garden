import { describe, expect, it } from "vitest";
import { friendlyError } from "./errors";

describe("recoverable failures", () => {
  it("translates failed requests into a readable connection error", () => {
    expect(friendlyError(new TypeError("Failed to fetch"))).toBe("Connection interrupted. Check your connection and try again.");
  });
  it("hides database details", () => {
    expect(friendlyError(new Error("permission denied for table tasks"))).toBe("Could not complete that action. Please try again.");
  });
  it("preserves safe actionable validation failures", () => {
    expect(friendlyError(new Error("Only the project owner can manage demo data."))).toBe("Only the project owner can manage demo data.");
  });
});