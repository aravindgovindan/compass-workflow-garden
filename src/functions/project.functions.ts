import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { projectProfileSchema } from "@/lib/schemas/project";
import { z } from "zod";
import { assertProjectSelection } from "@/lib/projects/selection";

/** Create a project; the DB trigger assigns ownership, seeds config and selects it. */
export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => projectProfileSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile, error: profileError } = await supabase.from("profiles").select("is_demo").eq("id", userId).maybeSingle();
    if (profileError || !profile) throw new Error("Could not check your account. Please try again.");
    if (profile.is_demo) throw new Error("Shared test accounts cannot create projects.");

    const { data: project, error } = await supabase.rpc("create_owned_project", { _input: data });
    if (error || !project) {
      console.error("createProject failed", error);
      throw new Error("Could not create the project. Please try again.");
    }
    return z.object({ id: z.string().uuid(), name: z.string(), code: z.string() }).parse(project);
  });

export const switchActiveProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile, error: profileError } = await supabase.from("profiles").select("is_demo").eq("id", userId).maybeSingle();
    if (profileError || !profile) throw new Error("Could not check your account. Please try again.");
    if (profile.is_demo) throw new Error("Shared test accounts cannot switch projects.");
    const { data: memberships, error } = await supabase.from("project_members").select("project_id").eq("user_id", userId).eq("project_id", data.projectId).eq("active", true);
    if (error) throw new Error("Could not switch projects. Please try again.");
    assertProjectSelection(memberships ?? [], data.projectId);
    const update = await supabase.from("profiles").update({ active_project_id: data.projectId }).eq("id", userId).select("id").single();
    if (update.error) throw new Error("Could not switch projects. Please try again.");
    return { projectId: data.projectId };
  });
