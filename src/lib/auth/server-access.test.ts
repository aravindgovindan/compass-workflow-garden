import { describe, expect, it } from "vitest";
import { projectAccess, requireTaskReader, requireWriter, type Db } from "@/lib/project-access.server";
import { assertDemoOwner } from "@/lib/demo/data";
import { canConfigure } from "./roles";

function client(role: "owner" | "member" | "stakeholder" | null): Db {
  const query = { select: () => query, eq: () => query, order: () => query, limit: () => query, maybeSingle: async () => ({ data: role ? { project_id: "project", role } : null }) };
  return { from: () => query } as unknown as Db;
}

describe("server access boundaries", () => {
  it("rejects stakeholder project writes", async () => {
    await expect(requireWriter(client("stakeholder"), "user")).rejects.toThrow("read-only");
    expect(() => assertDemoOwner("stakeholder")).toThrow();
  });
  it("rejects member settings and demo changes", () => {
    expect(canConfigure("member")).toBe(false);
    expect(() => assertDemoOwner("member")).toThrow();
  });
  it("rejects non-member project reads before a data query", async () => {
    await expect(projectAccess(client(null), "user")).rejects.toThrow("not on a project");
    await expect(requireTaskReader(client(null), "user")).rejects.toThrow();
  });
  it("permits member work and owner configuration", async () => {
    await expect(requireWriter(client("member"), "user")).resolves.toBe("project");
    expect(() => assertDemoOwner("owner")).not.toThrow();
  });
});