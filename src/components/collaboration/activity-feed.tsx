import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft,ChevronRight,ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/empty-state';
import { activityQuery } from '@/lib/collaboration/queries';
import { useTerm } from '@/lib/terminology/use-term';
import { useProjectConfig } from '@/lib/config/use-config';
import { parseMentions } from '@/lib/collaboration/rules';
import type { z } from 'zod';
import type { activityInput } from '@/lib/collaboration/schemas';
function display(v:unknown,names:Map<string,string>):string {
  if(v===null||v===undefined||v==='')return '—';
  if(typeof v==='string')return names.get(v) ?? parseMentions(v).map(p=>p.userId?`@${p.text}`:p.text).join('');
  return typeof v==='object'?JSON.stringify(v):String(v);
}
export function ActivityFeed({filters={}}:{filters?:z.input<typeof activityInput>}) {
  const [page,setPage]=useState(0);const term=useTerm();const q=useQuery(activityQuery({...filters,page}));
  const config=useProjectConfig();
  const names=new Map<string,string>();
  for(const person of config.data?.members??[])names.set(person.user_id,person.full_name);
  for(const item of [...(config.data?.statuses??[]),...(config.data?.priorities??[]),...(config.data?.labels??[])])names.set(item.id,item.name);
  const fieldName=(key:string)=>key==='assignee_id'?'Assignee':key==='reporter_id'?'Reporter':key==='owner_id'?'Owner':key==='status_id'?'Status':key==='priority_id'?'Priority':key==='milestone_id'?term('milestone','singular'):key==='phase_id'?term('phase','singular'):key.replaceAll('_',' ');
  if(q.isPending)return <Skeleton className="h-40 w-full"/>;
  if(q.error)return <ErrorState message={q.error.message} onRetry={()=>q.refetch()}/>;
  const entityName=(type:string)=>type==='comments'?'comment':type==='mentions'?'mention':type==='pending_invitations'?'invitation':type==='tasks'?term('task','singular'):type==='risks'?term('risk','singular'):type==='issues'?term('issue','singular'):type==='milestones'?term('milestone','singular'):type==='project_members'?term('member','singular'):type.replaceAll('_',' ');
  return <div className="space-y-4"><ol className="divide-y">{q.data?.items.map(row=>{
    const changes=row.changes as Record<string,unknown>;const snapshot=(changes['after']??changes['before']) as Record<string,unknown>|undefined;
    const fields=row.action==='update'?Object.entries(changes):Object.entries(snapshot??{}).filter(([k])=>!['id','project_id','created_at','updated_at'].includes(k));
    return <li key={row.id} className="space-y-2 py-4"><div className="flex flex-wrap justify-between gap-1 text-sm"><p><span className="font-semibold">{row.actor_name}</span> · {row.action==='create'?'created':row.action==='delete'?'deleted':'updated'} {entityName(row.entity_type)}{row.record_title ? ` · ${row.record_title}` : snapshot?.['title']||snapshot?.['name']?` · ${String(snapshot['title']??snapshot['name'])}`:''}</p><time className="text-xs text-muted-foreground" dateTime={row.created_at}>{new Date(row.created_at).toLocaleString()}</time></div>
    <dl className="space-y-1 text-xs">{fields.map(([field,value])=>{const diff=value as {from?:unknown;to?:unknown}|null;return <div key={field} className="grid grid-cols-[100px_minmax(0,1fr)] gap-2"><dt className="break-words text-muted-foreground">{fieldName(field)}</dt><dd className="flex min-w-0 flex-wrap items-start gap-1 break-words">{row.action==='update'?<><span className="min-w-0 whitespace-pre-wrap break-all text-muted-foreground">{display(diff?.from,names)}</span><ArrowRight className="size-3 shrink-0"/><span className="min-w-0 whitespace-pre-wrap break-all">{display(diff?.to,names)}</span></>:<span className="min-w-0 whitespace-pre-wrap break-all">{display(value,names)}</span>}</dd></div>;})}</dl></li>;
  })}</ol>{!q.data?.items.length&&<p className="py-6 text-sm text-muted-foreground">No changes recorded.</p>}
  <div className="flex items-center justify-between"><Button size="icon" variant="outline" title="Previous page" aria-label="Previous history page" disabled={!page} onClick={()=>setPage(p=>p-1)}><ChevronLeft className="size-4"/></Button><span className="text-xs text-muted-foreground">Page {page+1} · {q.data?.total??0} changes</span><Button size="icon" variant="outline" title="Next page" aria-label="Next history page" disabled={(page+1)*30>=(q.data?.total??0)} onClick={()=>setPage(p=>p+1)}><ChevronRight className="size-4"/></Button></div></div>;
}
