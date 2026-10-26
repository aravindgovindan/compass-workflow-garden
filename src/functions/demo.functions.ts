import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { projectAccess, fail } from "@/lib/project-access.server";
import { assertDemoOwner, buildDemo, demoAction, demoCustomValues } from "@/lib/demo/data";
import { loadDefs } from "@/lib/custom-fields/defs.server";
import { toTermMap } from "@/lib/terminology/defaults";
import type { Json } from "@/integrations/supabase/types";

export const getDemoState = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { projectId, role } = await projectAccess(context.supabase, context.userId);
  assertDemoOwner(role);
  const { data, error } = await context.supabase.from("demo_batches").select("created_at").eq("project_id", projectId).maybeSingle();
  if (error) fail("load demo status", error);
  return { loaded: Boolean(data), loadedAt: data?.created_at ?? null };
});

export const loadDemo = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((i: unknown) => z.object({}).strict().parse(i)).handler(async ({ context }) => {
  const { supabase, userId } = context;
  const { projectId, role } = await projectAccess(supabase, userId);
  assertDemoOwner(role);
  const [statuses, priorities, terms, profile, taskDefs, riskDefs, issueDefs, members] = await Promise.all([
    supabase.from("workflow_statuses").select("id,category").eq("project_id", projectId).order("position"),
    supabase.from("priorities").select("id").eq("project_id", projectId).order("position"),
    supabase.from("terminology").select("key,singular,plural").eq("project_id", projectId),
    supabase.from("profiles").select("full_name").eq("id", userId).single(),
    loadDefs(supabase, projectId, "task"), loadDefs(supabase, projectId, "risk"), loadDefs(supabase, projectId, "issue"),
    supabase.from("project_members").select("user_id").eq("project_id", projectId).eq("active", true),
  ]);
  const error = statuses.error || priorities.error || terms.error || profile.error || members.error;
  if (error) fail("load demo configuration", error);
  const today = new Date().toISOString().slice(0, 10);
  // Validate configured defaults against all active members, including user-field defaults.
  const fields = {
    task: demoCustomValues(taskDefs, today, userId),
    risk: demoCustomValues(riskDefs, today, userId),
    issue: demoCustomValues(issueDefs, today, userId),
  };
  const payload = buildDemo({ statuses: statuses.data ?? [], priorities: priorities.data ?? [], terms: toTermMap(terms.data ?? []), fields, userId, name: profile.data?.full_name ?? "Project owner" });
  const result = await supabase.rpc("load_demo_data", { _project_id: projectId, _payload: JSON.parse(JSON.stringify(payload)) as Json });
  if (result.error) fail("load demo data", result.error);
  return { changed: result.data };
});

export const removeDemo = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((i: unknown) => demoAction.parse(i)).handler(async ({ context }) => {
  const { projectId, role } = await projectAccess(context.supabase, context.userId);
  assertDemoOwner(role);
  const result = await context.supabase.rpc("remove_demo_data", { _project_id: projectId });
  if (result.error?.message === "Remove your new comments on demo records before removing the demo") throw new Error(result.error.message);
  if (result.error) fail("remove demo data", result.error);
  return { changed: result.data };
});