import { fetchAll } from "./task-list.server";
import type { Db } from "@/lib/project-access.server";
import type { RiskFilters } from "@/lib/schemas/registers";
import { ownerOr } from "./register-filters";
export function riskRows(supabase: Db, projectId: string, f: RiskFilters, max = Infinity) {
  const build = () => {
    let q = supabase.from("risks").select("*").eq("project_id", projectId);
    if (f.status.length) q = q.in("status", f.status);
    if (f.rating.length) q = q.in("rating", f.rating);
    if (f.category.length) q = q.in("category", f.category);
    if (f.owner.length) q = q.or(ownerOr(f.owner));
    if (f.p) q = q.eq("probability", f.p);
    if (f.i) q = q.eq("impact", f.i);
    return q
      .order(f.sort, { ascending: f.dir === "asc", nullsFirst: false })
      .order("created_at")
      .order("id");
  };
  return fetchAll((from, to) => build().range(from, to), max);
}
