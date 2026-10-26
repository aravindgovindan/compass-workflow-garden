import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";
import { byId } from "@/lib/schemas/tasks";
import { issueCreate, issueFilters, issueUpdate } from "@/lib/schemas/registers";
import { assertCanWriteRegister } from "@/lib/risks/score";
import { checkCustomValues } from "@/lib/custom-fields/defs.server";
import { clean, fail, projectAccess } from "@/lib/project-access.server";
import type { CustomValues } from "@/lib/custom-fields/types";
import { ownerOr } from "./risks.functions";

// Every create/update/delete is written to activity_log (old and new values) by the log_activity() trigger.
export type IssueRow = Database["public"]["Tables"]["issues"]["Row"];
export type IssueList = { rows: IssueRow[]; categories: string[] };
export type IssueDetail = IssueRow & { source_risk: { id: string; title: string } | null };

/** All project members, including stakeholders, may read issues. */
export const listIssues = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => issueFilters.parse(i ?? {}))
  .handler(async ({ data: f, context }): Promise<IssueList> => {
    const { supabase, userId } = context;
    const { projectId } = await projectAccess(supabase, userId);
    let q = supabase.from("issues").select("*").eq("project_id", projectId);
    if (f.status.length) q = q.in("status", f.status);
    if (f.severity.length) q = q.in("severity", f.severity);
    if (f.category.length) q = q.in("category", f.category);
    if (f.owner.length) q = q.or(ownerOr(f.owner));
    q = q.order(f.sort, { ascending: f.dir === "asc", nullsFirst: false }).order("created_at").limit(1000);
    const [rows, cats] = await Promise.all([q, supabase.from("issues").select("category").eq("project_id", projectId).not("category", "is", null).limit(5000)]);
    if (rows.error) fail("load the issues", rows.error);
    return { rows: rows.data ?? [], categories: [...new Set((cats.data ?? []).map((r) => r.category!))].sort() };
  });

export const getIssue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => byId.parse(i))
  .handler(async ({ data, context }): Promise<IssueDetail> => {
    const { supabase, userId } = context;
    const { projectId } = await projectAccess(supabase, userId);
    const { data: row, error } = await supabase.from("issues").select("*").eq("id", data.id).eq("project_id", projectId).maybeSingle();
    if (error) fail("load the issue", error);
    if (!row) throw new Error("That item no longer exists.");
    let source_risk: IssueDetail["source_risk"] = null;
    if (row.source_risk_id) {
      const { data: r } = await supabase.from("risks").select("id, title").eq("id", row.source_risk_id).maybeSingle();
      source_risk = r ?? null;
    }
    return { ...row, source_risk };
  });

export const createIssue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => issueCreate.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { projectId, role } = await projectAccess(supabase, userId);
    assertCanWriteRegister(role);
    const { custom_fields, ...rest } = data;
    const cf = await checkCustomValues(supabase, projectId, "issue", {}, custom_fields ?? {}, "create");
    const { data: row, error } = await supabase.from("issues")
      .insert({ raised_by: userId, ...clean(rest), title: data.title, project_id: projectId, custom_fields: cf as Json }).select("id").single();
    if (error || !row) fail("add the issue", error);
    return row;
  });

export const updateIssue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => issueUpdate.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { projectId, role } = await projectAccess(supabase, userId);
    assertCanWriteRegister(role);
    const { id, custom_fields, ...rest } = data;
    const patch: Database["public"]["Tables"]["issues"]["Update"] = clean(rest);
    if (custom_fields) {
      const { data: cur } = await supabase.from("issues").select("custom_fields").eq("id", id).eq("project_id", projectId).maybeSingle();
      if (!cur) throw new Error("That item no longer exists.");
      patch.custom_fields = (await checkCustomValues(supabase, projectId, "issue", (cur.custom_fields ?? {}) as CustomValues, custom_fields, "update")) as Json;
    }
    const { error } = await supabase.from("issues").update(patch).eq("id", id).eq("project_id", projectId);
    if (error) fail("save the issue", error);
    return { ok: true };
  });

export const deleteIssue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => byId.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { projectId, role } = await projectAccess(supabase, userId);
    assertCanWriteRegister(role);
    const { error } = await supabase.from("issues").delete().eq("id", data.id).eq("project_id", projectId);
    if (error) fail("delete the issue", error);
    return { ok: true };
  });
