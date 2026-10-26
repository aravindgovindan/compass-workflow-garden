import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { projectProfileSchema } from "@/lib/schemas/project";

/** First-run: create the project. The creator becomes its Owner (DB trigger). */
export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => projectProfileSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Phase 1 runs one project per user: block a second one.
    const { count, error: countError } = await supabase
      .from("project_members")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if (countError) throw new Error("Could not check your existing projects. Please try again.");
    if ((count ?? 0) > 0) throw new Error("You already belong to a project.");

    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        name: data.name,
        code: data.code,
        description: data.description ?? null,
        objectives: data.objectives ?? null,
        sponsor: data.sponsor ?? null,
        start_date: data.start_date ?? null,
        target_end_date: data.target_end_date ?? null,
        status: data.status,
        health: data.health,
        created_by: userId,
      })
      .select("id, name, code")
      .single();
    if (error || !project) {
      console.error("createProject failed", error);
      throw new Error("Could not create the project. Please try again.");
    }
    return project;
  });
