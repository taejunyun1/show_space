import {beforeEach,expect,it,vi} from 'vitest';
import {create,type StoreApi} from 'zustand';
import {IDBFactory} from 'fake-indexeddb';
import {createProjectLibrary} from '../lib/projectLibrary';
import {createDemoProject} from '../domain/model';
import type {Project} from '../domain/types';
import {CloudProjectError} from '../lib/cloudProjectClient';
const userA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',userB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const mocks=vi.hoisted(()=>({repo:undefined as unknown,editor:undefined as unknown,auth:undefined as unknown,localRevision:vi.fn(),save:vi.fn(),export:vi.fn(),flush:vi.fn()}));
vi.mock('../lib/projectLibrary',async original=>({...await original() as object,projectLibrary:()=>mocks.repo}));
vi.mock('./editor',()=>({useEditor:{getState:()=> (mocks.editor as {getState:()=>unknown}).getState()},flushAutosave:mocks.flush}));
vi.mock('./auth',()=>({useAuth:{getState:()=> (mocks.auth as {getState:()=>unknown}).getState(),subscribe:(listener:(state:unknown,previous:unknown)=>void)=>(mocks.auth as StoreApi<{user:{id:string}|null;status:string}>).subscribe(listener)},cloudSession:async()=>({userId:(mocks.auth as StoreApi<{user:{id:string}}>).getState().user.id,token:'test'})}));
vi.mock('../lib/cloudProjectClient',async original=>({...await original() as object,createCloudProjectClient:()=>({save:mocks.save})}));
vi.mock('../lib/persistence',()=>({localProjectRevision:mocks.localRevision}));
vi.mock('../lib/projectBackup',()=>({exportProjectBackup:mocks.export}));
let repo:ReturnType<typeof createProjectLibrary>,editor:StoreApi<{project:Project;hydrated:boolean;saveStatus:string}>,auth:StoreApi<{user:{id:string}|null;status:string}>;
beforeEach(async()=>{vi.resetModules();vi.clearAllMocks();repo=createProjectLibrary(new IDBFactory());mocks.repo=repo;editor=create(()=>({project:createDemoProject(),hydrated:true,saveStatus:'saved'}));auth=create(()=>({user:{id:userA},status:'signedIn'}));mocks.editor=editor;mocks.auth=auth;await repo.save(editor.getState().project,0,true);mocks.localRevision.mockReturnValue(1);mocks.flush.mockResolvedValue(undefined);mocks.export.mockImplementation(async()=>new Blob([new Uint8Array([80,75,3,4,...Array(26).fill(0)])]));mocks.save.mockImplementation(async(_id,revision)=>({revision:revision+1}));});
it('keeps and retries the same durable upload before exporting another package',async()=>{
 const {syncCloudProject}=await import('./cloudSync');mocks.save.mockRejectedValueOnce(new CloudProjectError('offline',503));await expect(syncCloudProject(editor.getState().project,true)).rejects.toThrow('offline');const pending=(await repo.cloudPending(userA,'project-1'))!;expect(pending.link.revision).toBe(0);expect(await repo.cloudLink(userA,'project-1')).toBeUndefined();
 await syncCloudProject(editor.getState().project,true);expect(mocks.export).toHaveBeenCalledTimes(1);expect(mocks.save.mock.calls[1][0]).toBe(pending.link.cloudProjectId);expect(await (mocks.save.mock.calls[1][2] as Blob).arrayBuffer()).toEqual(await pending.file.arrayBuffer());expect((await repo.cloudLink(userA,'project-1'))?.revision).toBe(1);expect(await repo.cloudPending(userA,'project-1')).toBeUndefined();
});
it('does not acknowledge an upload for a different signed-in account',async()=>{
 const {syncCloudProject}=await import('./cloudSync');mocks.save.mockImplementation(async()=>{auth.setState({user:{id:userB}});return {revision:1};});await expect(syncCloudProject(editor.getState().project,true)).rejects.toThrow('계정');expect(await repo.cloudLink(userA,'project-1')).toBeUndefined();expect(await repo.cloudPending(userA,'project-1')).toBeDefined();expect(await repo.cloudPending(userB,'project-1')).toBeUndefined();
});
it('retains conflicts and skips automatic retries of blocked or paused uploads',async()=>{
 const {syncCloudProject,useCloudSync}=await import('./cloudSync');mocks.save.mockRejectedValueOnce(new CloudProjectError('다른 기기',409));await expect(syncCloudProject(editor.getState().project,true)).rejects.toThrow('다른 기기');expect((await repo.cloudPending(userA,'project-1'))?.blocked).toBe(true);await syncCloudProject(editor.getState().project);expect(mocks.save).toHaveBeenCalledTimes(1);expect(useCloudSync.getState().current?.status).toBe('conflict');
 await repo.setCloudAutoSync(userA,'project-1',false);await syncCloudProject(editor.getState().project);expect(mocks.save).toHaveBeenCalledTimes(1);expect(await repo.cloudPending(userA,'project-1')).toBeDefined();
});
it('serializes queued saves and reads the newest committed local document',async()=>{
 const {syncCloudProject}=await import('./cloudSync');let release!:()=>void;const wait=new Promise<void>(resolve=>release=resolve);let start!:()=>void;const started=new Promise<void>(resolve=>start=resolve);mocks.save.mockImplementationOnce(async(_id,revision)=>{start();await wait;return {revision:revision+1};});
 const first=syncCloudProject(editor.getState().project,true);await started;const updated={...editor.getState().project,name:'새 수정'};await repo.save(updated,1);mocks.localRevision.mockReturnValue(2);editor.setState({project:updated});const second=syncCloudProject(updated,true);release();await Promise.all([first,second]);expect(mocks.save).toHaveBeenCalledTimes(2);expect(mocks.save.mock.calls[1][1]).toBe(1);expect(mocks.save.mock.calls[1][3].name).toBe('새 수정');expect((await repo.cloudLink(userA,'project-1'))?.localRevision).toBe(2);
});

