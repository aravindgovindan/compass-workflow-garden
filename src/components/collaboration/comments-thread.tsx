import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Trash2, Send, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/common/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { createComment, updateComment, deleteComment } from "@/functions/comments.functions";
import {
  commentsQuery,
  currentPersonQuery,
  useCollaborationMutation,
} from "@/lib/collaboration/queries";
import {
  canCreateComment,
  canEditComment,
  canDeleteComment,
  parseMentions,
  type DiscussionEntity,
} from "@/lib/collaboration/rules";
import { useProjectConfig } from "@/lib/config/use-config";
import { MentionEditor } from "./mention-editor";
export function CommentsThread({
  entityType,
  entityId,
}: {
  entityType: DiscussionEntity;
  entityId: string;
}) {
  const [page, setPage] = useState(0);
  const [body, setBody] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const q = useQuery(commentsQuery(entityType, entityId, page));
  const me = useQuery(currentPersonQuery);
  const config = useProjectConfig();
  const add = useCollaborationMutation(createComment);
  const update = useCollaborationMutation(updateComment);
  const del = useCollaborationMutation(deleteComment);
  const role = me.data?.membership?.role;
  const userId = me.data?.userId ?? "";
  const members = config.data?.members ?? [];
  if (q.isPending) return <Skeleton className="h-28 w-full" />;
  if (q.error) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  return (
    <section className="space-y-4" aria-label="Comments">
      {!q.data?.items.length && <p className="text-sm text-muted-foreground">No comments yet.</p>}
      <ol className="divide-y">
        {q.data?.items.map((c) => (
          <li key={c.id} className="space-y-2 py-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{c.author_name}</p>
                <time dateTime={c.created_at} className="text-xs text-muted-foreground">
                  {new Date(c.created_at).toLocaleString()}
                  {c.edited_at ? " · edited" : ""}
                </time>
              </div>
              {role && (
                <div className="flex">
                  {canEditComment(role, userId, c.author_id) && (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Edit comment"
                      title="Edit comment"
                      onClick={() => {
                        setEditing(c.id);
                        setDraft(c.body);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  )}
                  {canDeleteComment(role, userId, c.author_id) && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      aria-label="Delete comment"
                      title="Delete comment"
                      disabled={del.isPending}
                      onClick={() => {
                        if (window.confirm("Delete this comment?")) del.mutate({ id: c.id });
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>
            {editing === c.id ? (
              <div className="space-y-2">
                <MentionEditor
                  id={`edit-${c.id}`}
                  value={draft}
                  onChange={setDraft}
                  members={members}
                  disabled={update.isPending}
                />
                <div className="flex gap-2">
                  <Button
                    disabled={!draft.trim() || update.isPending}
                    onClick={() =>
                      update.mutate(
                        { id: c.id, body: draft },
                        { onSuccess: () => setEditing(null) },
                      )
                    }
                  >
                    Save
                  </Button>
                  <Button variant="ghost" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="whitespace-pre-wrap break-words text-sm">
                {parseMentions(c.body).map((p, i) =>
                  p.userId ? (
                    <span key={i} className="rounded bg-primary/15 px-1 font-medium text-primary">
                      @{members.find((m) => m.user_id === p.userId)?.full_name ?? p.text}
                    </span>
                  ) : (
                    <span key={i}>{p.text}</span>
                  ),
                )}
              </p>
            )}
          </li>
        ))}
      </ol>
      {(q.data?.total ?? 0) > 30 && (
        <div className="flex items-center justify-between">
          <Button
            size="icon"
            variant="outline"
            aria-label="Previous comments"
            disabled={!page}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-xs text-muted-foreground">Page {page + 1}</span>
          <Button
            size="icon"
            variant="outline"
            aria-label="Next comments"
            disabled={(page + 1) * 30 >= (q.data?.total ?? 0)}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
      {role && canCreateComment(role) && (
        <form
          className="space-y-2 border-t pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate(
              { entityType, entityId, body },
              {
                onSuccess: () => {
                  setBody("");
                  setPage(Math.floor((q.data?.total ?? 0) / 30));
                },
              },
            );
          }}
        >
          <MentionEditor
            id={`comment-${entityId}`}
            value={body}
            onChange={setBody}
            members={members}
            disabled={add.isPending}
          />
          <Button type="submit" disabled={!body.trim() || add.isPending}>
            <Send className="size-4" />
            {add.isPending ? "Posting…" : "Post comment"}
          </Button>
        </form>
      )}
    </section>
  );
}
