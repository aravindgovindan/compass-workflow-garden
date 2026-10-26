import { toTermMap, resolveTerm } from "@/lib/terminology/defaults";
import { fetchAll } from "./task-list.server";
import { fail, type Db } from "@/lib/project-access.server";
import type { ExportKind } from "./csv";
export async function exportContext(db:Db,pid:string,kind:ExportKind){
 const [terms,fields,people,statuses,priorities,labels,phases,milestones]=await Promise.all([
  db.from('terminology').select('key,singular,plural').eq('project_id',pid),
  kind==='milestone'?Promise.resolve({data:[],error:null}):db.from('custom_field_defs').select('key,name,type').eq('project_id',pid).eq('entity_type',kind).eq('archived',false).order('position').order('id'),
  fetchAll((f,t)=>db.from('profiles').select('id,full_name').order('id').range(f,t)),
  db.from('workflow_statuses').select('id,name').eq('project_id',pid),db.from('priorities').select('id,name').eq('project_id',pid),db.from('labels').select('id,name').eq('project_id',pid),
  fetchAll((f,t)=>db.from('phases').select('id,name').eq('project_id',pid).order('id').range(f,t)),fetchAll((f,t)=>db.from('milestones').select('id,name').eq('project_id',pid).order('id').range(f,t)),
 ]);
 const error=terms.error||fields.error||statuses.error||priorities.error||labels.error;if(error)fail('prepare the export',error);
 const names=new Map([...people.rows.map(p=>[p.id,p.full_name] as const),...(statuses.data??[]).map(p=>[p.id,p.name] as const),...(priorities.data??[]).map(p=>[p.id,p.name] as const),...(labels.data??[]).map(p=>[p.id,p.name] as const),...phases.rows.map(p=>[p.id,p.name] as const),...milestones.rows.map(p=>[p.id,p.name] as const)]);
 const map=toTermMap(terms.data??[]);const term=(key:ExportKind|'phase'|'subtask')=>resolveTerm(map,key,'singular');
 return {fields:fields.data??[],term,name:(id:string|null)=>id?(names.get(id)??'Former member'):'',custom:(values:unknown)=>{const v=(values??{}) as Record<string,unknown>;return (fields.data??[]).map(f=>f.type==='user'?names.get(String(v[f.key]??''))??'':v[f.key]);},filename:`compass-workflow-${resolveTerm(map,kind).toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${new Date().toISOString().slice(0,10)}.csv`};
}