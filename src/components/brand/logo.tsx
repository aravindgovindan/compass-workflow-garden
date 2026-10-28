import { cn } from "@/lib/utils";
import logoAsset from "@/assets/compass-icon.png.asset.json";

export function Logo({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-display text-lg font-semibold", className)}>
      <span
        className={cn("grid size-8 place-items-center rounded-md", inverted && "bg-card p-0.5")}
        aria-hidden
      >
        <img src={logoAsset.url} alt="" className="size-full object-contain" />
      </span>
      Compass Workflow
    </span>
  );
}
