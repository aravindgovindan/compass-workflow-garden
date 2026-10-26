import { queryOptions } from "@tanstack/react-query";
import { getDashboard } from "@/functions/dashboard.functions";
export const dashboardQuery = (userId: string, projectId: string, role: string) =>
  queryOptions({
    queryKey: ["dashboard", userId, projectId, role],
    queryFn: () => getDashboard(),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });
