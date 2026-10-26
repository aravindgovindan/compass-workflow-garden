import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { projectAccess, requireTaskReader, type Db } from '@/lib/project-access.server';
import { idInput, invitationInput, memberInput } from '@/lib/collaboration/schemas';
import { assertOwnerRemains } from '@/lib/collaboration/rules';
import type { ProjectRole } from '@/lib/auth/roles';
function teamError(error: { message: string; code?: string }) {
  if (/last owner|already on the project|valid email|Active member|Choose another|Pending invitation/.test(error.message)) throw new Error(error.message);
  if (error.code === '23505') throw new Error('A pending invitation already exists for that email.');
  console.error('Team operation failed', error); throw new Error('Could not save this change. Please try again.');
}
async function owner(supabase: Db, userId: string) {
  const access = await projectAccess(supabase,userId);
  if (access.role !== 'owner') throw new Error('Only owners can manage the team.');
  return access.projectId;
}
export type TeamPerson = { user_id: string; full_name: string; email: string | null; job_title: string | null; role: ProjectRole; open_tasks: number };
export const listTeam = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }): Promise<TeamPerson[]> => {
  const { supabase, userId } = context; const projectId = await requireTaskReader(supabase,userId);
  const m = await supabase.from('project_members').select('user_id,role').eq('project_id',projectId).eq('active',true);
  if (m.error) teamError(m.error);
  const ids = (m.data ?? []).map(p => p.user_id);
  if (!ids.length) return [];
  const [profiles,s] = await Promise.all([
    supabase.from('profiles').select('id,full_name,email,job_title').in('id',ids),
    supabase.from('workflow_statuses').select('id').eq('project_id',projectId).neq('category','done'),
  ]);
  if (profiles.error) teamError(profiles.error); if (s.error) teamError(s.error);
  const openStatuses = (s.data ?? []).map(x => x.id);
  const counts = await Promise.all(ids.map(async id => {
    if (!openStatuses.length) return [id,0] as const;
    const result = await supabase.from('tasks').select('id',{ count: 'exact', head: true }).eq('project_id',projectId).eq('assignee_id',id).in('status_id',openStatuses);
    if (result.error) teamError(result.error); return [id,result.count ?? 0] as const;
  }));
  const countMap = new Map(counts);
  return (m.data ?? []).map(p => { const profile = profiles.data?.find(x => x.id === p.user_id); return { ...p, full_name: profile?.full_name ?? 'Unknown person', email: profile?.email ?? null, job_title: profile?.job_title ?? null, open_tasks: countMap.get(p.user_id) ?? 0 }; }).sort((a,b) => a.full_name.localeCompare(b.full_name));
});
export const listInvitations = createServerFn({ method:'GET' }).middleware([requireSupabaseAuth]).handler(async ({context}) => {
  const projectId = await owner(context.supabase,context.userId);
  const {data,error} = await context.supabase.from('pending_invitations').select('*').eq('project_id',projectId).order('created_at',{ascending:false});
  if(error) teamError(error); return data ?? [];
});
export const inviteMember = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown) => invitationInput.parse(i)).handler(async ({data,context}) => {
  const projectId = await owner(context.supabase,context.userId);
  const result = await context.supabase.rpc('invite_project_member',{_project_id:projectId,_email:data.email,_role:data.role});
  if(result.error) teamError(result.error); return {id:result.data};
});
export const revokeInvitation = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown) => idInput.parse(i)).handler(async ({data,context}) => {
  const projectId = await owner(context.supabase,context.userId);
  const invitation = await context.supabase.from('pending_invitations').select('id').eq('project_id',projectId).eq('id',data.id).maybeSingle();
  if(!invitation.data) throw new Error('Invitation not found.');
  const result = await context.supabase.rpc('revoke_project_invitation',{_id:data.id}); if(result.error) teamError(result.error); return {ok:true};
});
export const changeMember = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown) => memberInput.parse(i)).handler(async ({data,context}) => {
  const projectId = await owner(context.supabase,context.userId);
  const members = await context.supabase.from('project_members').select('user_id,role').eq('project_id',projectId).eq('active',true);
  if(members.error) teamError(members.error);
  const target = members.data?.find(m => m.user_id === data.userId); if(!target) throw new Error('Active member not found.');
  assertOwnerRemains(target.role,members.data?.filter(m => m.role === 'owner').length ?? 0,data.role,data.deactivate);
  const result = await context.supabase.rpc('change_project_member',{_project_id:projectId,_user_id:data.userId,_role:data.role,_deactivate:data.deactivate,...(data.reassignTo ? {_reassign_to:data.reassignTo} : {})});
  if(result.error) teamError(result.error); return {ok:true};
});
