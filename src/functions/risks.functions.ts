import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";
import { byId } from "@/lib/schemas/tasks";
import { NO_OWNER, riskConvert, riskCreate, riskFilters, riskUpdate } from "@/lib/schemas/registers";
import { assertCanWriteRegister, canConvertRisk, heatmapCounts } from "@/lib/risks/score";
import { checkCustomValues } from "@/lib/custom-fields/defs.server";
import { clean, fail, projectAccess } from "@/lib/project-access.server";
import type { CustomValues } from "@/lib/custom-fields/types";

// Every create/update/delete is written to activity_log (old and new values) by the log_activity() trigger.
export type RiskRow = Database["public"]["Tables"]["risks"]["Row"];
export type RiskList = { rows: RiskRow[]; categories: string[]; heat: number[][] };
export type RiskDetail = RiskRow & { issues: { id: string; title: string; status: string }[] };

/** Owner filter as a PostgREST expression; ids are validated UUIDs. */
export function ownerOr(owner: string[]): string {
  const ids = owner.filter((o) => o !== NO_OWNER);
  return [ids.length ? `owner_id.in.(${ids.join(",")})` : null, owner.includes(NO_OWNER) ? "owner_id.is.null" : null].filter(Boolean).join(",");
}

/** All project members, including stakeholders, may read risks. */
export const listRisks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => riskFilters.parse(i ?? {}))
  .handler(async ({ data: f, context }): Promise<RiskList> => {
    const { supabase, userId } = context;
    const { projectId } = await projectAccess(supabase, userId);
    let q = supabase.from("risks").select("*").eq("project_id", projectId);
    if (f.status.length) q = q.in("status", f.status);
    if (f.rating.length) q = q.in("rating", f.rating);
    if (f.category.length) q = q.in("category", f.category);
    if (f.owner.length) q = q.or(ownerOr(f.owner));
    if (f.p) q = q.eq("probability", f.p);
    if (f.i) q = q.eq("impact", f.i);
    q = q.order(f.sort, { ascending: f.dir === "asc", nullsFirst: false }).order("created_at").limit(1000);
    const [rows, all] = await Promise.all([q, supabase.from("risks").select("probability, impact, status, category").eq("project_id", projectId).limit(5000)]);
    if (rows.error) fail("load the risks", rows.error);
    const everything = all.data ?? [];
    return {
      rows: rows.data ?? [],
      categories: [...new Set(everything.map((r) => r.category).filter((c): c is string => !!c))].sort(),
      heat: heatmapCounts(everything),
    };
  });

export const getRisk = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => byId.parse(i))
  .handler(async ({ data, context }): Promise<RiskDetail> => {
    const { supabase, userId } = context;
    const { projectId } = await projectAccess(supabase, userId);
    const [r, iss] = await Promise.all([
      supabase.from("risks").select("*").eq("id", data.id).eq("project_id", projectId).maybeSingle(),
      supabase.from("issues").select("id, title, status").eq("project_id", projectId).eq("source_risk_id", data.id),
    ]);
    if (r.error) fail("load the risk", r.error);
    if (!r.data) throw new Error("That item no longer exists.");
    return { ...r.data, issues: iss.data ?? [] };
  });

export const createRisk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => riskCreate.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { projectId, role } = await projectAccess(supabase, userId);
    assertCanWriteRegister(role);
    const { custom_fields, ...rest } = data;
    const cf = await checkCustomValues(supabase, projectId, "risk", {}, custom_fields ?? {}, "create");
    const { data: row, error } = await supabase.from("risks")
      .insert({ ...clean(rest), title: data.title, project_id: projectId, custom_fields: cf as Json }).select("id").single();
    if (error || !row) fail("add the risk", error);
    return row;
  });

export const updateRisk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => riskUpdate.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { projectId, role } = await projectAccess(supabase, userId);
    assertCanWriteRegister(role);
    const { id, custom_fields, ...rest } = data;
    const patch: Database["public"]["Tables"]["risks"]["Update"] = clean(rest);
    if (custom_fields) {
      const { data: cur } = await supabase.from("risks").select("custom_fields").eq("id", id).eq("project_id", projectId).maybeSingle();
      if (!cur) throw new Error("That item no longer exists.");
      patch.custom_fields = (await checkCustomValues(supabase, projectId, "risk", (cur.custom_fields ?? {}) as CustomValues, custom_fields, "update")) as Json;
    }
    const { error } = await supabase.from("risks").update(patch).eq("id", id).eq("project_id", projectId);
    if (error) fail("save the risk", error);
    return { ok: true };
  });

export const deleteRisk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => byId.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { projectId, role } = await projectAccess(supabase, userId);
    assertCanWriteRegister(role);
    const { error } = await supabase.from("risks").delete().eq("id", data.id).eq("project_id", projectId);
    if (error) fail("delete the risk", error);
    return { ok: true };
  });

/** Creates the issue and marks the risk occurred in one DB transaction; both changes are logged by triggers. */
export const convertRiskToIssue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => riskConvert.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { projectId, role } = await projectAccess(supabase, userId);
    assertCanWriteRegister(role);
    const [r, iss] = await Promise.all([
      supabase.from("risks").select("status").eq("id", data.id).eq("project_id", projectId).maybeSingle(),
      supabase.from("issues").select("id", { count: "exact", head: true }).eq("source_risk_id", data.id),
    ]);
    if (!r.data) throw new Error("That item no longer exists.");
    if (!canConvertRisk(r.data, iss.count ?? 0)) throw new Error("This risk has already been converted.");
    const { data: issueId, error } = await supabase.rpc("convert_risk_to_issue", { _risk_id: data.id, _severity: data.severity });
    if (error || !issueId) fail("convert the risk", error);
    return { issueId };
  });
