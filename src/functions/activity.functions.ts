import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { projectAccess } from '@/lib/project-access.server';
import { activityInput } from '@/lib/collaboration/schemas';
export const listActivity = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown) => activityInput.parse(i)).handler(async ({data,context}) => {
  const {projectId,role} = await projectAccess(context.supabase,context.userId);
  if(role === 'stakeholder' && (!data.entityId || !['risks','issues'].includes(data.entityType ?? ''))) throw new Error('You cannot access project activity.');
  if(data.entityId && data.entityType && ['tasks','risks','issues'].includes(data.entityType)) {
    const type = data.entityType === 'tasks' ? 'task' : data.entityType === 'risks' ? 'risk' : 'issue';
    const access = await context.supabase.rpc('can_read_discussion',{_pid:projectId,_type:type,_eid:data.entityId});
    if(access.error || !access.data) throw new Error('Record not found or not accessible.');
  }
  let q = context.supabase.from('activity_log').select('*',{count:'exact'}).eq('project_id',projectId);
  if(data.actorId) q = q.eq('actor_id',data.actorId);
  if(data.entityType) q = q.eq('entity_type',data.entityType);
  if(data.entityId) q = q.eq('entity_id',data.entityId);
  if(data.from) q = q.gte('created_at',`${data.from}T00:00:00Z`);
  if(data.to) { const end = new Date(`${data.to}T00:00:00Z`); end.setUTCDate(end.getUTCDate()+1); q = q.lt('created_at',end.toISOString()); }
  const r = await q.order('created_at',{ascending:false}).order('id',{ascending:false}).range(data.page*30,data.page*30+29);
  if(r.error) { console.error('Activity read failed',r.error); throw new Error('Could not load history.'); }
  const ids = [...new Set((r.data ?? []).flatMap(x => x.actor_id ? [x.actor_id] : []))];
  const p = ids.length ? await context.supabase.from('profiles').select('id,full_name').in('id',ids) : {data:[]};
  return {items:(r.data ?? []).map(x => ({...x,actor_name:x.actor_id ? p.data?.find(y => y.id === x.actor_id)?.full_name ?? 'Former member' : 'System'})),total:r.count ?? 0};
});
