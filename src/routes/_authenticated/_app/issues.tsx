import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { SectionPlaceholder } from "@/components/layout/section-placeholder";
import { guardSection } from "@/lib/auth/guard";

export const Route = createFileRoute("/_authenticated/_app/issues")({
  beforeLoad: guardSection("issues"),
  head: () => ({ meta: [{ title: "Issues — PlanAProject" }, { name: "description", content: "Problems that need resolving now." }] }),
  component: Page,
});

function Page() {
  return <SectionPlaceholder term="issue" description="Problems that need resolving now." icon={AlertTriangle} />;
}
