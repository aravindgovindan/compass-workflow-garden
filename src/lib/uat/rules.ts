import { z } from "zod";
import type { ProjectRole } from "@/lib/auth/roles";

export const UAT_ROLES = ["owner", "member", "stakeholder"] as const satisfies readonly ProjectRole[];
export const UAT_LOGIN_LIMIT = 5; // attempts per IP per minute

export type UatSettings = { enabled: boolean; expires_at: string | null; feedback_url: string | null };

/** UAT is open only when switched on and not past its expiry. */
export function isUatActive(s: UatSettings | null | undefined, now = new Date()): boolean {
  if (!s?.enabled) return false;
  return !s.expires_at || new Date(s.expires_at).getTime() > now.getTime();
}

export function canLogin(recentAttempts: number): boolean {
  return recentAttempts < UAT_LOGIN_LIMIT;
}

/** Canonical address for a shared account; restored on every login (self-healing). */
export function uatEmail(role: ProjectRole, projectId: string): string {
  return `uat-${role}+${projectId.slice(0, 8)}@example.com`;
}

export const uatRoleLabel: Record<ProjectRole, string> = {
  owner: "UAT Owner (shared)",
  member: "UAT Member (shared)",
  stakeholder: "UAT Stakeholder (shared)",
};

export const uatSettingsInput = z.object({
  enabled: z.boolean(),
  expiresAt: z.string().datetime({ offset: true }).nullable(),
  feedbackUrl: z.string().trim().url().startsWith("https://", "Use an https:// link").max(500).nullable(),
});
