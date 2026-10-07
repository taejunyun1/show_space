import {expect,it} from 'vitest';
import {writeFile} from 'node:fs/promises';
import {createDemoProject} from '../src/domain/model';
import {appendSceneSnapshot} from '../src/domain/sceneSnapshot';
import {publishPublicShare,revokePublicShare} from '../src/lib/shareClient';
import {createReviewClient} from '../src/lib/reviewClient';
/** Actual local HTTP/R2/D1. Provider identities are explicit synthetic responses. */
it.skipIf(process.env.GONGGAN_REVIEW_NATIVE!=='1')('stores and moderates separate review records through a real local Worker without changing shared geometry',async()=>{
 const origin='http://127.0.0.1:8816',bridge=(path:string,init?:RequestInit)=>fetch(origin+path,init),owned:Array<{id:string;token:string}>=[],report={scope:'actual local Wrangler HTTP/R2/D1',identityProvider:'explicit synthetic A/B and legacy; no real Supabase',production:false,commenterWrite:false,publicIdentityAbsent:false,sceneAnchor:false,replyRetryIdempotent:false,ownerModeration:false,concurrentConflict:false,layoutUnchanged:false,revoked:false,cleanupComplete:false};
 try{let p=createDemoProject();p.artworks=[];p.note='NEVER PUBLIC NOTE';p=appendSceneSnapshot(p,p,'검토 Scene');
  const link=await publishPublicShare(p,{includeDimensions:false,allowComments:true,sceneIds:[p.scenes[0].id]},'account-a',undefined,bridge,origin),id=link.split('/').at(-1)!;owned.push({id,token:'account-a'});const frozen=await(await bridge('/api/public/'+id)).text();
  const a=createReviewClient(id,'account-a',bridge),b=createReviewClient(id,'account-b',bridge),reader=createReviewClient(id,undefined,bridge),draft={id:crypto.randomUUID(),postId:crypto.randomUUID(),name:'합성 검토자',text:'벽면 설치 의견',anchor:{kind:'wall' as const,id:'wall-a',sceneId:p.scenes[0].id}};
  const created=await b.create(draft);expect(created.items[0].posts[0].mine).toBe(true);report.commenterWrite=true;expect(created.items[0].anchor.sceneName).toBe('검토 Scene');report.sceneAnchor=true;
  const publicData=await reader.list();expect(publicData.canComment).toBe(false);expect(JSON.stringify(publicData)).not.toMatch(/11111111|22222222|authorId|synthetic@example|NEVER PUBLIC/);report.publicIdentityAbsent=true;
  const reply={action:'reply' as const,id:crypto.randomUUID(),name:'합성 작성자',text:'간격 검토'};expect((await a.change(draft.id,1,reply))!.items[0].posts).toHaveLength(2);expect((await a.change(draft.id,1,reply))!.items[0].posts).toHaveLength(2);report.replyRetryIdempotent=true;
  const races=await Promise.allSettled(['의견 A','의견 B'].map(text=>b.change(draft.id,2,{action:'reply',id:crypto.randomUUID(),name:'합성 검토자',text})));expect(races.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect((races.find(r=>r.status==='rejected') as PromiseRejectedResult).reason.status).toBe(409);report.concurrentConflict=true;
  expect((await a.change(draft.id,3,{action:'resolve',resolved:true}))!.items[0].resolved).toBe(true);await expect(b.change(draft.id,4,{action:'edit',id:reply.id,text:'타인 수정'})).rejects.toMatchObject({status:403});expect((await a.change(draft.id,4,{action:'deletePost',id:draft.postId}))!.items[0].posts[0].deleted).toBe(true);report.ownerModeration=true;
  expect(await(await bridge('/api/public/'+id)).text()).toBe(frozen);report.layoutUnchanged=true;
  const legacyLink=await publishPublicShare(p,{includeDimensions:false,allowComments:true},'synthetic-legacy-owner-token-20261007',undefined,bridge,origin),legacyId=legacyLink.split('/').at(-1)!;owned.push({id:legacyId,token:'synthetic-legacy-owner-token-20261007'});expect((await createReviewClient(legacyId,'synthetic-legacy-owner-token-20261007',bridge).create({...draft,id:crypto.randomUUID(),postId:crypto.randomUUID(),anchor:{kind:'project',sceneId:null}})).items).toHaveLength(1);
 }finally{
  let ok=true;for(const entry of owned)try{await revokePublicShare(entry.id,entry.token,bridge);expect((await bridge(`/api/public/${entry.id}/comments`)).status).toBe(410);expect((await bridge('/api/public/'+entry.id)).status).toBe(410);}catch{ok=false;}
  report.revoked=owned.length===2&&ok;report.cleanupComplete=ok;await writeFile('/tmp/gonggan-review-native-20261007-result.json',JSON.stringify(report,null,2));expect(ok).toBe(true);
 }
},30000);
