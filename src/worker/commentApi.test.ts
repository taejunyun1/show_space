import {afterEach,expect,it} from 'vitest';
import {commentFixture} from './commentApi.fixture';
import {handleShareRequest} from './shareApi';
import {parseReviewPage} from '../domain/reviewComments';
const open:Array<ReturnType<typeof commentFixture>>=[];afterEach(()=>{for(const f of open.splice(0))f.close();});
function setup(){const f=commentFixture();open.push(f);return f;}
const draft=(anchor:unknown={kind:'project',sceneId:null})=>({id:crypto.randomUUID(),postId:crypto.randomUUID(),name:'검토자',text:'외부 의견',anchor});
it('keeps existing view-only links disabled and strips body-only attempts to turn on comments',async()=>{
 const f=setup(),{id}=await f.publish(false);expect(await(await f.call('GET',`/api/public/${id}/comments`)).json()).toEqual({enabled:false});expect((await f.call('POST',`/api/public/${id}/comments`,'account-b',draft())).status).toBe(409);
 const next=(await(await f.call('POST','/api/shares','account-a')).json()).id,snapshot=(await(await f.call('GET','/api/public/'+id)).json());expect((await f.call('POST',`/api/shares/${next}/publish`,'account-a',{...snapshot,commentsEnabled:true})).status).toBe(201);expect((await(await f.call('GET','/api/public/'+next)).json()).commentsEnabled).toBeUndefined();
 const request=new Request(`https://example.test/api/shares/${next}/publish`,{method:'POST',headers:{authorization:'Bearer account-a','x-review-comments':'true'},body:JSON.stringify(snapshot)});f.sql.exec('DROP TABLE review_threads');const created=(await(await f.call('POST','/api/shares','account-a')).json()).id;
 expect((await handleShareRequest(new Request(request.url.replace(next,created),request),f.env,f.auth)).status).toBe(503);expect((await f.call('GET','/api/public/'+created)).status).toBe(404);
});
it('lets an authenticated commenter write while anonymous viewers read, with no private account or Note leakage',async()=>{
 const f=setup(),{id}=await f.publish(),body=draft(),path=`/api/public/${id}/comments`;
 for(const token of [undefined,'invalid'])expect((await f.call('POST',path,token,body)).status).toBe(401);
 const created=await f.call('POST',path,'account-b',body);expect(created.status).toBe(201);const b=parseReviewPage(await created.json());expect(b.items[0].canManage).toBe(true);expect(b.items[0].posts[0].mine).toBe(true);
 const publicData=await(await f.call('GET',path)).json(),a=parseReviewPage(await(await f.call('GET',path,'account-a')).json());expect(publicData.canComment).toBe(false);expect(publicData.items[0].posts[0].mine).toBe(false);expect(a.owner).toBe(true);expect(a.items[0].canManage).toBe(true);expect(a.items[0].posts[0].mine).toBe(false);expect(JSON.stringify(publicData)).not.toMatch(/11111111|22222222|authorId|email|NEVER PUBLIC/);
 const original=(await f.call('GET','/api/public/'+id));expect((await original.json()).commentsEnabled).toBe(true);
});
it('validates anchors against only the published Scene and visible objects',async()=>{
 const f=setup(),{id}=await f.publish(true,'account-a',true),path=`/api/public/${id}/comments`;
 const accepted=await f.call('POST',path,'account-b',draft({kind:'wall',sceneId:'scene-1',id:'wall-a',label:'forged'}));expect(accepted.status).toBe(201);expect((await accepted.json()).items[0].anchor).toMatchObject({label:'벽 A',sceneName:'B안'});
 for(const anchor of [{kind:'wall',sceneId:null,id:'hidden'},{kind:'artwork',sceneId:null,id:'unplaced'},{kind:'project',sceneId:'unpublished'},{kind:'point',sceneId:null,point:{x:Infinity,y:0,z:0}},{kind:'privateNote',sceneId:null}])expect((await f.call('POST',path,'account-b',draft(anchor))).status).toBe(400);
 const point=await f.call('POST',path,'account-b',draft({kind:'point',sceneId:null,point:{x:1200,y:1500,z:300}}));expect(point.status).toBe(201);expect((await point.json()).items[0].anchor.point).toEqual({x:1200,y:1500,z:300});
});
it('enforces author edits, owner moderation and resolution while preserving the frozen layout',async()=>{
 const f=setup(),{id}=await f.publish(),path=`/api/public/${id}/comments`,body=draft(),frozen=await(await f.call('GET','/api/public/'+id)).text();await f.call('POST',path,'account-b',body);
 const mutation=(token:string,v:unknown)=>f.call('PATCH',path+'/'+body.id,token,v);
 expect((await mutation('account-c',{expectedRevision:1,action:'resolve',resolved:true})).status).toBe(403);expect((await mutation('account-a',{expectedRevision:1,action:'edit',id:body.postId,text:'rewrite other author'})).status).toBe(403);
 expect((await mutation('account-b',{expectedRevision:1,action:'edit',id:body.postId,text:'수정 의견'})).status).toBe(200);expect((await mutation('account-a',{expectedRevision:2,action:'resolve',resolved:true})).status).toBe(200);
 expect((await mutation('account-c',{expectedRevision:3,action:'reply',id:crypto.randomUUID(),name:'답글',text:'재검토'})).status).toBe(409);expect((await mutation('account-b',{expectedRevision:3,action:'resolve',resolved:false})).status).toBe(200);
 expect((await mutation('account-a',{expectedRevision:4,action:'deletePost',id:body.postId})).status).toBe(200);const data=await(await f.call('GET',path)).json();expect(data.items[0].posts[0]).toMatchObject({name:'',text:'',deleted:true});expect(await(await f.call('GET','/api/public/'+id)).text()).toBe(frozen);
 expect((await mutation('account-b',{expectedRevision:5,action:'deleteThread'})).status).toBe(204);expect((await(await f.call('GET',path)).json()).items).toEqual([]);
});
it('rejects concurrent stale writes and safely retries lost create/reply responses without duplicates',async()=>{
 const f=setup(),{id}=await f.publish(),path=`/api/public/${id}/comments`,body=draft();f.state.throwAfterWrite=true;expect((await f.call('POST',path,'account-b',body)).status).toBe(503);expect((await f.call('POST',path,'account-b',body)).status).toBe(200);
 const reply={expectedRevision:1,action:'reply',id:crypto.randomUUID(),name:'협업자',text:'답글'},patch=()=>f.call('PATCH',path+'/'+body.id,'account-c',reply);f.state.throwAfterWrite=true;expect((await patch()).status).toBe(503);expect((await patch()).status).toBe(200);expect((await(await f.call('GET',path)).json()).items[0].posts).toHaveLength(2);
 const requests=await Promise.all(['one','two'].map(text=>f.call('PATCH',path+'/'+body.id,'account-b',{expectedRevision:2,action:'reply',id:crypto.randomUUID(),name:'검토자',text})));expect(requests.map(r=>r.status).sort()).toEqual([200,409]);expect((await(await f.call('GET',path)).json()).items[0].posts).toHaveLength(3);
 expect((await f.call('POST',path,'account-c',body)).status).toBe(409);
});
it('paginates without duplicates and keeps per-author quotas after deletion',async()=>{
 const f=setup(),{id}=await f.publish(),path=`/api/public/${id}/comments`;for(let i=0;i<20;i++)expect((await f.call('POST',path,'account-b',draft())).status).toBe(201);expect((await f.call('POST',path,'account-b',draft())).status).toBe(413);
 const first=await(await f.call('GET',path)).json(),second=await(await f.call('GET',path+'?before='+first.nextCursor)).json();expect(first.items).toHaveLength(10);expect(second.items).toHaveLength(10);expect(second.nextCursor).toBeNull();expect(new Set([...first.items,...second.items].map(t=>t.id)).size).toBe(20);
 expect((await f.call('PATCH',path+'/'+first.items[0].id,'account-b',{expectedRevision:1,action:'deleteThread'})).status).toBe(204);expect((await f.call('POST',path,'account-b',draft())).status).toBe(413);expect((await f.call('GET',path+'?before=not-a-cursor')).status).toBe(400);
});
it('blocks cross-origin writes, wrong legacy ownership and revoked/draft links',async()=>{
 const f=setup(),{id}=await f.publish(),path=`/api/public/${id}/comments`;expect((await f.call('POST',path,'account-b',draft(),{origin:'https://elsewhere.test'})).status).toBe(403);expect((await f.call('POST',path,f.legacy,draft())).status).toBe(403);
 const legacy=await f.publish(true,f.legacy);expect((await f.call('POST',`/api/public/${legacy.id}/comments`,f.legacy,draft())).status).toBe(201);
 expect((await f.call('DELETE','/api/shares/'+id,'account-a')).status).toBe(204);for(const method of ['GET','POST'])expect((await f.call(method,path,'account-b',method==='POST'?draft():undefined)).status).toBe(410);
 const pending=(await(await f.call('POST','/api/shares','account-a')).json()).id;expect((await f.call('GET',`/api/public/${pending}/comments`)).status).toBe(404);
});
it('bounds actual streaming bytes and rejects malformed text without storing records',async()=>{
 const f=setup(),{id}=await f.publish(),path=`/api/public/${id}/comments`;let cancelled=false,n=0;const stream=new ReadableStream({pull(c){n++;c.enqueue(new Uint8Array(9000));},cancel(){cancelled=true;}});
 const r=await f.bridge(path,{method:'POST',headers:{authorization:'Bearer account-b','content-length':'1'},body:stream,duplex:'half'} as RequestInit);expect(r.status).toBe(413);expect(cancelled).toBe(true);expect(n).toBeLessThan(5);
 for(const body of [{...draft(),text:'a'.repeat(2001)},{...draft(),name:' '},{...draft(),text:'bad\u0000text'}])expect((await f.call('POST',path,'account-b',body)).status).toBe(400);expect((await(await f.call('GET',path)).json()).items).toEqual([]);
});
it('stops stale reads and writes when revocation occurs during account verification',async()=>{
 const f=setup();for(const method of ['GET','POST']){const {id}=await f.publish();let unblock!:()=>void,started!:()=>void;const waiting=new Promise<void>(r=>{unblock=r;}),entered=new Promise<void>(r=>{started=r;}),auth:typeof f.auth=async(input,init)=>{started();await waiting;return f.auth(input,init);};
  const pending=handleShareRequest(new Request(`https://example.test/api/public/${id}/comments`,{method,headers:{authorization:'Bearer account-b'},...(method==='POST'?{body:JSON.stringify(draft())}:{})}),f.env,auth);await entered;await f.call('DELETE','/api/shares/'+id,'account-a');unblock();expect((await pending).status).toBe(410);
 }
});
it('caps a thread including deleted replies and erases comment content when deleting the whole opinion',async()=>{
 const f=setup(),{id}=await f.publish(),path=`/api/public/${id}/comments`,body=draft();await f.call('POST',path,'account-b',body);for(let revision=1;revision<20;revision++)expect((await f.call('PATCH',path+'/'+body.id,'account-b',{expectedRevision:revision,action:'reply',id:crypto.randomUUID(),name:'작성자',text:'지울 내용'})).status).toBe(200);
 expect((await f.call('PATCH',path+'/'+body.id,'account-b',{expectedRevision:20,action:'reply',id:crypto.randomUUID(),name:'작성자',text:'초과'})).status).toBe(413);expect((await f.call('PATCH',path+'/'+body.id,'account-b',{expectedRevision:20,action:'deleteThread'})).status).toBe(204);
 const row=f.sql.prepare('SELECT record_json FROM review_threads WHERE id = ?').get(body.id) as {record_json:string};expect(row.record_json).not.toMatch(/지울 내용|외부 의견|검토자/);
 await f.call('DELETE','/api/shares/'+id,'account-a');expect(f.sql.prepare('SELECT COUNT(*) AS count FROM review_threads WHERE share_id = ?').get(id)).toMatchObject({count:0});
});
