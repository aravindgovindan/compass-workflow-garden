import type { ProjectRole } from '@/lib/auth/roles';
export type DiscussionEntity = 'task' | 'risk' | 'issue';
export function canReadComments(role: ProjectRole, entity: DiscussionEntity) { return role !== 'stakeholder' || entity !== 'task'; }
export function canCreateComment(role: ProjectRole) { return role === 'owner' || role === 'member'; }
export function canEditComment(role: ProjectRole, userId: string, authorId: string) { return canCreateComment(role) && userId === authorId; }
export function canDeleteComment(role: ProjectRole, userId: string, authorId: string) { return role === 'owner' || (role === 'member' && userId === authorId); }
export function assertOwnerRemains(targetRole: ProjectRole, activeOwners: number, nextRole: ProjectRole, deactivate: boolean) {
  if (targetRole === 'owner' && activeOwners <= 1 && (nextRole !== 'owner' || deactivate)) throw new Error('The last owner cannot be removed or demoted');
}
export function canMutateActivity(_role: ProjectRole, _action: 'insert' | 'update' | 'delete') { return false; }
export type MentionPart = { text: string; userId?: string };
export function parseMentions(body: string): MentionPart[] {
  const pattern = /@\[([^\]\r\n]+)\]\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi;
  const parts: MentionPart[] = []; let start = 0;
  for (const m of body.matchAll(pattern)) {
    const at = m.index ?? 0;
    if (at > start) parts.push({ text: body.slice(start, at) });
    parts.push({ text: m[1] ?? '', userId: (m[2] ?? '').toLowerCase() }); start = at + m[0].length;
  }
  if (start < body.length) parts.push({ text: body.slice(start) });
  return parts;
}
export function mentionIds(body: string) { return [...new Set(parseMentions(body).flatMap(p => p.userId ? [p.userId] : []))]; }
export function mentionToken(name: string, id: string) { return `@[${name.replace(/[\]\r\n]/g, '')}](${id})`; }
