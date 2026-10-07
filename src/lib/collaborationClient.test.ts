import {expect,it} from 'vitest';
import {collaborationFixture,collaborationUsers} from '../worker/collaborationApi.fixture';
import {createCollaborationClient,parseProjectMember,parseProjectInvitation} from './collaborationClient';
import {createCloudProjectClient} from './cloudProjectClient';
import {createReviewClient} from './reviewClient';
import {newInviteToken} from '../domain/collaboration';
it('round trips owner administration, confirmed invite preview/accept, role updates and private comments through real SQL',async()=>{
 const f=collaborationFixture();try{await f.save();const a=createCollaborationClient('a',f.bridge),b=createCollaborationClient('b',f.bridge),value={id:crypto.randomUUID(),token:newInviteToken(),email:' B@example.test ',role:'commenter' as const},invite=await a.invite(f.id,value);expect(invite.email).toBe('b@example.test');expect((await b.preview(value.id,value.token)).accepted).toBe(false);expect((await b.preview(value.id,value.token,true)).role).toBe('commenter');
  expect((await a.members(f.id)).items[0].role).toBe('commenter');expect((await a.invitations(f.id)).items[0].status).toBe('accepted');expect((await createCloudProjectClient('b',f.bridge).listShared())[0].role).toBe('commenter');
  const comments=createReviewClient(f.id,'b',f.bridge,undefined,'project'),draft={id:crypto.randomUUID(),postId:crypto.randomUUID(),name:'참여자',text:'공동 의견',anchor:{kind:'project' as const,sceneId:null}};expect((await comments.create(draft)).items[0].anchor.label).toBe(f.meta.name);expect((await a.changeMember(f.id,collaborationUsers.b,1,'viewer',false)).role).toBe('viewer');await expect(comments.change(draft.id,1,{action:'deleteThread'})).rejects.toMatchObject({status:403});
 }finally{f.close();}
});
it('validates returned roles and resource identities and forwards cancellation without sending secrets via URL',async()=>{
 const signal=new AbortController().signal,token=newInviteToken(),id=crypto.randomUUID(),seen:string[]=[];const api=createCollaborationClient('account',async(url,init)=>{seen.push(url);expect(init?.signal).toBe(signal);expect(url).not.toContain(token);expect(JSON.parse(String(init?.body)).token).toBe(token);return Response.json({projectId:id,name:'Project',venue:'',role:'administrator',accepted:false});},signal);await expect(api.preview(id,token)).rejects.toThrow();expect(seen).toEqual(['/api/project-invitations/'+id+'/preview']);expect(()=>parseProjectMember({})).toThrow();expect(()=>parseProjectInvitation({status:'pending'})).toThrow();expect(()=>createReviewClient(id,'account')).toThrow();expect(()=>createReviewClient('a'.repeat(48),'account',fetch,undefined,'project')).toThrow();
});