it('retains the upload package when an explicit cancel interrupts acknowledgement',async()=>{
 const {syncCloudProject,cancelCloudProject}=await import('./cloudSync');let release!:()=>void,start!:()=>void;const wait=new Promise<void>(resolve=>release=resolve),started=new Promise<void>(resolve=>start=resolve);mocks.save.mockImplementationOnce(async()=>{start();await wait;return {revision:1};});const work=syncCloudProject(editor.getState().project,true);await started;cancelCloudProject('project-1');release();await expect(work).rejects.toThrow('취소');expect(await repo.cloudPending(userA,'project-1')).toBeDefined();expect(await repo.cloudLink(userA,'project-1')).toBeUndefined();
});

it('does not claim that another tab’s newest local snapshot is the current visible draft',async()=>{
 const {syncCloudProject,useCloudSync}=await import('./cloudSync');await repo.save({...editor.getState().project,name:'다른 탭 수정'},1);await expect(syncCloudProject(editor.getState().project,true)).rejects.toThrow('다른 탭');expect(mocks.export).not.toHaveBeenCalled();expect(mocks.save).not.toHaveBeenCalled();expect(useCloudSync.getState().current?.status).toBe('conflict');
});

it('preserves pending local work after role revocation and stops automatic privileged retries',async()=>{
 const {syncCloudProject,useCloudSync}=await import('./cloudSync');mocks.save.mockRejectedValueOnce(new CloudProjectError('편집 권한이 변경됐습니다.',403));await expect(syncCloudProject(editor.getState().project,true)).rejects.toThrow('편집 권한');const pending=await repo.cloudPending(userA,'project-1');expect(pending?.blocked).toBe(true);await syncCloudProject(editor.getState().project);expect(mocks.save).toHaveBeenCalledTimes(1);expect(useCloudSync.getState().current?.status).toBe('conflict');expect(await repo.read('project-1')).toBeDefined();
});

