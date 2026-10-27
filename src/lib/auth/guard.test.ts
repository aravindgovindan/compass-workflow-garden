import { describe, expect, it } from "vitest";
import { isRedirect } from "@tanstack/react-router";
import { guardSection } from "./guard";
import type { CurrentUser } from "@/functions/session.functions";
import type { ProjectRole } from "./roles";

const me = (role: ProjectRole): CurrentUser => ({
  userId: "u",
  profile: null,
  projects: [],
  uat: null, membership: { role, project: { id: "p", name: "P", code: "PP", health: "green" } },
});

function run(role: ProjectRole) {
  try { guardSection("settings")({ context: { me: me(role) } }); return null; } catch (e) { return e; }
}

describe("/settings guard", () => {
  it("lets the owner in", () => {
    expect(run("owner")).toBeNull();
  });
  it("sends members and stakeholders back to the dashboard", () => {
    for (const role of ["member", "stakeholder"] as const) {
      const e = run(role);
      expect(isRedirect(e)).toBe(true);
      expect((e as { options: { to: string } }).options.to).toBe("/dashboard");
    }
  });
});
