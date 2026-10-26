import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { deleteView, getViewPrefs, listSavedViews, renameView, saveView, setViewPrefs, type ViewPrefs } from "@/functions/views.functions";

export const savedViewsQuery = queryOptions({ queryKey: ["saved-views"], queryFn: () => listSavedViews() });
export const viewPrefsQuery = queryOptions({ queryKey: ["view-prefs"], queryFn: () => getViewPrefs(), staleTime: Infinity });

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

export function useSetViewPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: Partial<ViewPrefs>) => setViewPrefs({ data: p }),
    onMutate: (p) => {
      const prev = qc.getQueryData<ViewPrefs>(viewPrefsQuery.queryKey);
      if (prev) qc.setQueryData<ViewPrefs>(viewPrefsQuery.queryKey, { ...prev, ...p });
      return { prev };
    },
    onError: (e, _p, ctx) => {
      if (ctx?.prev) qc.setQueryData(viewPrefsQuery.queryKey, ctx.prev);
      toast.error(errMsg(e));
    },
  });
}

export function useSavedViewActions() {
  const qc = useQueryClient();
  const opts = {
    onError: (e: unknown) => toast.error(errMsg(e)),
    onSettled: () => qc.invalidateQueries({ queryKey: savedViewsQuery.queryKey }),
  };
  return {
    save: useMutation({ mutationFn: (i: { name: string; view_type: "list" | "board"; filters: Record<string, unknown> }) => saveView({ data: i }), ...opts }),
    rename: useMutation({ mutationFn: (i: { id: string; name: string }) => renameView({ data: i }), ...opts }),
    remove: useMutation({ mutationFn: (id: string) => deleteView({ data: { id } }), ...opts }),
  };
}
