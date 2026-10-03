import {afterEach,describe,expect,it} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handleProjectRequest,type ProjectDatabase,type ProjectStatement,type ProjectBucket,type ProjectEnv} from './projectApi';
import {authenticatedUser,type AuthFetch} from './auth';
import {parseAuthConfig} from '../domain/authConfig';
import {encodeCloudMetadata,CLOUD_PACKAGE_MAX_BYTES} from '../domain/cloudProject';
import {cloudPackageHash,createCloudProjectClient} from '../lib/cloudProjectClient';
import {exportProjectPackage,importProjectPackage} from '../lib/projectPackage';
import {createDemoProject} from '../domain/model';
import {testVenueModel} from '../lib/venueModelTestFixture';

const userA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',userB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',id='cccccccc-cccc-4ccc-8ccc-cccccccccccc',id2='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const publicConfig={SUPABASE_URL:'https://testing.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_only_public_test_key'};
const dbs:DatabaseSync[]=[];afterEach(()=>{for(const db of dbs.splice(0))db.close();});
const authFetch:AuthFetch=async(input,init)=>{const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;if(!url.startsWith(publicConfig.SUPABASE_URL+'/auth/v1/user'))throw new Error('Unexpected auth route');const token=new Headers(init?.headers).get('authorization');if(!['Bearer test-a','Bearer test-b','Bearer anonymous'].includes(token??''))return Response.json({message:'invalid JWT'},{status:401});return Response.json({id:token==='Bearer test-b'?userB:userA,email:token==='Bearer test-b'?'b@example.test':'a@example.test',role:'authenticated',aud:'authenticated',is_anonymous:token==='Bearer anonymous',created_at:'2026-10-04T00:00:00Z'});};
class SqliteAdapter implements ProjectDatabase{
 sql:DatabaseSync;throwAfterWrite=false;
 constructor(){this.sql=new DatabaseSync(':memory:');dbs.push(this.sql);this.sql.exec(readFileSync(new URL('../../migrations/0001_cloud_projects.sql',import.meta.url),'utf8'));}
 prepare(query:string):ProjectStatement{let values:unknown[]=[];const db=this;return {bind(...args){values=args;return this;},async first<T>(){return (db.sql.prepare(query).get(...values as Parameters<ReturnType<DatabaseSync['prepare']>['get']>)??null) as T|null;},async all<T>(){return {results:db.sql.prepare(query).all(...values as Parameters<ReturnType<DatabaseSync['prepare']>['all']>) as T[]};},async run(){const result=db.sql.prepare(query).run(...values as Parameters<ReturnType<DatabaseSync['prepare']>['run']>);if(db.throwAfterWrite){db.throwAfterWrite=false;throw new Error('Response lost after committed D1 write');}return {success:true,meta:{changes:Number(result.changes)}};}};}
}
class MemoryBucket implements ProjectBucket{
 files=new Map<string,Uint8Array<ArrayBuffer>>();beforePut?:()=>Promise<void>;
 async put(key:string,stream:ReadableStream,options:{sha256:string;httpMetadata:{contentType:string}}){const bytes=new Uint8Array(await new Response(stream).arrayBuffer());if(await cloudPackageHash(bytes.buffer)!==options.sha256)throw new Error('Checksum mismatch');await this.beforePut?.();this.files.set(key,bytes);return {size:bytes.length};}
 async get(key:string,options?:{range:{offset:number;length:number}}){const full=this.files.get(key);if(!full)return null;const b=options?full.slice(options.range.offset,options.range.offset+options.range.length):full;return {body:new Response(b).body!,size:full.length};}
 async delete(key:string){this.files.delete(key);}
}
function setup(){const db=new SqliteAdapter(),bucket=new MemoryBucket(),env:ProjectEnv={...publicConfig,PROJECTS_DB:db,PRIVATE_PROJECTS:bucket};return {db,bucket,env};}
const meta={name:'전시 · α',venue:'성수',sourceProjectId:'local-project'};
const zip=new Blob([new Uint8Array([80,75,3,4,...Array(26).fill(0)])]);
async function putRequest(file=zip,revision=0,token='test-a',projectId=id){return new Request('https://app.example/api/projects/'+projectId,{method:'PUT',headers:{authorization:'Bearer '+token,'content-type':'application/zip','content-length':String(file.size),'x-expected-revision':String(revision),'x-project-sha256':await cloudPackageHash(await file.arrayBuffer()),'x-project-metadata':encodeCloudMetadata(meta)},body:file});}
const getRequest=(path:string,token='test-a')=>new Request('https://app.example'+path,{headers:{authorization:'Bearer '+token}});
const patchRequest=(archived:boolean,revision:number,token='test-a',projectId=id)=>{const body=JSON.stringify({archived,expectedRevision:revision});return new Request('https://app.example/api/projects/'+projectId,{method:'PATCH',headers:{authorization:'Bearer '+token,'content-type':'application/json','content-length':String(new TextEncoder().encode(body).length)},body});};
function bridge(env:ProjectEnv,token?:string){return async(path:string,init:RequestInit={})=>{const headers=new Headers(init.headers);if(token)headers.set('authorization','Bearer '+token);if(init.body instanceof Blob)headers.set('content-length',String(init.body.size));else if(typeof init.body==='string')headers.set('content-length',String(new TextEncoder().encode(init.body).length));return handleProjectRequest(new Request('https://app.example'+path,{...init,headers}),env,authFetch);};}

