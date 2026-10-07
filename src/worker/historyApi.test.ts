import {afterEach,expect,it} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handleProjectRequest,type ProjectDatabase,type ProjectStatement,type ProjectBucket,type ProjectEnv} from './projectApi';
import type {AuthFetch} from './auth';
import {cloudPackageHash,createCloudProjectClient} from '../lib/cloudProjectClient';
import {createCloudHistoryClient} from '../lib/cloudHistoryClient';
import {readCloudHistoryProject,restoreCloudHistory,cloudHistoryChanges} from '../lib/cloudHistoryActions';
import {exportProjectPackage,importProjectPackage} from '../lib/projectPackage';
import {createDemoProject} from '../domain/model';
import {materialPreset} from '../domain/materials';
import {CLOUD_HISTORY_MAX_POINTS,CLOUD_HISTORY_MAX_BYTES} from '../domain/cloudHistory';
const ownerA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',ownerB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',projectId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const config={SUPABASE_URL:'https://testing.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_public_test'};
const dbs:DatabaseSync[]=[];afterEach(()=>dbs.splice(0).forEach(db=>db.close()));
class Sqlite implements ProjectDatabase {
 sql=new DatabaseSync(':memory:');throwAfterHistory=false;
 constructor(){dbs.push(this.sql);this.sql.exec('PRAGMA foreign_keys = ON');for(const file of ['0001_cloud_projects.sql','0002_cloud_history.sql'])this.sql.exec(readFileSync(new URL('../../migrations/'+file,import.meta.url),'utf8'));}
 prepare(query:string):ProjectStatement{let args:unknown[]=[];const self=this;return {bind(...v){args=v;return this;},async first<T>(){return (self.sql.prepare(query).get(...args as never[])??null) as T|null;},async all<T>(){return {results:self.sql.prepare(query).all(...args as never[]) as T[]};},async run(){const result=self.sql.prepare(query).run(...args as never[]);if(self.throwAfterHistory&&query.startsWith('INSERT INTO cloud_history')){self.throwAfterHistory=false;throw new Error('Committed response lost');}return {success:true,meta:{changes:Number(result.changes)}};}};}
}
class Bucket implements ProjectBucket {
 files=new Map<string,Uint8Array<ArrayBuffer>>();beforePut?:()=>Promise<void>;
 async put(key:string,body:ReadableStream,opts:{sha256:string;httpMetadata:{contentType:string}}){const b=new Uint8Array(await new Response(body).arrayBuffer());if(await cloudPackageHash(b.buffer)!==opts.sha256)throw new Error('checksum');await this.beforePut?.();this.files.set(key,b);return {size:b.length};}
 async get(key:string,opts?:{range:{offset:number;length:number}}){const b=this.files.get(key);if(!b)return null;const data=opts?b.slice(opts.range.offset,opts.range.offset+opts.range.length):b;return {body:new Response(data).body!,size:b.length};}
 async delete(key:string){this.files.delete(key);}
}
const authFetch:AuthFetch=async(_input,init)=>{const token=new Headers(init?.headers).get('authorization');if(!['Bearer test-a','Bearer test-b'].includes(token??''))return Response.json({error:'bad token'},{status:401});return Response.json({id:token==='Bearer test-b'?ownerB:ownerA,email:'test@example.test',role:'authenticated',aud:'authenticated',created_at:'2026-10-07T00:00:00Z'});};
function setup(){const db=new Sqlite(),bucket=new Bucket(),env:ProjectEnv={...config,PROJECTS_DB:db,PRIVATE_PROJECTS:bucket};const bridge=async(path:string,init:RequestInit={})=>{const headers=new Headers(init.headers);if(init.body instanceof Blob)headers.set('content-length',String(init.body.size));if(typeof init.body==='string')headers.set('content-length',String(new TextEncoder().encode(init.body).length));return handleProjectRequest(new Request('https://app.example'+path,{...init,headers}),env,authFetch);};return {db,bucket,env,bridge,projects:createCloudProjectClient('test-a',bridge),history:createCloudHistoryClient('test-a',bridge)};}
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=';
function fixture(){const p=createDemoProject();p.artworks=p.artworks.slice(0,1).map(a=>({...a,imageUrl:png,note:'비공개 작품 메모'}));p.note='비공개 프로젝트 메모';p.walls[0].material={...materialPreset('wood').material,normal:{imageUrl:png,widthMm:500,heightMm:250,strength:2}};p.scenes=[{id:'scene',name:'원래 Scene',artworks:structuredClone(p.artworks),wallVisibility:{}}];return p;}
async function seed(s:ReturnType<typeof setup>){const p=fixture(),file=await exportProjectPackage(p,async()=>png);await s.projects.save(projectId,0,file,{name:p.name,venue:p.venue,sourceProjectId:p.id});return {p,file};}
const verified=async()=>{}; // Node tests verify package hashes/schema, browser separately decodes/render images.
it('captures a complete immutable account version independently of latest project cleanup and other clients',async()=>{
 const s=setup(),{p,file}=await seed(s),point=await s.history.capture(projectId,crypto.randomUUID(),'설치 전',1);p.note='새 메모';p.walls[0].heightMm=4100;await s.projects.save(projectId,1,await exportProjectPackage(p,async()=>png),{name:p.name,venue:p.venue,sourceProjectId:p.id});
 const otherDevice=createCloudHistoryClient('test-a',s.bridge),version=await otherDevice.read(projectId,point.id);expect(version.bytes).toEqual(await file.arrayBuffer());expect((await readCloudHistoryProject(otherDevice,projectId,point.id,verified)).project.note).toBe('비공개 프로젝트 메모');expect((await otherDevice.list(projectId))[0].sourceRevision).toBe(1);expect(s.bucket.files.size).toBe(2);
});
it('isolates list, metadata, file, capture, archive and delete by authenticated parent owner',async()=>{
 const s=setup();await seed(s);const p=await s.history.capture(projectId,crypto.randomUUID(),'A',1),other=createCloudHistoryClient('test-b',s.bridge),before=[...s.bucket.files.keys()];
 for(const action of [()=>other.list(projectId),()=>other.metadata(projectId,p.id),()=>other.read(projectId,p.id),()=>other.capture(projectId,crypto.randomUUID(),'盗',1),()=>other.archive(projectId,p.id,1,true),()=>other.remove(projectId,p.id,1)])await expect(action()).rejects.toMatchObject({status:404});
 expect([...s.bucket.files.keys()]).toEqual(before);expect((await s.bridge('/api/projects/'+projectId+'/history')).status).toBe(401);
 expect((await s.bridge('/api/projects/'+projectId+'/history',{headers:{authorization:'Bearer test-a',origin:'https://evil.example'}})).status).toBe(403);
});
it('reconciles lost capture responses and rejects reuse of an ID for another version or label',async()=>{
 const s=setup();await seed(s);s.db.throwAfterHistory=true;const id=crypto.randomUUID(),p=await s.history.capture(projectId,id,'같은 요청',1);expect(p.sourceRevision).toBe(1);expect((await s.history.capture(projectId,id,'같은 요청',1)).id).toBe(id);expect(s.bucket.files.size).toBe(2);
 await expect(s.history.capture(projectId,id,'다른 이름',1)).rejects.toMatchObject({status:409});expect(await s.history.list(projectId)).toHaveLength(1);
 let lose=true;const client=createCloudHistoryClient('test-a',async(path,init)=>{const r=await s.bridge(path,init);if(init?.method==='POST'&&lose){lose=false;throw new Error('network');}return r;});expect((await client.capture(projectId,crypto.randomUUID(),'네트워크 유실',1)).label).toBe('네트워크 유실');expect(await s.history.list(projectId)).toHaveLength(2);
});
it('enforces per-project limit under concurrent SQL insertion without damaging existing versions',async()=>{
 const s=setup();await seed(s);await s.history.capture(projectId,crypto.randomUUID(),'원본',1);
 for(let i=1;i<CLOUD_HISTORY_MAX_POINTS-1;i++)s.db.sql.prepare('INSERT INTO cloud_history SELECT ?,project_id,owner_id,?,name,venue,source_project_id,source_revision,revision,?,snapshot_sha256,snapshot_bytes,created_at,updated_at,archived FROM cloud_history LIMIT 1').run(crypto.randomUUID(),'기존 '+i,'unused/'+i);
 let n=0,release!:()=>void;const barrier=new Promise<void>(r=>{release=r;});s.bucket.beforePut=async()=>{if(++n===2)release();await barrier;};
 const results=await Promise.allSettled(['A','B'].map(label=>s.history.capture(projectId,crypto.randomUUID(),label,1)));expect(results.filter(x=>x.status==='fulfilled')).toHaveLength(1);expect(await s.history.list(projectId)).toHaveLength(50);expect(s.bucket.files.size).toBe(3);
});
it('checks account byte limit at publication and keeps a safety failure from restoring over current',async()=>{
 const s=setup();const {p}=await seed(s),a=await s.history.capture(projectId,crypto.randomUUID(),'A',1);p.note='latest';await s.projects.save(projectId,1,await exportProjectPackage(p,async()=>png),{name:p.name,venue:p.venue,sourceProjectId:p.id});
 for(let i=0;i<14;i++)s.db.sql.prepare('INSERT INTO cloud_history SELECT ?,project_id,owner_id,?,name,venue,source_project_id,source_revision,revision,?,snapshot_sha256,83886080,created_at,updated_at,archived FROM cloud_history LIMIT 1').run(crypto.randomUUID(),'한도 '+i,'unused/'+i);
 expect(Number(s.db.sql.prepare('SELECT SUM(snapshot_bytes) AS n FROM cloud_history').get()!.n)).toBeGreaterThan(CLOUD_HISTORY_MAX_BYTES);
 await expect(restoreCloudHistory(s.projects,s.history,projectId,a.id,2,()=>{},verified)).rejects.toMatchObject({status:409});expect((await s.projects.metadata(projectId)).revision).toBe(2);expect((await importProjectPackage((await s.projects.read(projectId)).bytes)).note).toBe('latest');
});
it('archives and recovers with revision checks, then deletes only archived immutable bytes',async()=>{
 const s=setup();await seed(s);const p=await s.history.capture(projectId,crypto.randomUUID(),'삭제 확인',1);await expect(s.history.remove(projectId,p.id,1)).rejects.toMatchObject({status:409});const archived=await s.history.archive(projectId,p.id,1,true);expect(archived.revision).toBe(2);await expect(s.history.archive(projectId,p.id,1,false)).rejects.toMatchObject({status:409});await s.history.archive(projectId,p.id,2,false);await s.history.archive(projectId,p.id,3,true);await s.history.remove(projectId,p.id,4);await s.history.remove(projectId,p.id,4);expect(await s.history.list(projectId)).toEqual([]);expect(s.bucket.files.size).toBe(1);expect((await s.projects.read(projectId)).summary.revision).toBe(1);
});
it('does not capture a mixture when the parent is changed during copying to R2',async()=>{
 const s=setup();const {p}=await seed(s);let once=true;s.bucket.beforePut=async()=>{if(!once)return;once=false;p.note='다른 기기 변경';await s.projects.save(projectId,1,await exportProjectPackage(p,async()=>png),{name:p.name,venue:p.venue,sourceProjectId:p.id});};await expect(s.history.capture(projectId,crypto.randomUUID(),'경합',1)).rejects.toMatchObject({status:409});expect(await s.history.list(projectId)).toEqual([]);expect(s.bucket.files.size).toBe(1);expect((await s.projects.metadata(projectId)).revision).toBe(2);
});
it('restores all fields and records previous cloud state before CAS replacement',async()=>{
 const s=setup(),{p,file}=await seed(s),a=await s.history.capture(projectId,crypto.randomUUID(),'A',1);p.note='B';p.artworks[0].widthMm=1300;p.walls[0].material!.normal!.strength=0;p.scenes[0].name='B Scene';const b=await exportProjectPackage(p,async()=>png);await s.projects.save(projectId,1,b,{name:p.name,venue:p.venue,sourceProjectId:p.id});
 const restored=await restoreCloudHistory(s.projects,s.history,projectId,a.id,2,()=>{},verified);expect(restored.summary.revision).toBe(3);expect((await s.projects.read(projectId)).bytes).toEqual(await file.arrayBuffer());expect((await s.history.read(projectId,restored.safety.id)).bytes).toEqual(await b.arrayBuffer());expect(await s.history.list(projectId)).toHaveLength(2);
});
it('preserves a concurrent newer edit after safety capture rather than forcing restoration',async()=>{
 const s=setup(),{p}=await seed(s),a=await s.history.capture(projectId,crypto.randomUUID(),'A',1);p.note='B';await s.projects.save(projectId,1,await exportProjectPackage(p,async()=>png),{name:p.name,venue:p.venue,sourceProjectId:p.id});
 const race={...s.history,capture:async(...args:Parameters<typeof s.history.capture>)=>{const safety=await s.history.capture(...args);p.note='C concurrent';await s.projects.save(projectId,2,await exportProjectPackage(p,async()=>png),{name:p.name,venue:p.venue,sourceProjectId:p.id});return safety;}};
 await expect(restoreCloudHistory(s.projects,race,projectId,a.id,2,()=>{},verified)).rejects.toMatchObject({status:409});expect((await importProjectPackage((await s.projects.read(projectId)).bytes)).note).toBe('C concurrent');expect(await s.history.list(projectId)).toHaveLength(2);
});
it('rejects corrupt bytes or failed image verification before any safety capture or replacement',async()=>{
 const s=setup();await seed(s);const a=await s.history.capture(projectId,crypto.randomUUID(),'A',1);await expect(restoreCloudHistory(s.projects,s.history,projectId,a.id,1,()=>{},async()=>{throw new Error('image decode');})).rejects.toThrow('image decode');
 const key=String(s.db.sql.prepare('SELECT snapshot_key FROM cloud_history WHERE id = ?').get(a.id)!.snapshot_key),data=s.bucket.files.get(key)!;data[20]^=1;await expect(restoreCloudHistory(s.projects,s.history,projectId,a.id,1,()=>{},verified)).rejects.toThrow('해시');expect(await s.history.list(projectId)).toHaveLength(1);expect((await s.projects.metadata(projectId)).revision).toBe(1);
});
it('refuses malformed, unsupported and archived-parent capture requests without writes',async()=>{
 const s=setup();await seed(s);const route='/api/projects/'+projectId+'/history',send=(value:unknown)=>s.bridge(route,{method:'POST',headers:{authorization:'Bearer test-a','content-type':'application/json'},body:JSON.stringify(value)});
 for(const raw of [{id:crypto.randomUUID(),label:'',expectedRevision:1},{id:'bad',label:'正常',expectedRevision:1},{id:crypto.randomUUID(),label:'x'.repeat(201),expectedRevision:1},{id:crypto.randomUUID(),label:'正常',expectedRevision:0}])expect((await send(raw)).status).toBe(400);
 await s.projects.archive(projectId,1,true);await expect(s.history.capture(projectId,crypto.randomUUID(),'보관 상태',2)).rejects.toMatchObject({status:409});expect(await s.history.list(projectId)).toEqual([]);expect(s.bucket.files.size).toBe(1);
});

