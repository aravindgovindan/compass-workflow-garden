import type { z } from "zod";
import { taskList } from "@/lib/schemas/tasks";
import { fail, type Db } from "@/lib/project-access.server";
export async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{data:T[]|null;error:unknown;count?:number|null}>,max=Infinity) {
 const rows:T[]=[];let total=0;
 for(let from=0;from<max;from+=1000){const r=await page(from,Math.min(from+1000,max)-1);if(r.error)fail("load the list",r.error as never);if(from===0)total=r.count??0;rows.push(...(r.data??[]));if((r.data??[]).length<1000)break;}
 return {rows,total:Math.max(total,rows.length)};
}
export async function filteredTasks(supabase:Db,projectId:string,data:z.output<typeof taskList>,max=Infinity){
    const defs = Object.keys(data.cf).length ? (await supabase.from("custom_field_defs").select("key,type").eq("project_id",projectId).eq("entity_type","task").eq("archived",false)).data ?? [] : [];
    const build = () => {
      let q = supabase.from("tasks").select("*, task_labels(label_id)", { count: "exact" }).eq("project_id", projectId);
      if (data.topLevelOnly) q = q.is("parent_task_id", null);
      if (data.search) {
        const s = data.search.replace(/[%_\\,()*"]/g, " ").trim();
        if (s) q = q.or(`title.ilike.*${s}*,description.ilike.*${s}*`);
      }
      if (data.statusIds?.length) q = q.in("status_id", data.statusIds);
      if (data.priorityIds?.length) q = q.in("priority_id", data.priorityIds);
      if (data.phaseIds?.length) q = q.in("phase_id", data.phaseIds);
      if (data.milestoneIds?.length) {
        const real = data.milestoneIds.filter((m) => m !== "none");
        const none = real.length !== data.milestoneIds.length;
        if (none && real.length) q = q.or(`milestone_id.is.null,milestone_id.in.(${real.join(",")})`);
        else if (none) q = q.is("milestone_id", null);
        else q = q.in("milestone_id", real);
      }
      if (data.assigneeIds?.length) {
        const real = data.assigneeIds.filter((a) => a !== "none");
        const none = real.length !== data.assigneeIds.length;
        if (none && real.length) q = q.or(`assignee_id.is.null,assignee_id.in.(${real.join(",")})`);
        else if (none) q = q.is("assignee_id", null);
        else q = q.in("assignee_id", real);
      }
      if (data.dueFrom) q = q.gte("due_date", data.dueFrom);
      if (data.dueTo) q = q.lte("due_date", data.dueTo);
      if (data.overdue) q = q.lt("due_date", new Date().toISOString().slice(0, 10)).is("completed_at", null);
      for (const [key, value] of Object.entries(data.cf)) {
        const def = defs.find((d) => d.key === key);
        if (!def) continue;
        if (def.type === "multi_select") q = q.contains("custom_fields", { [key]: [value] });
        else if (def.type === "text" || def.type === "long_text" || def.type === "url") q = q.ilike(`custom_fields->>${key}`, `%${value.replace(/[%_\\]/g, "\\$&")}%`);
        else if (def.type === "checkbox" && value === "false") q = q.or(`custom_fields->>${key}.is.null,custom_fields->>${key}.eq.false`);
        else q = q.eq(`custom_fields->>${key}`, value);
      }
      return q.order(data.sort, { ascending: data.dir === "asc", nullsFirst: false }).order("id");
    };
    const { rows: raw, total } = await fetchAll((from, to) => build().range(from, to), max);
    let rows = raw;
    if (data.labelIds?.length) {
      const want = new Set(data.labelIds);
      rows = rows.filter((r) => (r.task_labels ?? []).some((l) => want.has(l.label_id)));
    }
return {rows:rows.map(({task_labels,...r})=>({...r,label_ids:(task_labels??[]).map(l=>l.label_id)})),total:data.labelIds?.length?rows.length:total};
}
