import {expect,it} from 'vitest';
import {writeFile} from 'node:fs/promises';
import {createCloudProjectClient} from '../src/lib/cloudProjectClient';
import {createCollaborationClient} from '../src/lib/collaborationClient';
import {createReviewClient} from '../src/lib/reviewClient';
import {newInviteToken} from '../src/domain/collaboration';
import {createDemoProject} from '../src/domain/model';
import {exportProjectPackage,importProjectPackage} from '../src/lib/projectPackage';
/** Actual HTTP/R2/D1 and D1 batch; provider identities are explicit synthetic data. */
it.skipIf(process.env.GONGGAN_COLLABORATION_NATIVE!=='1')('accepts roles and edits complete private packages through a real local Worker',async()=>{
 const origin='http://127.0.0.1:8817',bridge=(path:string,init?:RequestInit)=>fetch(origin+path,init),id=crypto.randomUUID(),a=createCloudProjectClient('account-a',bridge),b=createCloudProjectClient('account-b',bridge),ca=createCollaborationClient('account-a',bridge),cb=createCollaborationClient('account-b',bridge),cc=createCollaborationClient('account-c',bridge),report={scope:'actual local Wrangler HTTP/R2/D1 and batch',identityProvider:'explicit synthetic verified A/B/C; no real Supabase',production:false,projectId:id,privatePackageRead:false,recipientBinding:false,atomicInviteAccept:false,editorSave:false,ownerArchiveRestriction:false,privateComments:false,roleDowngrade:false,revokedAccess:false,oldTokenNoRegrant:false,archived:false};
 try{
  let p=createDemoProject();p.artworks=[];p.note='PRIVATE SHARED INTERNAL NOTE';const packageFile=await exportProjectPackage(p,async()=>{throw new Error('No demo images requested');});await a.save(id,0,packageFile,{name:p.name,venue:p.venue,sourceProjectId:p.id});
  const inv={id:crypto.randomUUID(),email:'b@example.test',role:'editor' as const,token:newInviteToken()};await ca.invite(id,inv);await expect(cc.preview(inv.id,inv.token)).rejects.toMatchObject({status:404});report.recipientBinding=true;
  expect((await cb.preview(inv.id,inv.token)).accepted).toBe(false);const accepted=await Promise.all([cb.preview(inv.id,inv.token,true),cb.preview(inv.id,inv.token,true)]);expect(accepted.every(r=>r.accepted&&r.role==='editor')).toBe(true);expect((await ca.members(id)).items).toHaveLength(1);report.atomicInviteAccept=true;
  const read=await b.read(id);expect((await importProjectPackage(read.bytes)).note).toBe(p.note);expect((await b.listShared())[0].role).toBe('editor');report.privatePackageRead=true;
  p={...p,name:'합성 협업 편집'};const edit=await exportProjectPackage(p,async()=>{throw new Error('No demo images requested');});expect((await b.save(id,1,edit,{name:p.name,venue:p.venue,sourceProjectId:p.id})).revision).toBe(2);expect((await importProjectPackage((await a.read(id)).bytes)).name).toBe(p.name);report.editorSave=true;
  await expect(b.archive(id,2,true)).rejects.toMatchObject({status:403});report.ownerArchiveRestriction=true;
  const comments=createReviewClient(id,'account-b',bridge,undefined,'project'),draft={id:crypto.randomUUID(),postId:crypto.randomUUID(),name:'합성 참여자',text:'비공개 검토',anchor:{kind:'project' as const,sceneId:null}};expect((await comments.create(draft)).items).toHaveLength(1);report.privateComments=true;
  const member=(await ca.members(id)).items[0];await ca.changeMember(id,member.userId,member.revision,'viewer',false);await expect(b.save(id,2,edit,{name:p.name,venue:p.venue,sourceProjectId:p.id})).rejects.toMatchObject({status:403});expect((await comments.list()).canComment).toBe(false);await expect(comments.change(draft.id,1,{action:'deleteThread'})).rejects.toMatchObject({status:403});report.roleDowngrade=true;
  const downgraded=(await ca.members(id)).items[0];await ca.changeMember(id,downgraded.userId,downgraded.revision,'viewer',true);await expect(b.read(id)).rejects.toMatchObject({status:404});await expect(comments.list()).rejects.toMatchObject({status:404});report.revokedAccess=true;await expect(cb.preview(inv.id,inv.token,true)).rejects.toMatchObject({status:410});report.oldTokenNoRegrant=true;
 }finally{
  const latest=await a.metadata(id);expect((await a.archive(id,latest.revision,true)).archived).toBe(true);report.archived=true;await writeFile('/tmp/gonggan-collaboration-native-20261007-result.json',JSON.stringify(report,null,2));
 }
},30000);