it.each(['other-account','sign-out','roundtrip'] as const)('never rebinds a waiting save to a later session after %s',async transition=>{
 const {syncCloudProject}=await import('./cloudSync'),project=editor.getState().project;
 await repo.saveCloudPending({requestId:crypto.randomUUID(),link:{userId:userA,localProjectId:project.id,cloudProjectId:crypto.randomUUID(),revision:0,localRevision:1,autoSync:true},file:await mocks.export(project),metadata:{name:project.name,venue:project.venue,sourceProjectId:project.id}});
 let release!:()=>void,started!:()=>void;const entered=new Promise<void>(r=>started=r),ack=new Promise<void>(r=>release=r);mocks.save.mockImplementationOnce(async()=>{started();await ack;return {revision:1};});
 const first=syncCloudProject(project);await entered;const second=syncCloudProject(project,true).then(()=>({ok:true,error:''}),error=>({ok:false,error:String(error)}));
 auth.setState({user:transition==='sign-out'?null:{id:userB}});if(transition==='roundtrip')auth.setState({user:{id:userA}});release();await first;const result=await second;
 expect(result.ok).toBe(false);expect(result.error).toMatch(/취소|계정/);expect(mocks.save).toHaveBeenCalledTimes(1);expect(await repo.cloudPending(userA,project.id)).toBeDefined();expect(await repo.cloudPending(userB,project.id)).toBeUndefined();expect(await repo.cloudLink(userA,project.id)).toBeUndefined();
});
it('does not display a saved cloud status for an older acknowledged revision after local Scene restoration',async()=>{
 const {syncCloudProject,useCloudSync}=await import('./cloudSync'),project=editor.getState().project;
 mocks.save.mockImplementationOnce(async()=>{const restored={...project,name:'복원한 새 배치'};await repo.save(restored,1);editor.setState({project:restored,saveStatus:'saved'});mocks.localRevision.mockReturnValue(2);return {revision:1};});
 await syncCloudProject(project,true);expect((await repo.cloudLink(userA,project.id))?.localRevision).toBe(1);expect(useCloudSync.getState().current?.status).toBe('queued');
 await syncCloudProject(editor.getState().project,true);expect((await repo.cloudLink(userA,project.id))?.localRevision).toBe(2);expect(useCloudSync.getState().current?.status).toBe('saved');
});
it('cancels every waiting save for the same account/project and preserves its exact pending package',async()=>{
 const {syncCloudProject,cancelCloudProject}=await import('./cloudSync');let release!:()=>void,started!:()=>void;const entered=new Promise<void>(r=>started=r),ack=new Promise<void>(r=>release=r);mocks.save.mockImplementationOnce(async()=>{started();await ack;return {revision:1};});
 const project=editor.getState().project;await repo.saveCloudPending({requestId:crypto.randomUUID(),link:{userId:userA,localProjectId:project.id,cloudProjectId:crypto.randomUUID(),revision:0,localRevision:1,autoSync:true},file:await mocks.export(project),metadata:{name:project.name,venue:project.venue,sourceProjectId:project.id}});
 const running=syncCloudProject(project);await entered;const waiting=syncCloudProject(project,true).then(()=>true,()=>false);cancelCloudProject(project.id);release();await running;expect(await waiting).toBe(false);expect(mocks.save).toHaveBeenCalledTimes(1);expect(await repo.cloudPending(userA,project.id)).toBeDefined();
});
it('keeps the newest waiting job registered after its predecessor finishes, so a third save cannot overlap it',async()=>{
 const {syncCloudProject}=await import('./cloudSync');let releaseFirst!:()=>void,releaseSecond!:()=>void,startFirst!:()=>void,startSecond!:()=>void;
 const enteredFirst=new Promise<void>(r=>startFirst=r),enteredSecond=new Promise<void>(r=>startSecond=r),firstAck=new Promise<void>(r=>releaseFirst=r),secondAck=new Promise<void>(r=>releaseSecond=r);
 mocks.save.mockImplementationOnce(async()=>{startFirst();await firstAck;return {revision:1};}).mockImplementationOnce(async()=>{startSecond();await secondAck;return {revision:2};});
 const first=syncCloudProject(editor.getState().project,true);await enteredFirst;const updated={...editor.getState().project,name:'직렬 저장의 최신 편집'};await repo.save(updated,1);mocks.localRevision.mockReturnValue(2);editor.setState({project:updated});const second=syncCloudProject(updated,true);releaseFirst();await first;await enteredSecond;
 const third=syncCloudProject(updated,true).then(()=>true,()=>false);await repo.list();await new Promise(r=>setTimeout(r,0));expect(mocks.save).toHaveBeenCalledTimes(2);expect(mocks.export).toHaveBeenCalledTimes(2);releaseSecond();await second;expect(await third).toBe(true);expect(mocks.save).toHaveBeenCalledTimes(2);expect((await repo.cloudLink(userA,updated.id))?.localRevision).toBe(2);
});
