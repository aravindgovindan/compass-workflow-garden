import type { LucideIcon } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/common/empty-state";

/** Temporary page body for sections that are built in later steps. */
export function SectionPlaceholder({ title, description, icon }: { title: string; description: string; icon: LucideIcon }) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <EmptyState icon={icon} title={`No ${title.toLowerCase()} yet`} description="This section is being set up and will be available soon." />
    </>
  );
}
