import { createFileRoute } from "@tanstack/react-router";
import { TeamDirectory } from "@/components/collaboration/team-directory";
import { teamQuery } from "@/lib/collaboration/queries";
import { guardSection } from "@/lib/auth/guard";
export const Route = createFileRoute("/_authenticated/_app/team")({
  beforeLoad: guardSection("team"),
  loader: ({context}) => context.queryClient.ensureQueryData(teamQuery),
  head: () => ({ meta: [{title:"Team — Compass Workflow"},{name:"description",content:"People, roles and invitations for your project."},{property:"og:title",content:"Team — Compass Workflow"},{property:"og:description",content:"People, roles and invitations for your project."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}] }),
  component: Page,
});
function Page() { const {me} = Route.useRouteContext(); return <TeamDirectory isOwner={me.membership?.role === "owner"}/>; }
