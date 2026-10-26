import { describe,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { assertOwnerRemains,canReadComments,canCreateComment,canEditComment,canDeleteComment,canMutateActivity,mentionIds,parseMentions,mentionToken } from './rules';
import { memberInput,invitationInput,activityInput } from './schemas';
const uid='12345678-1234-1234-1234-123456789abc';
describe('last active owner',()=>{
 it('cannot demote the last owner',()=>expect(()=>assertOwnerRemains('owner',1,'member',false)).toThrow('last owner'));
 it('cannot deactivate the last owner',()=>expect(()=>assertOwnerRemains('owner',1,'owner',true)).toThrow('last owner'));
 it('can demote an owner if another remains',()=>expect(()=>assertOwnerRemains('owner',2,'member',false)).not.toThrow());
 it('can deactivate a member',()=>expect(()=>assertOwnerRemains('member',1,'member',true)).not.toThrow());
});
describe('comment role permissions',()=>{
 it('stakeholders read risk and issue comments but not task comments',()=>{expect(canReadComments('stakeholder','risk')).toBe(true);expect(canReadComments('stakeholder','issue')).toBe(true);expect(canReadComments('stakeholder','task')).toBe(false);});
 it('only owners and members can post',()=>{expect(canCreateComment('owner')).toBe(true);expect(canCreateComment('member')).toBe(true);expect(canCreateComment('stakeholder')).toBe(false);});
 it('members edit only their own comments',()=>{expect(canEditComment('member','u','u')).toBe(true);expect(canEditComment('member','u','other')).toBe(false);});
 it('owners cannot edit another author',()=>{expect(canEditComment('owner','u','other')).toBe(false);expect(canEditComment('owner','u','u')).toBe(true);});
 it('owners can delete any, members only their own',()=>{expect(canDeleteComment('owner','u','other')).toBe(true);expect(canDeleteComment('member','u','other')).toBe(false);expect(canDeleteComment('member','u','u')).toBe(true);});
 it('stakeholders cannot edit or delete even their own historic comments',()=>{expect(canEditComment('stakeholder','u','u')).toBe(false);expect(canDeleteComment('stakeholder','u','u')).toBe(false);});
});
describe('mention parsing',()=>{
 it('parses a name with spaces and preserves surrounding text',()=>expect(parseMentions(`Hi @[Alex Doe](${uid})!`)).toEqual([{text:'Hi '},{text:'Alex Doe',userId:uid},{text:'!'}]));
 it('deduplicates mentions',()=>expect(mentionIds(`@[Alex](${uid}) @[Alex](${uid})`)).toEqual([uid]));
 it('does not parse malformed IDs or raw HTML',()=>expect(mentionIds('@[Alex](bad-id) <script>x</script>')).toEqual([]));
 it('removes brackets and newlines from a token label',()=>expect(mentionToken('A]\nB',uid)).toBe(`@[AB](${uid})`));
});
describe('append-only history',()=>{
 for(const role of ['owner','member','stakeholder'] as const) it(`${role} cannot modify activity`,()=>{for(const action of ['insert','update','delete'] as const)expect(canMutateActivity(role,action)).toBe(false);});
 it('migration revokes client writes and removes nonread policies',()=>{
   const sql=readFileSync('drizzle/migrations/0006_team_collaboration.sql','utf8');
   expect(sql).toMatch(/revoke insert, update, delete, truncate on public\.activity_log from anon, authenticated/i);
   expect(sql).toContain("tablename = 'activity_log' and cmd <> 'SELECT'");
   expect(sql).not.toMatch(/create policy[^;]+on public\.activity_log for (insert|update|delete|all)/i);
 });
});
describe('collaboration validation',()=>{
 it('normalizes invitation email',()=>expect(invitationInput.parse({email:'  Alex@Example.COM ',role:'member'}).email).toBe('alex@example.com'));
 it('unassign is represented by null',()=>expect(memberInput.parse({userId:uid,role:'member',deactivate:true}).reassignTo).toBe(null));
 it('rejects reversed activity dates',()=>expect(activityInput.safeParse({from:'2026-10-26',to:'2026-10-25'}).success).toBe(false));
});
