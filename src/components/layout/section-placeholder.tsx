import type { LucideIcon } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/common/empty-state";
import type { TermKey } from "@/lib/terminology/defaults";
import { useTerm } from "@/lib/terminology/use-term";

/** Temporary page body for sections built in later steps. Title comes from the terminology map. */
export function SectionPlaceholder({ term: key, description, icon }: { term: TermKey; description: string; icon: LucideIcon }) {
  const term = useTerm();
  const title = term(key, "plural");
  return (
    <>
      <PageHeader title={title} description={description} />
      <EmptyState icon={icon} title={`No ${title.toLowerCase()} yet`} description="This section is being set up and will be available soon." />
    </>
  );
}
