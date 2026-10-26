import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { dashboardQuery } from "@/lib/dashboard/queries";
import { projectConfigQuery } from "@/lib/config/use-config";
import { guardSection } from "@/lib/auth/guard";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/empty-state";

export const Route = createFileRoute("/_authenticated/_app/dashboard")({
  beforeLoad: guardSection('dashboard'),
  loader: async({context})=>{const m=context.me.membership;if(!m)return;await Promise.all([context.queryClient.fetchQuery(dashboardQuery(context.me.userId,m.project.id,m.role)),context.queryClient.ensureQueryData(projectConfigQuery)]);},
  pendingMs:0,
  pendingComponent:()=> <div className="space-y-6"><Skeleton className="h-32 w-full"/><div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-48"/><Skeleton className="h-48"/><Skeleton className="h-48"/><Skeleton className="h-48"/></div></div>,
  errorComponent:DashboardError,
  notFoundComponent:()=> <p>Project not found.</p>,
  head: () => ({ meta: [{ title: "Dashboard — Compass Workflow" }, { name: "description", content: "Project health, progress and what needs attention." }, { property: "og:title", content: "Dashboard — Compass Workflow" }, { property: "og:description", content: "Project health, progress and what needs attention." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Page,
});

function Page() {
  const {me}=Route.useRouteContext();
  const {data}=useSuspenseQuery(dashboardQuery(me.userId,me.membership?.project.id??'',me.membership?.role??''));
  return <DashboardView data={data} canSeeWork={me.membership?.role==='owner'||me.membership?.role==='member'}/>;
}
function DashboardError({error}:{error:Error}){const router=useRouter();return <ErrorState message={error.message} onRetry={()=>router.invalidate()}/>;}
