import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getProjectConfig } from "@/functions/config.functions";

/** Loaded once per session and cached; refreshed after any settings change. */
export const projectConfigQuery = queryOptions({
  queryKey: ["project-config"],
  queryFn: () => getProjectConfig(),
  staleTime: Infinity,
  gcTime: Infinity,
});

export function useProjectConfig() {
  return useQuery(projectConfigQuery);
}

/** Wraps a config server function: shows errors, refreshes the cached config on success. */
export function useConfigMutation<I>(fn: (opts: { data: I }) => Promise<unknown>, success?: string) {
  const call = useServerFn(fn as never) as unknown as (opts: { data: I }) => Promise<unknown>;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: I) => call({ data }),
    onSuccess: () => {
      if (success) toast.success(success);
      return qc.invalidateQueries({ queryKey: projectConfigQuery.queryKey });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Something went wrong"),
  });
}
