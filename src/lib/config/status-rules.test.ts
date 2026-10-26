import { describe, expect, it } from "vitest";
import { checkStatusDeletion, nextDefaultStatus } from "./status-rules";

const s: { id: string; is_default: boolean }[] = [
  { id: "a", is_default: true },
  { id: "b", is_default: false },
];

describe("status deletion rules", () => {
  it("allows deleting an unused status", () => {
    expect(checkStatusDeletion(s, "b", 0)).toBeNull();
  });
  it("blocks deleting a status in use without a replacement", () => {
    expect(checkStatusDeletion(s, "b", 3)).toMatch(/replacement/);
  });
  it("allows deleting a status in use with a valid replacement", () => {
    expect(checkStatusDeletion(s, "b", 3, "a")).toBeNull();
  });
  it("rejects replacing a status with itself or a missing one", () => {
    expect(checkStatusDeletion(s, "b", 3, "b")).not.toBeNull();
    expect(checkStatusDeletion(s, "b", 3, "zzz")).not.toBeNull();
  });
  it("blocks deleting the last status", () => {
    expect(checkStatusDeletion([{ id: "a", is_default: true }], "a", 0)).toMatch(/at least one/);
  });
  it("hands the default to another status when the default is deleted", () => {
    expect(nextDefaultStatus(s, "a")).toBe("b");
    expect(nextDefaultStatus(s, "b")).toBeNull();
  });
});
