import { describe, expect, it } from "vitest";
import { canLogin, isUatActive, uatEmail, uatSettingsInput } from "./rules";

const now = new Date("2026-10-27T06:00:00Z");
describe("UAT access rules", () => {
  it("is off by default and when disabled", () => {
    expect(isUatActive(null, now)).toBe(false);
    expect(isUatActive({ enabled: false, expires_at: null, feedback_url: null }, now)).toBe(false);
  });
  it("is open when enabled without expiry", () => {
    expect(isUatActive({ enabled: true, expires_at: null, feedback_url: null }, now)).toBe(true);
  });
  it("closes at expiry", () => {
    expect(isUatActive({ enabled: true, expires_at: "2026-10-27T06:00:00Z", feedback_url: null }, now)).toBe(false);
    expect(isUatActive({ enabled: true, expires_at: "2026-10-27T06:01:00Z", feedback_url: null }, now)).toBe(true);
  });
  it("allows five login attempts per minute", () => {
    expect(canLogin(4)).toBe(true);
    expect(canLogin(5)).toBe(false);
  });
  it("restores a fixed address per role and project", () => {
    expect(uatEmail("member", "abcdef12-0000")).toBe("uat-member+abcdef12@example.com");
  });
  it("rejects non-https feedback links", () => {
    expect(uatSettingsInput.safeParse({ enabled: true, expiresAt: null, feedbackUrl: "http://x.com" }).success).toBe(false);
  });
});
