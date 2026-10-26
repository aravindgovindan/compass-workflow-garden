import { MutationCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { PageError, PageNotFound, PagePending } from "@/components/common/route-states";
import { friendlyError } from "@/lib/errors";
import { toast } from "sonner";

export const getRouter = () => {
  const queryClient = new QueryClient({
    mutationCache: new MutationCache({ onError: (error, _variables, _context, mutation) => {
      if (!mutation.options.onError) toast.error(friendlyError(error));
    } }),
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: PageError,
    defaultNotFoundComponent: PageNotFound,
    defaultPendingComponent: PagePending,
  });

  return router;
};
