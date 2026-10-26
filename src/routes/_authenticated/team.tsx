import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { SectionPlaceholder } from "@/components/layout/section-placeholder";
import { guardSection } from "@/lib/auth/guard";

export const Route = createFileRoute("/_authenticated/team")({
  beforeLoad: guardSection("team"),
  head: () => ({ meta: [{ title: "Team — PlanAProject" }, { name: "description", content: "The people on this project." }] }),
  component: Page,
});

function Page() {
  return <SectionPlaceholder title="Team" description="The people on this project." icon={Users} />;
}
