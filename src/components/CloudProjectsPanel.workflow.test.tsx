// @vitest-environment jsdom
import {act,StrictMode} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {Blob as NodeBlob} from 'node:buffer';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadImage} from '@napi-rs/canvas';
import {IDBFactory} from 'fake-indexeddb';
import {CloudProjectsPanel} from './CloudProjectsPanel';
import {useAuth,cloudSession} from '../state/auth';
import {useEditor,startAutosave,captureAutosaveFlush} from '../state/editor';
import {useCloudSync,syncCloudProject,cancelCloudProject} from '../state/cloudSync';
import {createDemoProject} from '../domain/model';
import type {Project} from '../domain/types';
import type {CloudProjectLink,CloudProjectSummary} from '../domain/cloudProject';
import * as libraries from '../lib/projectLibrary';
import {saveNewLocalProject} from '../lib/persistence';
import {createCloudProjectClient} from '../lib/cloudProjectClient';
import {openEditableCloudProject} from '../lib/openCloudProject';
import {importProjectPackage} from '../lib/projectPackage';
import {commentFixture} from '../worker/commentApi.fixture';
import {handleProjectRequest,type ProjectBucket} from '../worker/projectApi';
vi.mock('../state/auth',async original=>({...await original<typeof import('../state/auth')>(),cloudSession:vi.fn()}));
vi.mock('../state/cloudSync',async original=>{const actual=await original<typeof import('../state/cloudSync')>();return {...actual,syncCloudProject:vi.fn(actual.syncCloudProject),cancelCloudProject:vi.fn(actual.cancelCloudProject)};});
vi.mock('../lib/cloudProjectClient',async original=>({...await original<typeof import('../lib/cloudProjectClient')>(),createCloudProjectClient:vi.fn()}));
vi.mock('../lib/openCloudProject',()=>({openEditableCloudProject:vi.fn()}));
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',C='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
let root:Root,container:HTMLDivElement,repo:ReturnType<typeof libraries.createProjectLibrary>,p:Project,stop=()=>{},service:ReturnType<typeof commentFixture>|undefined;
let releases:Array<()=>void>=[],pending:Promise<unknown>[]=[];const busy=vi.fn(),changed=vi.fn(async()=>{});
function gate<T>(){let resolve!:(v:T)=>void,reject!:(e:unknown)=>void;const promise=new Promise<T>((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};}
const session=(id=A)=>({userId:id,token:id===A?'account-a':'account-b'});
const user=(id=A)=>({id,email:id===A?'a@example.test':'b@example.test'});
const summary:CloudProjectSummary={id:C,name:'원격 전시',venue:'성수',sourceProjectId:'remote-original',revision:1,bytes:100,sha256:'a'.repeat(64),archived:false,createdAt:'2026-10-11T00:00:00Z',updatedAt:'2026-10-11T00:00:00Z'};
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
async function wait(check:()=>void){await vi.waitFor(async()=>{await act(async()=>{await repo.list();await new Promise(r=>setTimeout(r,0));});check();},{timeout:5000});}
const button=(label:string)=>[...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.trim()===label)!;
async function click(label:string){const b=button(label);expect(b,label).toBeDefined();expect(b.disabled,label).toBe(false);await act(async()=>b.click());}
async function mount(){await act(async()=>root.render(<StrictMode><CloudProjectsPanel disabled={false} onBusy={busy} onLocalChange={changed}/></StrictMode>));}
function delayedSession(){const g=gate<Awaited<ReturnType<typeof cloudSession>>>();vi.mocked(cloudSession).mockImplementationOnce(()=>g.promise);releases.push(()=>g.resolve(session()));return g;}
async function card(){await click('클라우드 목록 새로고침');await wait(()=>expect(container.querySelector('.project-card strong')?.textContent).toBe(summary.name));}
beforeEach(async()=>{
 vi.clearAllMocks();releases=[];pending=[];(globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;vi.stubGlobal('Blob',NodeBlob);
 const input=new Uint8Array(await readFile('docs/validation/local-plan-restore-2026-10-11/project.gonggan.zip'));p={...await importProjectPackage(input.slice().buffer),id:crypto.randomUUID(),name:'화면의 도면 전시'};repo=libraries.createProjectLibrary(new IDBFactory(),'cloud-panel-'+crypto.randomUUID());vi.spyOn(libraries,'projectLibrary').mockReturnValue(repo);await saveNewLocalProject(p);useEditor.getState().loadProject(p,true);stop=startAutosave(undefined,60000);
 useAuth.setState({status:'signedIn',user:user(),config:{url:'https://testing.supabase.co',publishableKey:'sb_publishable_only_public_test_key',googleEnabled:false,cloudEnabled:true},error:''});useCloudSync.setState({current:null});
 vi.mocked(cloudSession).mockImplementation(async()=>session(useAuth.getState().user!.id));vi.mocked(syncCloudProject).mockImplementation(async project=>{useCloudSync.setState({current:{projectId:project.id,userId:useAuth.getState().user!.id,status:'saved',message:''}});});
 vi.mocked(createCloudProjectClient).mockReturnValue({list:vi.fn(async()=>[summary]),listShared:vi.fn(async()=>[]),metadata:vi.fn(async()=>summary),read:vi.fn(),save:vi.fn(),archive:vi.fn(async()=>summary)});
 vi.mocked(openEditableCloudProject).mockImplementation(async(_client,_id,_user,guard)=>{guard();return {...createDemoProject(),id:crypto.randomUUID(),name:'연 원격 전시'};});
 container=document.createElement('div');document.body.append(container);root=createRoot(container);
});
afterEach(async()=>{for(const release of releases)release();await act(async()=>root.unmount());container.remove();await Promise.allSettled(pending);const finish=captureAutosaveFlush();stop();stop=()=>{};await finish().catch(()=>{});service?.close();service=undefined;vi.restoreAllMocks();vi.unstubAllGlobals();});

it.each(['other-project','same-id-restore','project-roundtrip','account-roundtrip'] as const)('never saves a later context when its session arrives after %s',async transition=>{
 await mount();const g=delayedSession();await click('현재 프로젝트 클라우드 저장');await act(async()=>{if(transition==='account-roundtrip'){useAuth.setState({user:user(B)});useAuth.setState({user:user(A)});}else{if(transition!=='same-id-restore')useEditor.getState().loadProject({...p,id:crypto.randomUUID(),name:'다른 전시'},true);if(transition!=='other-project')useEditor.getState().loadProject({...p,name:'복원한 현재 전시'},true);}});
 expect(button('현재 프로젝트 클라우드 저장').disabled).toBe(false);const current=useEditor.getState().project;await act(async()=>g.resolve(session()));await wait(()=>expect(button('현재 프로젝트 클라우드 저장').disabled).toBe(false));expect(syncCloudProject).not.toHaveBeenCalled();expect(useEditor.getState().project).toBe(current);expect(changed).not.toHaveBeenCalled();expect(container.querySelector('[role="alert"]')).toBeNull();expect(busy).toHaveBeenLastCalledWith(false);
});
it('releases controls on cancel and an old completion cannot clear the busy state of its replacement',async()=>{
 await mount();const old=delayedSession();await click('현재 프로젝트 클라우드 저장');await click('클라우드 작업 취소');expect(button('현재 프로젝트 클라우드 저장').disabled).toBe(false);expect(cancelCloudProject).toHaveBeenCalledWith(p.id,A);
 const latest=delayedSession();await click('현재 프로젝트 클라우드 저장');await act(async()=>old.resolve(session()));await wait(()=>expect(syncCloudProject).not.toHaveBeenCalled());expect(button('현재 프로젝트 클라우드 저장').disabled).toBe(true);expect(container.textContent).toContain('클라우드 작업 중');await act(async()=>latest.resolve(session()));await wait(()=>expect(container.textContent).toContain('클라우드 저장됨'));expect(syncCloudProject).toHaveBeenCalledTimes(1);expect(container.querySelector('[role="alert"]')).toBeNull();
});
it('releases parent controls and does not report an old session error after unmount',async()=>{await mount();const g=delayedSession();await click('현재 프로젝트 클라우드 저장');await act(async()=>root.unmount());expect(busy).toHaveBeenLastCalledWith(false);const count=changed.mock.calls.length;await act(async()=>g.reject(new Error('OLD SESSION ERROR')));expect(syncCloudProject).not.toHaveBeenCalled();expect(changed).toHaveBeenCalledTimes(count);});
it('does not install stale link controls after a batched account roundtrip',async()=>{
 const old=gate<CloudProjectLink|undefined>(),read=repo.cloudLink.bind(repo);let oldReads=true;vi.spyOn(repo,'cloudLink').mockImplementation((...args)=>oldReads?old.promise:read(...args));releases.push(()=>old.resolve(undefined));await mount();oldReads=false;
 await act(async()=>{useAuth.setState({user:user(B)});useAuth.setState({user:user(A)});});await act(async()=>old.resolve({userId:A,localProjectId:p.id,cloudProjectId:C,revision:1,localRevision:1,autoSync:true}));await wait(()=>expect(container.textContent).not.toContain('이 프로젝트 클라우드 자동 저장'));expect(container.querySelector('[role="alert"]')).toBeNull();
});
it('preserves edits made while a cloud open is reading and permits a later retry',async()=>{
 await mount();await card();const g=gate<Project>();releases.push(()=>g.resolve(p));vi.mocked(openEditableCloudProject).mockImplementationOnce(()=>g.promise);await click('편집기로 열기');await act(async()=>useEditor.getState().renameProject('읽는 동안 새 편집'));const edited=useEditor.getState().project;await act(async()=>g.resolve({...p,id:crypto.randomUUID(),name:'늦은 파일'}));await wait(()=>expect(container.textContent).toContain('작업이 변경'));expect(useEditor.getState().project).toBe(edited);expect(await repo.activeId()).toBe(p.id);
 await click('편집기로 열기');await wait(()=>expect(useEditor.getState().project.name).toBe('연 원격 전시'));expect(container.querySelector('[role="alert"]')).toBeNull();
});
it('does not open a cloud project while a transform is active',async()=>{await mount();await card();await act(async()=>useEditor.setState({previewProject:p}));await click('편집기로 열기');await wait(()=>expect(container.textContent).toContain('이동·회전'));expect(openEditableCloudProject).not.toHaveBeenCalled();expect(useEditor.getState().project.id).toBe(p.id);await act(async()=>useEditor.setState({previewProject:null}));});
it('keeps a staged conflict copy inactive if edits arrive before its storage acknowledgement',async()=>{
 await mount();await act(async()=>useCloudSync.setState({current:{projectId:p.id,userId:A,status:'conflict',message:'다른 기기 수정'}}));const written=gate<void>(),ack=gate<void>(),save=repo.save.bind(repo);releases.push(()=>ack.resolve());vi.spyOn(repo,'save').mockImplementationOnce(async(...args)=>{const result=await save(...args);written.resolve();await ack.promise;return result;});
 await click('현재 작업을 새 클라우드 복사본으로 저장');await act(async()=>written.promise);await act(async()=>useEditor.getState().renameProject('복사 저장 중 추가 편집'));await act(async()=>ack.resolve());await wait(()=>expect(container.textContent).toContain('작업이 변경'));expect(useEditor.getState().project.name).toBe('복사 저장 중 추가 편집');expect(await repo.activeId()).toBe(p.id);expect(await repo.list()).toHaveLength(2);expect(syncCloudProject).not.toHaveBeenCalled();
});
it('starts only one request when two controls are clicked before React renders busy',async()=>{await mount();const g=delayedSession();await act(async()=>{button('현재 프로젝트 클라우드 저장').click();button('클라우드 목록 새로고침').click();});expect(cloudSession).toHaveBeenCalledTimes(1);await act(async()=>g.resolve(session()));await wait(()=>expect(container.textContent).toContain('클라우드 저장됨'));});
it('shows the correct saved state and linked controls after a normal save',async()=>{await mount();await click('현재 프로젝트 클라우드 저장');await wait(()=>expect(container.textContent).toContain('클라우드 저장됨'));expect(syncCloudProject).toHaveBeenCalledWith(expect.objectContaining({id:p.id}),true);expect(changed).toHaveBeenCalledTimes(1);expect(button('현재 프로젝트 클라우드 저장').disabled).toBe(false);});

it('uses actual save/cancel/retry/pause buttons with native two-plan packages and a delayed SQLite/R2 Worker, then saves the restored Scene',async()=>{
 class NativeImage{naturalWidth=0;naturalHeight=0;onload:(()=>void)|null=null;onerror:(()=>void)|null=null;set src(url:string){if(!url)return;void loadImage(url).then(image=>{this.naturalWidth=image.width;this.naturalHeight=image.height;this.onload?.();},()=>this.onerror?.());}}vi.stubGlobal('Image',NativeImage);
 const actualClient=await vi.importActual<typeof import('../lib/cloudProjectClient')>('../lib/cloudProjectClient'),actualSync=await vi.importActual<typeof import('../state/cloudSync')>('../state/cloudSync');vi.mocked(createCloudProjectClient).mockImplementation(actualClient.createCloudProjectClient);vi.mocked(syncCloudProject).mockImplementation((...args)=>{const result=actualSync.syncCloudProject(...args);pending.push(result);return result;});
 service=commentFixture();for(const m of ['0001_cloud_projects.sql','0005_project_collaboration.sql'])service.sql.exec(await readFile('migrations/'+m,'utf8'));
 const bucket:ProjectBucket={async put(key,stream,options){const bytes=new Uint8Array(await new Response(stream).arrayBuffer());expect(hash(bytes)).toBe(options.sha256);service!.bucket.data.set(key,bytes);return {size:bytes.length};},async get(key,options){const source=service!.bucket.data.get(key);if(!source)return null;const bytes=options?source.slice(options.range.offset,options.range.offset+options.range.length):source;return {size:bytes.length,body:new Blob([bytes.slice().buffer]).stream()};},async delete(key){service!.bucket.data.delete(key);}};
 const gates=[gate<void>(),gate<void>()],entered=[gate<void>(),gate<void>()];for(const g of gates)releases.push(()=>g.resolve());let puts=0;const calls:Array<{method:string;path:string;status:number;expectedRevision:string|null}>=[];
 vi.stubGlobal('fetch',vi.fn(async(path:string,init:RequestInit={})=>{const headers=new Headers(init.headers);if(init.body instanceof Blob)headers.set('content-length',String(init.body.size));const {signal:_signal,...transport}=init;const response=await handleProjectRequest(new Request('https://example.test'+path,{...transport,headers}),{...service!.env,PRIVATE_PROJECTS:bucket},service!.auth);calls.push({method:init.method??'GET',path,status:response.status,expectedRevision:headers.get('x-expected-revision')});if(init.method==='PUT'){const i=puts++;if(i<2){entered[i].resolve();await gates[i].promise;}}return response;}));
 await mount();await click('현재 프로젝트 클라우드 저장');await act(async()=>entered[0].promise);const before=(await repo.cloudPending(A,p.id))!,originalBytes=new Uint8Array(await before.file.arrayBuffer());expect(container.textContent).toContain('클라우드 저장 중');await click('클라우드 작업 취소');expect(button('현재 프로젝트 클라우드 저장').disabled).toBe(false);expect(container.textContent).toContain('클라우드 저장 대기');
 await click('현재 프로젝트 클라우드 저장');await act(async()=>gates[0].resolve());await act(async()=>entered[1].promise);expect(button('현재 프로젝트 클라우드 저장').disabled).toBe(true);expect(container.textContent).toContain('클라우드 작업 중');expect(new Uint8Array(await (await repo.cloudPending(A,p.id))!.file.arrayBuffer())).toEqual(originalBytes);await act(async()=>gates[1].resolve());await wait(()=>expect(button('현재 프로젝트 클라우드 저장').disabled).toBe(false));expect(container.textContent).toContain('클라우드 저장됨');expect(await repo.cloudPending(A,p.id)).toBeUndefined();
 const checkbox=()=>[...container.querySelectorAll('label')].find(l=>l.textContent?.includes('이 프로젝트 클라우드 자동 저장'))?.querySelector<HTMLInputElement>('input')!;await wait(()=>expect(checkbox()?.checked).toBe(true));await act(async()=>checkbox().click());await wait(()=>expect(button('현재 프로젝트 클라우드 저장').disabled).toBe(false));expect(checkbox().checked).toBe(false);expect((await repo.cloudLink(A,p.id))?.autoSync).toBe(false);
 await act(async()=>useEditor.getState().restoreScene(p.scenes[0].id));await click('현재 프로젝트 클라우드 저장');await wait(()=>expect(button('현재 프로젝트 클라우드 저장').disabled).toBe(false));const final=structuredClone(useEditor.getState().project),link=(await repo.cloudLink(A,p.id))!;expect(final.planReference?.widthPx).toBe(1000);expect(link.revision).toBe(2);expect(link.localRevision).toBe(2);expect(link.autoSync).toBe(false);expect(container.textContent).toContain('클라우드 저장됨');
 const client=actualClient.createCloudProjectClient('account-a'),received=await client.read(link.cloudProjectId);expect(await importProjectPackage(received.bytes)).toEqual(final);expect(calls.filter(c=>c.method==='PUT').map(c=>[c.expectedRevision,c.status])).toEqual([['0',201],['0',200],['1',200]]);expect(changed).toHaveBeenCalledTimes(3);expect(service.bucket.data.size).toBe(1);
 if(process.env.GONGGAN_CLOUD_PANEL_PROOF==='1'){const dir='docs/validation/cloud-panel-2026-10-11';await mkdir(dir,{recursive:true});await writeFile(dir+'/project.gonggan.zip',new Uint8Array(received.bytes));await writeFile(dir+'/workflow.json',JSON.stringify({date:'2026-10-11',receivedSha256:received.summary.sha256,actualUiActions:['save','cancel','retry','pause-auto-save','restore-Scene-A','manual-save'],retryEnabledBeforeOldResponse:true,retryStayedBusyAfterOldCompletion:true,pendingExact:true,idempotentRetryRevision:1,remoteRevision:link.revision,localRevision:link.localRevision,autoSync:link.autoSync,projectExact:true,sceneCount:final.scenes.length,privateNotePreserved:final.note===p.note,calls,browserGpuMeasured:false,operationalAuthMeasured:false,limits:['Actual React/jsdom buttons, default local/cloud saving and native two-plan image decoder','fake-indexeddb and production Worker handler with local SQLite/R2/auth fixture','Transport intentionally ignores AbortSignal; not real browser, account, network cancellation or device acceptance']},null,2)+'\n');}
},60000);
