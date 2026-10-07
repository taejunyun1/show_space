import {afterEach,expect,it} from 'vitest';
import {collaborationFixture,collaborationUsers} from './collaborationApi.fixture';
import {inviteTokenHash} from '../domain/collaboration';
const open:Array<ReturnType<typeof collaborationFixture>>=[];afterEach(()=>{for(const f of open.splice(0))f.close();});
async function setup(){const f=collaborationFixture();open.push(f);expect((await f.save()).status).toBe(201);return f;}
it('binds a one-use invitation to verified provider email, stores only its hash and never exposes the secret in lists',async()=>{
 const f=await setup(),inv=await f.invite();for(const token of ['c','b-unverified'])expect((await f.accept(inv,token)).status).toBe(token==='c'?404:401);
 expect((await f.accept({...inv,token:'0'.repeat(48)})).status).toBe(404);expect((await f.accept(inv,'b','preview')).status).toBe(200);expect((await f.call('GET','/api/projects/'+f.id+'/meta','b')).status).toBe(404);
 const raw=f.sql.prepare('SELECT * FROM project_invites WHERE id = ?').get(inv.id);expect(raw).toMatchObject({token_hash:await inviteTokenHash(inv.token),status:'pending'});expect(JSON.stringify(raw)).not.toContain(inv.token);
 expect((await f.accept(inv)).status).toBe(200);expect((await f.accept(inv)).status).toBe(200);expect(JSON.stringify(await(await f.call('GET',`/api/projects/${f.id}/invitations`)).json())).not.toMatch(/token_hash|accepted_by|1{24}/);
});
it('grants editor read and CAS write without changing owner, and prohibits member archive, history and administration',async()=>{
 const f=await setup();await f.accept(await f.invite());const meta=await(await f.call('GET','/api/projects/'+f.id+'/meta','b')).json();expect(meta.role).toBe('editor');expect((await(await f.call('GET','/api/projects/shared','b')).json()).items[0].role).toBe('editor');expect((await(await f.call('GET','/api/projects','b')).json()).items).toEqual([]);
 for(const path of ['members','invitations'])expect((await f.call('GET',`/api/projects/${f.id}/${path}`,'b')).status).toBe(403);
 expect((await f.call('PATCH','/api/projects/'+f.id,'b',{archived:true,expectedRevision:1})).status).toBe(403);expect((await f.call('GET',`/api/projects/${f.id}/history`,'b')).status).toBe(404);
 expect((await f.save('b',1,new Blob([f.zip,'edit']))).status).toBe(200);expect(f.sql.prepare('SELECT owner_id,revision FROM cloud_projects').get()).toMatchObject({owner_id:collaborationUsers.a,revision:2});expect([...f.files.keys()][0]).toContain('users/'+collaborationUsers.a+'/');expect((await f.save('a',1,new Blob([f.zip,'stale']))).status).toBe(409);
});
it('allows viewer and commenter reads while blocking layout writes, including exact retries',async()=>{
 const f=await setup();await f.accept(await f.invite('viewer'));expect((await f.call('GET','/api/projects/'+f.id,'b')).status).toBe(200);expect((await f.save('b',0)).status).toBe(403);expect((await f.save('b',1)).status).toBe(403);await f.member('commenter');expect((await f.save('b',1)).status).toBe(403);expect(f.files.size).toBe(1);
});
it('atomically consumes concurrent accept retries and reconciles a lost batch response without duplicate members',async()=>{
 const f=await setup(),inv=await f.invite();f.state.lostBatch=true;expect((await f.accept(inv)).status).toBe(503);const results=await Promise.all([f.accept(inv),f.accept(inv)]);expect(results.map(r=>r.status)).toEqual([200,200]);expect(f.sql.prepare('SELECT COUNT(*) AS n FROM project_members').get()).toMatchObject({n:1});expect(f.sql.prepare('SELECT revision,status FROM project_invites').get()).toMatchObject({revision:2,status:'accepted'});
});
it('does not re-grant a revoked member through an accepted token; a fresh invitation can rejoin with a newer membership revision',async()=>{
 const f=await setup(),inv=await f.invite();await f.accept(inv);expect((await f.member('editor',true)).status).toBe(200);expect((await f.accept(inv)).status).toBe(410);expect((await f.call('GET','/api/projects/'+f.id,'b')).status).toBe(404);expect((await f.member('viewer',false,2)).status).toBe(409);await f.accept(await f.invite('viewer'));expect(f.sql.prepare('SELECT revision,role,revoked FROM project_members').get()).toMatchObject({revision:3,role:'viewer',revoked:0});expect((await f.accept(inv)).status).toBe(200);expect((await(await f.accept(inv)).json()).role).toBe('viewer');
});
it('cancels pending invites, detects expiry and never accepts into an archived project',async()=>{
 const f=await setup(),inv=await f.invite();expect((await f.call('PATCH',`/api/projects/${f.id}/invitations/${inv.id}`,'a',{expectedRevision:1,revoked:true})).status).toBe(200);expect((await f.accept(inv)).status).toBe(410);
 const expired=await f.invite();f.sql.prepare('UPDATE project_invites SET expires_at = ? WHERE id = ?').run('2000-01-01T00:00:00Z',expired.id);expect((await f.accept(expired)).status).toBe(410);
 const next=await f.invite();await f.call('PATCH','/api/projects/'+f.id,'a',{archived:true,expectedRevision:1});expect((await f.accept(next)).status).toBe(409);
});
it('rejects invalid roles/body, self invitation, foreign origin and stale member changes',async()=>{
 const f=await setup();for(const role of ['owner','admin',null])expect((await f.call('POST',`/api/projects/${f.id}/invitations`,'a',{id:crypto.randomUUID(),email:'b@example.test',role,token:'0'.repeat(48)})).status).toBe(400);
 expect((await f.call('POST',`/api/projects/${f.id}/invitations`,'a',{id:crypto.randomUUID(),email:'A@example.test',role:'editor',token:'0'.repeat(48)})).status).toBe(409);await f.accept(await f.invite());expect((await f.member('viewer')).status).toBe(200);expect((await f.member('editor')).status).toBe(409);
 expect((await f.bridge(`/api/projects/${f.id}/members`,{headers:{authorization:'Bearer a',origin:'https://evil.test'}})).status).toBe(403);
});
it('prevents editor privilege revocation during upload from publishing uploaded bytes',async()=>{
 const f=await setup();await f.accept(await f.invite());f.state.beforePut=async()=>{f.state.beforePut=undefined;expect((await f.member('viewer')).status).toBe(200);};expect((await f.save('b',1,new Blob([f.zip,'must not commit']))).status).toBe(409);expect(f.sql.prepare('SELECT revision FROM cloud_projects').get()).toMatchObject({revision:1});expect(f.files.size).toBe(1);
});
it('keeps private opinions out of Notes/public links and gives viewer no comment mutations while commenter cannot edit layout',async()=>{
 const f=await setup();await f.accept(await f.invite('commenter'));const path=`/api/projects/${f.id}/comments`,draft={id:crypto.randomUUID(),postId:crypto.randomUUID(),name:'협업자',text:'비공개 의견',anchor:{kind:'project',sceneId:null,label:'forged'}};
 expect((await f.call('GET',path,'c')).status).toBe(404);expect((await f.call('POST',path,'b',draft)).status).toBe(201);expect((await(await f.call('GET',path,'b')).json()).items[0].anchor.label).toBe(f.meta.name);expect((await f.save('b',1)).status).toBe(403);await f.member('viewer');expect((await(await f.call('GET',path,'b')).json()).canComment).toBe(false);expect((await f.call('PATCH',path+'/'+draft.id,'b',{expectedRevision:1,action:'deleteThread'})).status).toBe(403);
 expect(f.sql.prepare('SELECT share_id FROM review_threads').get()).toMatchObject({share_id:'project:'+f.id});expect((await f.call('PATCH',path+'/'+draft.id,'a',{expectedRevision:1,action:'resolve',resolved:true})).status).toBe(200);expect(f.sql.prepare('SELECT revision FROM cloud_projects').get()).toMatchObject({revision:1});
});
it('checks membership at the SQL comment commit after a role change and restricts private anchors to the project',async()=>{
 const f=await setup();await f.accept(await f.invite('commenter'));const path=`/api/projects/${f.id}/comments`,draft={id:crypto.randomUUID(),postId:crypto.randomUUID(),name:'참여자',text:'검토',anchor:{kind:'project',sceneId:null}};
 expect((await f.call('POST',path,'b',{...draft,anchor:{kind:'point',sceneId:null,point:{x:0,y:0,z:0}}})).status).toBe(400);
 f.state.beforeRun=query=>{if(query.startsWith('INSERT INTO review_threads')){f.state.beforeRun=undefined;f.sql.prepare('UPDATE project_members SET role = ?, revision = revision + 1').run('viewer');}};expect((await f.call('POST',path,'b',draft)).status).toBe(403);expect(f.sql.prepare('SELECT COUNT(*) AS n FROM review_threads').get()).toMatchObject({n:0});
 f.sql.prepare('UPDATE project_members SET role = ?').run('commenter');f.state.beforeRun=query=>{if(query.startsWith('INSERT INTO review_threads')){f.state.beforeRun=undefined;f.sql.exec('UPDATE project_members SET revision = revision + 1');}};expect((await f.call('POST',path,'b',draft)).status).toBe(409);
});
it('rolls back the member grant if consuming the invitation fails within the same transaction',async()=>{
 const f=await setup(),inv=await f.invite();f.state.beforeRun=q=>{if(q.startsWith('UPDATE project_invites SET status')){f.state.beforeRun=undefined;throw new Error('synthetic consume failure');}};expect((await f.accept(inv)).status).toBe(503);expect(f.sql.prepare('SELECT COUNT(*) AS n FROM project_members').get()).toMatchObject({n:0});expect(f.sql.prepare('SELECT status FROM project_invites').get()).toMatchObject({status:'pending'});expect((await f.accept(inv)).status).toBe(200);
});
it('enforces active member and pending invitation quotas at commit without consuming ungranted invitations',async()=>{
 const f=await setup();const now=new Date().toISOString(),pending=await f.invite();for(let i=0;i<20;i++)f.sql.prepare('INSERT INTO project_members VALUES (?, ?, ?, ?, 1, 0, ?, ?, ?)').run(f.id,crypto.randomUUID(),`other${i}@example.test`,'viewer',crypto.randomUUID(),now,now);expect((await f.accept(pending)).status).toBe(409);expect(f.sql.prepare('SELECT status FROM project_invites WHERE id = ?').get(pending.id)).toMatchObject({status:'pending'});
 f.sql.exec('DELETE FROM project_members');for(let i=0;i<19;i++)await f.invite('viewer','c');expect((await f.call('POST',`/api/projects/${f.id}/invitations`,'a',{id:crypto.randomUUID(),email:'d@example.test',role:'viewer',token:'f'.repeat(48)})).status).toBe(409);
});
it('bounds actual invite stream bytes and preserves identical create retries without reissuing secrets',async()=>{
 const f=await setup(),inv=await f.invite();expect((await f.call('POST',`/api/projects/${f.id}/invitations`,'a',inv)).status).toBe(200);expect((await f.call('POST',`/api/projects/${f.id}/invitations`,'a',{...inv,role:'viewer'})).status).toBe(409);
 let cancelled=false;const stream=new ReadableStream({pull(c){c.enqueue(new Uint8Array(3000));},cancel(){cancelled=true;}});expect((await f.bridge(`/api/projects/${f.id}/invitations`,{method:'POST',headers:{authorization:'Bearer a','content-length':'1'},body:stream,duplex:'half'} as RequestInit)).status).toBe(400);expect(cancelled).toBe(true);
});
