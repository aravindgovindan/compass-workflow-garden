import { createFileRoute } from "@tanstack/react-router";
import { ActivityPage } from "@/components/collaboration/activity-page";
import { activityQuery } from "@/lib/collaboration/queries";
import { guardSection } from "@/lib/auth/guard";
export const Route = createFileRoute("/_authenticated/_app/activity")({
  beforeLoad: guardSection("activity"),
  loader: ({context}) => context.queryClient.ensureQueryData(activityQuery({page:0})),
  head: () => ({ meta: [{title:"Activity — Compass Workflow"},{name:"description",content:"Project changes, authors and record history."},{property:"og:title",content:"Activity — Compass Workflow"},{property:"og:description",content:"Project changes, authors and record history."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}] }),
  component: Page,
});
function Page() {  return <ActivityPage />; }
