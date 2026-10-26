import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { projectAccess, type Db } from "@/lib/project-access.server";
import {
  canReadComments,
  canCreateComment,
  canEditComment,
  canDeleteComment,
  mentionIds,
  type DiscussionEntity,
} from "@/lib/collaboration/rules";
import { recordInput, commentCreate, commentUpdate, idInput } from "@/lib/collaboration/schemas";
async function recordAccess(supabase: Db, userId: string, type: DiscussionEntity, id: string) {
  const access = await projectAccess(supabase, userId);
  if (!canReadComments(access.role, type)) throw new Error("You cannot access these comments.");
  const r = await supabase.rpc("can_read_discussion", {
    _pid: access.projectId,
    _type: type,
    _eid: id,
  });
  if (r.error || !r.data) throw new Error("Record not found or not accessible.");
  return access;
}
async function validateMentions(supabase: Db, projectId: string, body: string) {
  const ids = mentionIds(body);
  if (!ids.length) return;
  const m = await supabase
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId)
    .eq("active", true)
    .in("user_id", ids);
  if (m.error || ids.some((id) => !m.data?.some((x) => x.user_id === id)))
    throw new Error("Mentioned person must be active on the project.");
}
function commentError(error: unknown): never {
  console.error("Comment operation failed", error);
  throw new Error("Could not save the comment. Please try again.");
}
export const listComments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => recordInput.parse(i))
  .handler(async ({ data, context }) => {
    const access = await recordAccess(
      context.supabase,
      context.userId,
      data.entityType,
      data.entityId,
    );
    const r = await context.supabase
      .from("comments")
      .select("*", { count: "exact" })
      .eq("project_id", access.projectId)
      .eq("entity_type", data.entityType)
      .eq("entity_id", data.entityId)
      .order("created_at")
      .order("id")
      .range(data.page * 30, data.page * 30 + 29);
    if (r.error) commentError(r.error);
    const ids = [...new Set((r.data ?? []).map((x) => x.author_id))];
    const p = ids.length
      ? await context.supabase.from("profiles").select("id,full_name").in("id", ids)
      : { data: [] };
    return {
      items: (r.data ?? []).map((x) => ({
        ...x,
        author_name: p.data?.find((y) => y.id === x.author_id)?.full_name ?? "Former member",
      })),
      total: r.count ?? 0,
    };
  });
export const createComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => commentCreate.parse(i))
  .handler(async ({ data, context }) => {
    const access = await recordAccess(
      context.supabase,
      context.userId,
      data.entityType,
      data.entityId,
    );
    if (!canCreateComment(access.role)) throw new Error("Comments are read-only.");
    await validateMentions(context.supabase, access.projectId, data.body);
    const r = await context.supabase
      .from("comments")
      .insert({
        project_id: access.projectId,
        entity_type: data.entityType,
        entity_id: data.entityId,
        author_id: context.userId,
        body: data.body,
      })
      .select("id")
      .single();
    if (r.error) commentError(r.error);
    return r.data;
  });
export const updateComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => commentUpdate.parse(i))
  .handler(async ({ data, context }) => {
    const c = await context.supabase.from("comments").select("*").eq("id", data.id).maybeSingle();
    if (!c.data) throw new Error("Comment not found.");
    const access = await recordAccess(
      context.supabase,
      context.userId,
      c.data.entity_type as DiscussionEntity,
      c.data.entity_id,
    );
    if (!canEditComment(access.role, context.userId, c.data.author_id))
      throw new Error("Only the author can edit this comment.");
    await validateMentions(context.supabase, access.projectId, data.body);
    const r = await context.supabase
      .from("comments")
      .update({ body: data.body })
      .eq("id", data.id)
      .eq("project_id", access.projectId)
      .select("id")
      .single();
    if (r.error) commentError(r.error);
    return r.data;
  });
export const deleteComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => idInput.parse(i))
  .handler(async ({ data, context }) => {
    const c = await context.supabase.from("comments").select("*").eq("id", data.id).maybeSingle();
    if (!c.data) throw new Error("Comment not found.");
    const access = await recordAccess(
      context.supabase,
      context.userId,
      c.data.entity_type as DiscussionEntity,
      c.data.entity_id,
    );
    if (!canDeleteComment(access.role, context.userId, c.data.author_id))
      throw new Error("You cannot delete this comment.");
    const r = await context.supabase
      .from("comments")
      .delete()
      .eq("id", data.id)
      .eq("project_id", access.projectId)
      .select("id")
      .single();
    if (r.error) commentError(r.error);
    return { ok: true };
  });
