import {expect,it} from 'vitest';
import {authReturnPath} from './authConfig';
import {invitationSecret,storedInvitationSecret,invitationStorageKey} from './projectInvitation';
import {inviteEmail,memberRole,newInviteToken,inviteTokenHash,canEditProject,canCommentProject} from './collaboration';
it('accepts only exact short-lived fragment tokens and safe local login return routes',()=>{
 const id=crypto.randomUUID(),token=newInviteToken();expect(invitationSecret('#token='+token)).toBe(token);for(const hash of ['#token='+token+'&x=1','#access_token='+token,'#token=invalid'])expect(invitationSecret(hash)).toBeUndefined();expect(invitationStorageKey(id)).toContain(id);const now=Date.now();expect(storedInvitationSecret(JSON.stringify({token,expiresAt:now+1000}),now)).toBe(token);for(const expiresAt of [now-1,now+8*86400000,Infinity])expect(storedInvitationSecret(JSON.stringify({token,expiresAt}),now)).toBeUndefined();expect(authReturnPath('/join/'+id)).toBe('/join/'+id);for(const path of ['//evil.test/join/'+id,'/join/'+id+'?token=x','/join/invalid','/join/'+id+'#token='+token])expect(authReturnPath(path)).toBe('/auth/callback');
});
it('keeps exact email alias identities, excludes owner from invitations and separates edit/comment roles',async()=>{
 expect(inviteEmail(' TEST+alias@Example.test ')).toBe('test+alias@example.test');expect(()=>memberRole('owner')).toThrow();expect(canEditProject('commenter')).toBe(false);expect(canCommentProject('commenter')).toBe(true);expect(canCommentProject('viewer')).toBe(false);const token=newInviteToken();expect(token).toMatch(/^[0-9a-f]{48}$/);expect(await inviteTokenHash(token)).toMatch(/^[0-9a-f]{64}$/);expect(await inviteTokenHash(token)).not.toBe(token);
});
