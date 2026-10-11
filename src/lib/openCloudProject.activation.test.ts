import {afterEach,expect,it,vi} from 'vitest';
import {IDBFactory,IDBObjectStore} from 'fake-indexeddb';
import {File as NodeFile} from 'node:buffer';
import {createDemoProject} from '../domain/model';
import {useEditor,startAutosave,captureAutosaveFlush} from '../state/editor';
import {requireProjectSwitchReady} from '../components/projectSwitchGuard';
import * as libraries from './projectLibrary';
import {saveNewLocalProject,readDraft} from './persistence';
import {exportProjectPackage} from './projectPackage';
import {openEditableCloudProject} from './openCloudProject';
import {cloudPackageHash,type createCloudProjectClient} from './cloudProjectClient';
let stop=()=>{};
afterEach(async()=>{const finish=captureAutosaveFlush();stop();stop=()=>{};await finish().catch(()=>{});vi.restoreAllMocks();vi.unstubAllGlobals();});
async function setup(){
 vi.stubGlobal('File',NodeFile);const repo=libraries.createProjectLibrary(new IDBFactory(),'cloud-open-activation-'+crypto.randomUUID());vi.spyOn(libraries,'projectLibrary').mockReturnValue(repo);const p={...createDemoProject(),id:crypto.randomUUID(),artworks:[]};await saveNewLocalProject(p);useEditor.getState().loadProject(p,true);stop=startAutosave(undefined,60000);
 const remote={...p,id:crypto.randomUUID(),name:'클라우드에서 여는 전시'},file=await exportProjectPackage(remote,async()=>{throw new Error('Unexpected asset');}),bytes=await file.arrayBuffer(),id=crypto.randomUUID(),summary={id,name:remote.name,venue:remote.venue,sourceProjectId:remote.id,revision:1,bytes:bytes.byteLength,sha256:await cloudPackageHash(bytes),archived:false,createdAt:'2026-10-11T00:00:00Z',updatedAt:'2026-10-11T00:00:00Z'};
 const client:ReturnType<typeof createCloudProjectClient>={read:async()=>({bytes,summary}),metadata:async()=>summary,list:async()=>[summary],listShared:async()=>[],save:vi.fn(),archive:vi.fn()};return {repo,p,remote,id,client};
}
it('aborts actual IndexedDB startup activation when an edit arrives after cloud-copy staging',async()=>{
 const {repo,p,id,client}=await setup(),snapshot=useEditor.getState().project,get=IDBObjectStore.prototype.get;vi.spyOn(IDBObjectStore.prototype,'get').mockImplementation(function(this:IDBObjectStore,key){const request=get.call(this,key);if(this.name==='summaries'&&this.transaction.mode==='readwrite'&&!this.transaction.objectStoreNames.contains('documents')&&key!==p.id)request.addEventListener('success',()=>useEditor.getState().renameProject(' 활성화 중 최신 편집'),{once:true});return request;});
 await expect(openEditableCloudProject(client,id,'11111111-1111-4111-8111-111111111111',()=>requireProjectSwitchReady(snapshot))).rejects.toThrow('작업이 변경');expect(await repo.activeId()).toBe(p.id);expect(useEditor.getState().project.name).toContain('최신 편집');expect(await repo.list()).toHaveLength(2);await captureAutosaveFlush()();expect(await readDraft()).toEqual(useEditor.getState().project);
});
it('opens a verified cloud package as an independent saved local project and keeps the prior document',async()=>{
 const {repo,p,remote,id,client}=await setup(),snapshot=useEditor.getState().project;const next=await openEditableCloudProject(client,id,'11111111-1111-4111-8111-111111111111',()=>requireProjectSwitchReady(snapshot));useEditor.getState().loadProject(next,true);expect(next.id).not.toBe(remote.id);expect({...next,id:remote.id}).toEqual(remote);expect(await readDraft()).toEqual(next);expect((await repo.read(p.id))?.project).toEqual(p);expect((await repo.cloudLink('11111111-1111-4111-8111-111111111111',next.id))?.cloudProjectId).toBe(id);
});
