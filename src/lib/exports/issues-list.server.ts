import { fetchAll } from "./task-list.server";
import type { Db } from "@/lib/project-access.server";
import type { IssueFilters } from "@/lib/schemas/registers";
import { ownerOr } from "./register-filters";
export function issueRows(supabase:Db,projectId:string,f:IssueFilters,max=Infinity){
 const build=()=>{
    let q = supabase.from("issues").select("*").eq("project_id", projectId);
    if (f.status.length) q = q.in("status", f.status);
    if (f.severity.length) q = q.in("severity", f.severity);
    if (f.category.length) q = q.in("category", f.category);
    if (f.owner.length) q = q.or(ownerOr(f.owner));
    return q.order(f.sort, { ascending: f.dir === "asc", nullsFirst: false }).order("created_at").order("id");

 };return fetchAll((from,to)=>build().range(from,to),max);
}
