import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";

/** Cancel old reads, hide old content, then discard all project caches before changing context. */
export function useProjectMutation<I, O>(call: (input: I) => Promise<O>, onBusy: (busy: boolean) => void, onDone?: () => void) {
  const qc = useQueryClient();
  const router = useRouter();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: call,
    onMutate: async () => { onBusy(true); await qc.cancelQueries(); },
    onSuccess: async () => {
      qc.clear();
      await router.invalidate({ sync: true });
      onBusy(false);
      onDone?.();
      await navigate({ to: "/dashboard", search: {}, replace: true });
    },
    onError: (error) => toast.error(friendlyError(error)),
    onSettled: () => onBusy(false),
  });
}