describe('standard authentication and private project storage',()=>{
 it('only exposes hosted URL and public anon/publishable keys, with disabled auth before configuration',async()=>{
  const jwt=(role:string)=>'header.'+btoa(JSON.stringify({role}))+'.signature';expect(parseAuthConfig(publicConfig.SUPABASE_URL,jwt('anon'))).toBeDefined();
  for(const key of ['sb_secret_private',jwt('service_role'),'invalid'])expect(parseAuthConfig(publicConfig.SUPABASE_URL,key)).toBeUndefined();
  expect(parseAuthConfig('http://testing.supabase.co',publicConfig.SUPABASE_PUBLISHABLE_KEY)).toBeUndefined();expect(parseAuthConfig('https://testing.supabase.co.evil.example',publicConfig.SUPABASE_PUBLISHABLE_KEY)).toBeUndefined();
  expect(await (await handleProjectRequest(getRequest('/api/auth/config'),{})).json()).toEqual({enabled:false});
  const response=await handleProjectRequest(getRequest('/api/auth/config'),{...publicConfig,SUPABASE_PUBLISHABLE_KEY:jwt('service_role')});expect(JSON.stringify(await response.json())).not.toContain('signature');
  expect((await handleProjectRequest(getRequest('/api/projects'),{})).status).toBe(503);
 });
 it('uses provider getUser, rejects missing, invalid or anonymous tokens and foreign origins',async()=>{
  const {env,bucket}=setup();expect(await authenticatedUser(getRequest('/api/auth/me'),env,authFetch)).toEqual({id:userA,email:'a@example.test'});
  for(const token of ['forged-jwt','anonymous'])expect((await handleProjectRequest(getRequest('/api/projects',token),env,authFetch)).status).toBe(401);
  expect((await handleProjectRequest(new Request('https://app.example/api/projects'),env,authFetch)).status).toBe(401);
  const request=await putRequest();request.headers.set('origin','https://other.example');expect((await handleProjectRequest(request,env,authFetch)).status).toBe(403);expect(bucket.files.size).toBe(0);
 });
 it('isolates every list, metadata, download, update and archive route by provider user ID',async()=>{
  const {env,bucket}=setup();expect((await handleProjectRequest(await putRequest(),env,authFetch)).status).toBe(201);const before=[...bucket.files.keys()];
  expect(await (await handleProjectRequest(getRequest('/api/projects','test-b'),env,authFetch)).json()).toEqual({items:[],truncated:false});
  for(const suffix of ['', '/meta'])expect((await handleProjectRequest(getRequest('/api/projects/'+id+suffix,'test-b'),env,authFetch)).status).toBe(404);
  expect((await handleProjectRequest(patchRequest(true,1,'test-b'),env,authFetch)).status).toBe(404);
  expect((await handleProjectRequest(await putRequest(zip,1,'test-b'),env,authFetch)).status).toBe(404);
  // A colliding new ID is not an opportunity to replace another account's bytes.
  expect((await handleProjectRequest(await putRequest(zip,0,'test-b'),env,authFetch)).status).toBe(404);expect([...bucket.files.keys()]).toEqual(before);
  expect((await handleProjectRequest(await putRequest(zip,0,'test-b',id2),env,authFetch)).status).toBe(201);
  expect((await (await handleProjectRequest(getRequest('/api/projects'),env,authFetch)).json()).items).toHaveLength(1);
 });
 it('makes exact retries idempotent and refuses stale overwrite before storing an upload',async()=>{
  const {env,bucket}=setup();const first=await handleProjectRequest(await putRequest(),env,authFetch);const saved=await first.json();expect(saved.revision).toBe(1);
  expect((await handleProjectRequest(await putRequest(),env,authFetch)).status).toBe(200);expect(bucket.files.size).toBe(1);
  const changed=new Blob([await zip.arrayBuffer(),'different']);expect((await handleProjectRequest(await putRequest(changed,1),env,authFetch)).status).toBe(200);
  const count=bucket.files.size;expect((await handleProjectRequest(await putRequest(zip,1),env,authFetch)).status).toBe(409);expect(bucket.files.size).toBe(count);
  const current=await handleProjectRequest(getRequest('/api/projects/'+id),env,authFetch);expect(await current.arrayBuffer()).toEqual(await changed.arrayBuffer());expect(current.headers.get('cache-control')).toBe('no-store');
 });
 it('uses real SQL compare-and-swap when concurrent uploads race',async()=>{
  const {env,bucket}=setup();await handleProjectRequest(await putRequest(),env,authFetch);let waiting=0,release!:()=>void;const barrier=new Promise<void>(resolve=>{release=resolve;});bucket.beforePut=async()=>{if(++waiting===2)release();await barrier;};
  const a=await putRequest(new Blob([await zip.arrayBuffer(),'A']),1),b=await putRequest(new Blob([await zip.arrayBuffer(),'B']),1);
  const results=await Promise.all([handleProjectRequest(a,env,authFetch),handleProjectRequest(b,env,authFetch)]);expect(results.map(r=>r.status).sort()).toEqual([200,409]);
  expect((await (await handleProjectRequest(getRequest('/api/projects/'+id+'/meta'),env,authFetch)).json()).revision).toBe(2);
  // The losing unreferenced object is removed; the successful object remains accessible.
  expect((await handleProjectRequest(getRequest('/api/projects/'+id),env,authFetch)).status).toBe(200);expect(bucket.files.size).toBe(1);
 });
 it('archives with revision checks and blocks saves until restored',async()=>{
  const {env}=setup();await handleProjectRequest(await putRequest(),env,authFetch);expect((await handleProjectRequest(patchRequest(true,1),env,authFetch)).status).toBe(200);expect((await handleProjectRequest(await putRequest(zip,2),env,authFetch)).status).toBe(409);expect((await handleProjectRequest(patchRequest(false,1),env,authFetch)).status).toBe(409);expect((await handleProjectRequest(patchRequest(false,2),env,authFetch)).status).toBe(200);
 });
 it('does not publish damaged, mismatched-length or oversized uploads',async()=>{
  const {env,bucket}=setup();const wrong=await putRequest();wrong.headers.set('x-project-sha256','0'.repeat(64));expect((await handleProjectRequest(wrong,env,authFetch)).status).toBe(503);
  const badZip=new Blob(['This is not a ZIP archive file']);expect((await handleProjectRequest(await putRequest(badZip),env,authFetch)).status).toBe(400);
  const mismatch=await putRequest();mismatch.headers.set('content-length',String(zip.size+1));expect((await handleProjectRequest(mismatch,env,authFetch)).status).toBe(503);
  const huge=await putRequest();huge.headers.set('content-length',String(CLOUD_PACKAGE_MAX_BYTES+1));expect((await handleProjectRequest(huge,env,authFetch)).status).toBe(413);
  const noLength=await putRequest();noLength.headers.delete('content-length');expect((await handleProjectRequest(noLength,env,authFetch)).status).toBe(411);
  expect(bucket.files.size).toBe(0);expect((await (await handleProjectRequest(getRequest('/api/projects'),env,authFetch)).json()).items).toEqual([]);
 });
 it('keeps a possibly committed snapshot on D1 error and reconciles through authenticated metadata',async()=>{
  const {env,db,bucket}=setup();db.throwAfterWrite=true;const client=createCloudProjectClient('test-a',bridge(env));const saved=await client.save(id,0,zip,meta);expect(saved.revision).toBe(1);expect(bucket.files.size).toBe(1);expect((await client.read(id)).bytes).toEqual(await zip.arrayBuffer());
 });
 it('reconciles a lost network response, checks returned bytes and detects altered download data',async()=>{
  const {env,bucket}=setup();const fetcher=bridge(env);let lose=true;const client=createCloudProjectClient('test-a',async(path,init)=>{const response=await fetcher(path,init);if(init?.method==='PUT'&&lose){lose=false;throw new Error('Network response lost');}return response;});expect((await client.save(id,0,zip,meta)).revision).toBe(1);
  const [key,bytes]=[...bucket.files][0];bucket.files.set(key,new Uint8Array([...bytes.slice(0,-1),1]));await expect(client.read(id)).rejects.toThrow('해시');
 });
 it('round trips a real complete project package including private notes, photos, 3D assets and Scenes',async()=>{
  const {env}=setup(),png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=';
  const p=createDemoProject();p.artworks=p.artworks.slice(0,1).map(a=>({...a,imageUrl:png}));p.referenceModel=testVenueModel();p.note='비공개 설치 메모';p.noteDetails={checklist:[{id:'check',text:'반입',done:true}],images:[{id:'photo',name:'설치.png',imageUrl:png}]};p.scenes=[{id:'old',name:'이전 배치',artworks:structuredClone(p.artworks),wallVisibility:{}}];
  const file=await exportProjectPackage(p,async()=>png),client=createCloudProjectClient('test-a',bridge(env));await client.save(id,0,file,{name:p.name,venue:p.venue,sourceProjectId:p.id});const download=await client.read(id);expect(await importProjectPackage(download.bytes)).toEqual(p);
  expect(download.summary.sha256).toBe(await cloudPackageHash(await file.arrayBuffer()));await expect(createCloudProjectClient('test-b',bridge(env)).read(id)).rejects.toMatchObject({status:404});
 });
});
