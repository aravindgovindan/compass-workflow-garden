import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/common/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PickOne } from '@/components/tasks/shared';
import { teamQuery } from '@/lib/collaboration/queries';
import { useTerm } from '@/lib/terminology/use-term';
import { ActivityFeed } from './activity-feed';
export function ActivityPage() {
  const term=useTerm();const people=useQuery(teamQuery);const [actor,setActor]=useState<string|null>(null);const [type,setType]=useState<string|null>(null);const [from,setFrom]=useState('');const [to,setTo]=useState('');
  const filters={...(actor?{actorId:actor}:{}),...(type?{entityType:type}:{}),...(from?{from}:{}),...(to?{to}:{})};
  return <div className="space-y-6"><PageHeader title={term('activity')} description="Every change, in order."/><div className="grid gap-3 sm:grid-cols-4"><PickOne id="activity-person" label="Changed by" value={actor} onChange={setActor} allowNone noneLabel="All people" options={(people.data??[]).map(p=>({value:p.user_id,label:p.full_name}))}/><PickOne id="activity-type" label="Record type" value={type} onChange={setType} allowNone noneLabel="All record types" options={[{value:'tasks',label:term('task')},{value:'risks',label:term('risk')},{value:'issues',label:term('issue')},{value:'milestones',label:term('milestone')},{value:'project_members',label:term('member')},{value:'comments',label:'Comments'},{value:'mentions',label:'Mentions'},{value:'pending_invitations',label:'Invitations'},{value:'projects',label:'Project'},{value:'phases',label:term('phase')},{value:'workflow_statuses',label:'Statuses'},{value:'priorities',label:'Priorities'},{value:'labels',label:'Labels'},{value:'custom_field_defs',label:'Custom fields'},{value:'terminology',label:'Terminology'},{value:'saved_views',label:'Saved views'},{value:'task_checklist_items',label:'Checklist items'},{value:'task_labels',label:`${term('task','singular')} labels`}]}/><div className="space-y-1"><Label htmlFor="activity-from">From</Label><Input id="activity-from" type="date" value={from} max={to||undefined} onChange={e=>setFrom(e.target.value)}/></div><div className="space-y-1"><Label htmlFor="activity-to">To</Label><Input id="activity-to" type="date" value={to} min={from||undefined} onChange={e=>setTo(e.target.value)}/></div></div>{from&&to&&from>to?<p className="text-sm text-destructive">End date must not precede start date.</p>:<ActivityFeed key={JSON.stringify(filters)} filters={filters}/>}</div>;
}
