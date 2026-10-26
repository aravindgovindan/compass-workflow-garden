import { createFileRoute } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import { SectionPlaceholder } from "@/components/layout/section-placeholder";
import { guardSection } from "@/lib/auth/guard";

export const Route = createFileRoute("/_authenticated/activity")({
  beforeLoad: guardSection("activity"),
  head: () => ({ meta: [{ title: "Activity — PlanAProject" }, { name: "description", content: "Every change, in order." }] }),
  component: Page,
});

function Page() {
  return <SectionPlaceholder title="Activity" description="Every change, in order." icon={Activity} />;
}
