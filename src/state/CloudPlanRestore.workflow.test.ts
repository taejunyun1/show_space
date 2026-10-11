import {afterEach,expect,it,vi} from 'vitest';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadImage} from '@napi-rs/canvas';
import {IDBFactory} from 'fake-indexeddb';
import {useAuth,cloudSession} from './auth';
import {syncCloudProject,useCloudSync} from './cloudSync';
import {useEditor,startAutosave,captureAutosaveFlush} from './editor';
import * as libraries from '../lib/projectLibrary';
import {saveNewLocalProject} from '../lib/persistence';
import {importProjectPackage} from '../lib/projectPackage';
import {exportProjectBackup} from '../lib/projectBackup';
import {createCloudProjectClient} from '../lib/cloudProjectClient';
import {commentFixture} from '../worker/commentApi.fixture';
import {handleProjectRequest,type ProjectBucket} from '../worker/projectApi';
vi.mock('./auth',async original=>({...await original<typeof import('./auth')>(),cloudSession:vi.fn()}));
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
let service:ReturnType<typeof commentFixture>|undefined,stop=()=>{};const jobs:Promise<unknown>[]=[],releases:Array<()=>void>=[];
afterEach(async()=>{for(const release of releases.splice(0))release();useAuth.setState({status:'signedOut',user:null});await Promise.allSettled(jobs.splice(0));const finish=captureAutosaveFlush();stop();stop=()=>{};await finish().catch(()=>{});service?.close();service=undefined;vi.restoreAllMocks();vi.unstubAllGlobals();});
function gate<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>resolve=r);return {promise,resolve};}
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
it('retains the original account’s exact two-plan upload through delayed Worker acknowledgement, Scene restoration and account switch, then retries idempotently and sends the latest restored Scene',async()=>{
 class NativeImage{naturalWidth=0;naturalHeight=0;onload:(()=>void)|null=null;onerror:(()=>void)|null=null;set src(url:string){if(!url)return;void loadImage(url).then(image=>{this.naturalWidth=image.width;this.naturalHeight=image.height;this.onload?.();},()=>this.onerror?.());}}vi.stubGlobal('Image',NativeImage);
 const inputBytes=new Uint8Array(await readFile('docs/validation/local-plan-restore-2026-10-11/project.gonggan.zip')),input=await importProjectPackage(inputBytes.slice().buffer),p={...input,id:crypto.randomUUID(),name:'클라우드 도면 전시'};
 const repo=libraries.createProjectLibrary(new IDBFactory(),'cloud-plan-'+crypto.randomUUID());vi.spyOn(libraries,'projectLibrary').mockReturnValue(repo);await saveNewLocalProject(p);useEditor.getState().loadProject(p,true);stop=startAutosave(undefined,60000);useAuth.setState({status:'signedIn',user:{id:A,email:'a@example.test'},error:''});useCloudSync.setState({current:null});
 vi.mocked(cloudSession).mockImplementation(async()=>({userId:useAuth.getState().user!.id,token:useAuth.getState().user!.id===A?'account-a':'account-b'}));
 service=commentFixture();for(const migration of ['0001_cloud_projects.sql','0005_project_collaboration.sql'])service.sql.exec(await readFile('migrations/'+migration,'utf8'));
 const files:ProjectBucket={async put(key,stream,options){const bytes=new Uint8Array(await new Response(stream).arrayBuffer());expect(hash(bytes)).toBe(options.sha256);service!.bucket.data.set(key,bytes);return {size:bytes.length};},async get(key,options){const source=service!.bucket.data.get(key);if(!source)return null;const bytes=options?source.slice(options.range.offset,options.range.offset+options.range.length):source;return {size:bytes.length,body:new Blob([bytes.slice().buffer]).stream()};},async delete(key){service!.bucket.data.delete(key);}};
 const env={...service.env,PRIVATE_PROJECTS:files},entered=gate<void>(),ack=gate<void>();releases.push(()=>ack.resolve());let delay=true;
 const calls:Array<{method:string;path:string;account:string;expectedRevision:string|null;status:number;sha256:string|null}>=[];
 vi.stubGlobal('fetch',vi.fn(async(path:string,init:RequestInit={})=>{const headers=new Headers(init.headers);if(init.body instanceof Blob)headers.set('content-length',String(init.body.size));const response=await handleProjectRequest(new Request('https://example.test'+path,{...init,headers}),env,service!.auth);calls.push({method:init.method??'GET',path,account:headers.get('authorization')!,expectedRevision:headers.get('x-expected-revision'),status:response.status,sha256:headers.get('x-project-sha256')});
  // The server has committed. This adapter intentionally returns the delayed
  // response even after abort, so acknowledgement guards must still hold.
  if(delay&&init.method==='PUT'){delay=false;entered.resolve();await ack.promise;}return response;}));
 const file=await exportProjectBackup(p),originalBytes=new Uint8Array(await file.arrayBuffer()),cloudId=crypto.randomUUID(),requestId=crypto.randomUUID();await repo.saveCloudPending({requestId,link:{userId:A,localProjectId:p.id,cloudProjectId:cloudId,revision:0,localRevision:1,autoSync:true},file,metadata:{name:p.name,venue:p.venue,sourceProjectId:p.id}});
 const first=syncCloudProject(p);jobs.push(first);await entered.promise;expect(calls[0].status).toBe(201);const waiting=syncCloudProject(p,true).then(()=>({ok:true,error:''}),error=>({ok:false,error:String(error)}));jobs.push(waiting);
 useEditor.getState().restoreScene(p.scenes[0].id);await captureAutosaveFlush()();const restoredA=structuredClone(useEditor.getState().project);expect(restoredA.planReference?.widthPx).toBe(1000);useAuth.setState({status:'signedIn',user:{id:B,email:'b@example.test'}});ack.resolve();await first;
 const retired=await waiting;expect(retired.ok).toBe(false);expect(retired.error).toMatch(/계정|취소/);expect(calls.filter(c=>c.method==='PUT')).toHaveLength(1);expect(await repo.cloudLink(A,p.id)).toBeUndefined();expect(await repo.cloudPending(B,p.id)).toBeUndefined();const pending=(await repo.cloudPending(A,p.id))!;expect(pending.requestId).toBe(requestId);expect(new Uint8Array(await pending.file.arrayBuffer())).toEqual(originalBytes);
 useAuth.setState({status:'signedIn',user:{id:A,email:'a@example.test'}});await syncCloudProject(restoredA,true);const restoredLink=(await repo.cloudLink(A,p.id))!;expect(restoredLink.revision).toBe(2);expect(restoredLink.localRevision).toBe(2);expect(await repo.cloudPending(A,p.id)).toBeUndefined();
 const puts=calls.filter(c=>c.method==='PUT');expect(puts.map(c=>[c.account,c.expectedRevision,c.status])).toEqual([['Bearer account-a','0',201],['Bearer account-a','0',200],['Bearer account-a','1',200]]);expect(puts[1].sha256).toBe(hash(originalBytes));expect(puts[2].sha256).not.toBe(puts[0].sha256);expect(useCloudSync.getState().current?.status).toBe('saved');
 const client=createCloudProjectClient('account-a'),receivedA=await client.read(cloudId);expect(await importProjectPackage(receivedA.bytes)).toEqual(restoredA);
 useEditor.getState().restoreScene(p.scenes[1].id);await captureAutosaveFlush()();const restoredB=structuredClone(useEditor.getState().project);expect(restoredB.planReference?.widthPx).toBe(800);await syncCloudProject(restoredB,true);const receivedB=await client.read(cloudId);expect(receivedB.summary.revision).toBe(3);expect(await importProjectPackage(receivedB.bytes)).toEqual(restoredB);
 const other=createCloudProjectClient('account-b');expect(await other.list()).toEqual([]);await expect(other.read(cloudId)).rejects.toThrow();expect(await repo.cloudPending(B,p.id)).toBeUndefined();expect(await repo.cloudLink(B,p.id)).toBeUndefined();expect(service.bucket.data.size).toBe(1);expect(useEditor.getState().project.note).toBe(p.note);expect(restoredB.scenes).toEqual(p.scenes);
 if(process.env.GONGGAN_CLOUD_PLAN_PROOF==='1'){const dir='docs/validation/cloud-plan-restore-2026-10-11';await mkdir(dir,{recursive:true});await writeFile(dir+'/project.gonggan.zip',new Uint8Array(receivedB.bytes));await writeFile(dir+'/workflow.json',JSON.stringify({date:'2026-10-11',inputBackupSha256:hash(inputBytes),originalPendingSha256:hash(originalBytes),receivedASha256:receivedA.summary.sha256,receivedBSha256:receivedB.summary.sha256,waitingAccountSwitchRejected:true,originalPendingExact:true,idempotentRetryRevision:1,sceneARemoteRevision:2,sceneBRemoteRevision:3,localRevision:(await repo.cloudLink(A,p.id))!.localRevision,privateNotePreserved:true,scenePlanImagesPreserved:true,otherAccountListCount:0,otherAccountReadDenied:true,otherAccountLocalQueueAbsent:true,remainingStoredPackages:service.bucket.data.size,calls,browserGpuMeasured:false,operationalAuthMeasured:false,limitations:['Owned prior two-JPEG/Scene backup; actual exportProjectBackup image checks use native Canvas decoder','Actual Zustand/default local autosave and cloud queue, fake-indexeddb, cloud client, production Worker with SQLite/R2/auth fixture','Delayed response ignores abort on purpose; not real server/account/device or browser fetch cancellation acceptance']},null,2)+'\n');}
},60000);
