import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { getCurrentUser } from '@/functions/session.functions';
import { listTeam, listInvitations } from '@/functions/team.functions';
import { listComments } from '@/functions/comments.functions';
import { listActivity } from '@/functions/activity.functions';
import type { DiscussionEntity } from './rules';
import type { z } from 'zod';
import type { activityInput } from './schemas';
export const currentPersonQuery = queryOptions({queryKey:['collaboration','me'],queryFn:() => getCurrentUser()});
export const teamQuery = queryOptions({queryKey:['team'],queryFn:() => listTeam()});
export const invitationsQuery = queryOptions({queryKey:['invitations'],queryFn:() => listInvitations()});
export const commentsQuery = (type:DiscussionEntity,id:string,page:number) => queryOptions({queryKey:['comments',type,id,page],queryFn:() => listComments({data:{entityType:type,entityId:id,page}})});
export const activityQuery = (data:z.input<typeof activityInput>) => queryOptions({queryKey:['activity',data],queryFn:() => listActivity({data})});
export function useCollaborationMutation<I,O>(fn:(opts:{data:I}) => Promise<O>) {
  const qc = useQueryClient(); const call = useServerFn(fn);
  return useMutation({mutationFn:(data:I) => call({data}),onError:(e) => toast.error(e instanceof Error ? e.message : 'Could not save.'),onSuccess:async () => {
    await Promise.all(['comments','activity','team','invitations','project-config','tasks','collaboration'].map(key => qc.invalidateQueries({queryKey:[key]})));
  }});
}
