import { createFileRoute } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import { SectionPlaceholder } from "@/components/layout/section-placeholder";
import { guardSection } from "@/lib/auth/guard";

export const Route = createFileRoute("/_authenticated/_app/activity")({
  beforeLoad: guardSection("activity"),
  head: () => ({ meta: [{ title: "Activity — Compass Workflow" }, { name: "description", content: "Every change, in order." }] }),
  component: Page,
});

function Page() {
  return <SectionPlaceholder term="activity" description="Every change, in order." icon={Activity} />;
}