it('compares cloud lineage without treating a new device local ID as a content change',()=>{const a=fixture(),b=structuredClone(a);b.id=crypto.randomUUID();expect(cloudHistoryChanges(a,b)).toEqual([]);b.walls[0].heightMm+=100;expect(cloudHistoryChanges(a,b)).toEqual(['벽']);});
it('enforces account point limit without applying another account records to the quota',async()=>{
 const s=setup(),{p,file}=await seed(s);await s.history.capture(projectId,crypto.randomUUID(),'기존',1);
 const otherParent=crypto.randomUUID();s.db.sql.prepare('INSERT INTO cloud_projects SELECT ?, owner_id,name,venue,source_project_id,revision,?,snapshot_sha256,snapshot_bytes,created_at,updated_at,archived FROM cloud_projects LIMIT 1').run(otherParent,'unused/other-project');
 for(let i=1;i<500;i++)s.db.sql.prepare('INSERT INTO cloud_history SELECT ?, ?,owner_id,?,name,venue,source_project_id,source_revision,revision,?,snapshot_sha256,snapshot_bytes,created_at,updated_at,archived FROM cloud_history LIMIT 1').run(crypto.randomUUID(),otherParent,'既存 '+i,'unused/account/'+i);
 await expect(s.history.capture(projectId,crypto.randomUUID(),'초과',1)).rejects.toMatchObject({status:409});expect(await s.history.list(projectId)).toHaveLength(1);
 const bProject=crypto.randomUUID(),bClient=createCloudProjectClient('test-b',s.bridge),bHistory=createCloudHistoryClient('test-b',s.bridge);await bClient.save(bProject,0,file,{name:p.name,venue:p.venue,sourceProjectId:p.id});expect((await bHistory.capture(bProject,crypto.randomUUID(),'B 독립 한도',1)).label).toBe('B 독립 한도');
});
it('stops restore on an account/cancel guard before publishing any safety record',async()=>{
 const s=setup();await seed(s);const a=await s.history.capture(projectId,crypto.randomUUID(),'A',1);await expect(restoreCloudHistory(s.projects,s.history,projectId,a.id,1,()=>{throw new Error('account changed');},verified)).rejects.toThrow('account changed');expect(await s.history.list(projectId)).toHaveLength(1);expect((await s.projects.metadata(projectId)).revision).toBe(1);
});
