import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";

/** Main app layout. Users without a project are sent to the first-run setup. */
export const Route = createFileRoute("/_authenticated/_app")({
  beforeLoad: ({ context }) => {
    if (!context.me.membership) throw redirect({ to: "/setup" });
  },
  component: AppLayout,
});

function AppLayout() {
  const { me } = Route.useRouteContext();
  return (
    <AppShell me={me}>
      <Outlet />
    </AppShell>
  );
}
