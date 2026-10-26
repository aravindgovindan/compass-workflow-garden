import { riskScore, type RiskRating } from "@/lib/risks/score";
import { useTerm } from "@/lib/terminology/use-term";
import { cn } from "@/lib/utils";

const CELL: Record<RiskRating, string> = {
  low: "bg-health-green-soft",
  medium: "bg-health-amber-soft",
  high: "bg-health-red-soft",
  critical: "bg-health-red text-primary-foreground",
};

/** 5×5 probability × impact grid of active (open or mitigating) risks. Clicking a cell filters the list. */
export function RiskHeatmap({ heat, selected, onSelect }: {
  heat: number[][]; selected: { p?: number | undefined; i?: number | undefined }; onSelect: (cell: { p?: number; i?: number }) => void;
}) {
  const term = useTerm();
  const noun = term("risk").toLowerCase();
  return (
    <figure className="rounded-xl border bg-card p-4">
      <figcaption className="mb-3 text-sm font-medium">Heatmap <span className="font-normal text-muted-foreground">· open and mitigating {noun}</span></figcaption>
      <div className="flex gap-2">
        <div className="flex items-center"><span className="-rotate-180 text-xs text-muted-foreground [writing-mode:vertical-rl]">Probability</span></div>
        <div className="flex-1">
          <div role="grid" aria-label={`${term("risk")} heatmap`} className="grid grid-cols-[auto_repeat(5,minmax(0,1fr))] gap-1">
            {[5, 4, 3, 2, 1].map((p) => (
              <div role="row" key={p} className="contents">
                <span className="flex w-4 items-center justify-center text-xs text-muted-foreground">{p}</span>
                {[1, 2, 3, 4, 5].map((i) => {
                  const n = heat[p - 1]?.[i - 1] ?? 0;
                  const on = selected.p === p && selected.i === i;
                  return (
                    <button key={i} type="button" role="gridcell" aria-pressed={on}
                      aria-label={`Probability ${p}, impact ${i}: ${n} ${noun}`}
                      onClick={() => onSelect(on ? {} : { p, i })}
                      className={cn("flex aspect-square min-h-9 items-center justify-center rounded text-sm font-semibold tabular-nums transition",
                        CELL[riskScore(p, i).rating], n === 0 && "opacity-50", on && "ring-2 ring-ring ring-offset-2 ring-offset-background")}>
                      {n || ""}
                    </button>
                  );
                })}
              </div>
            ))}
            <span />
            {[1, 2, 3, 4, 5].map((i) => <span key={i} className="text-center text-xs text-muted-foreground">{i}</span>)}
          </div>
          <p className="mt-1 text-center text-xs text-muted-foreground">Impact</p>
        </div>
      </div>
    </figure>
  );
}
