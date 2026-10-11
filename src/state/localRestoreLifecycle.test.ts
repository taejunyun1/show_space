import {afterEach,expect,it,vi} from 'vitest';
import {IDBFactory,IDBObjectStore} from 'fake-indexeddb';
import {createDemoProject} from '../domain/model';
import {hydrateEditor,startAutosave,flushAutosave,captureAutosaveFlush,useEditor} from './editor';
import * as libraries from '../lib/projectLibrary';
import {saveNewLocalProject,readDraft,replaceLocalProject} from '../lib/persistence';
let stop=()=>{};const releases:Array<()=>void>=[];
afterEach(async()=>{for(const release of releases.splice(0))release();const finish=captureAutosaveFlush();stop();stop=()=>{};await finish().catch(()=>{});vi.restoreAllMocks();});
function gate<T>(){let resolve!:(value:T)=>void,reject!:(reason:unknown)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
async function setup(){const repo=libraries.createProjectLibrary(new IDBFactory(),'local-restore-'+crypto.randomUUID());vi.spyOn(libraries,'projectLibrary').mockReturnValue(repo);const p={...createDemoProject(),id:crypto.randomUUID()};await saveNewLocalProject(p);useEditor.getState().loadProject(p,true);return {repo,p};}
const nextProject=()=>({...createDemoProject(),id:crypto.randomUUID(),name:'다음 전시'});

it('saves the pending old exhibition without changing the newly selected startup project',async()=>{
 const {repo,p}=await setup();stop=startAutosave(undefined,60000);useEditor.getState().renameProject('이전 전시의 마지막 수정');const edited=useEditor.getState().project;
 const next=nextProject();await saveNewLocalProject(next);useEditor.getState().loadProject(next,true);await flushAutosave();
 expect((await repo.read(p.id))?.project).toEqual(edited);expect(await repo.activeId()).toBe(next.id);expect(await readDraft()).toEqual(next);expect(useEditor.getState().saveStatus).toBe('saved');
});
it('keeps the startup project selected when an old in-flight autosave begins its transaction after a switch',async()=>{
 const {repo}=await setup(),p={...nextProject(),name:'가져온 이전 전시'},entered=gate<void>(),ack=gate<void>(),save=repo.save.bind(repo);releases.push(()=>ack.resolve());
 vi.spyOn(repo,'save').mockImplementation(async(...args)=>{if(args[0].id===p.id){entered.resolve();await ack.promise;}return save(...args);});
 stop=startAutosave(undefined,60000);useEditor.getState().loadProject(p);useEditor.getState().renameProject('늦게 저장되는 이전 전시');const edited=useEditor.getState().project,job=flushAutosave();await entered.promise;
 const next=nextProject();await saveNewLocalProject(next);useEditor.getState().loadProject(next,true);ack.resolve();await job;
 expect((await repo.read(p.id))?.project).toEqual(edited);expect(await repo.activeId()).toBe(next.id);expect(await readDraft()).toEqual(next);
});
it('still selects a newly imported unsaved project after the default autosave persists it',async()=>{
 await setup();stop=startAutosave(undefined,60000);const next=nextProject();useEditor.getState().loadProject(next);await flushAutosave();expect(await readDraft()).toEqual(next);expect(useEditor.getState().saveStatus).toBe('saved');
});
it('rechecks startup activation after the actual IndexedDB revision query',async()=>{
 const {repo,p}=await setup(),imported=nextProject(),get=IDBObjectStore.prototype.get;
 vi.spyOn(IDBObjectStore.prototype,'get').mockImplementation(function(this:IDBObjectStore,key){const request=get.call(this,key);if(this.name==='summaries'&&this.transaction.mode==='readwrite'&&key===imported.id)request.addEventListener('success',()=>useEditor.getState().loadProject(p,true),{once:true});return request;});
 stop=startAutosave(undefined,60000);useEditor.getState().loadProject(imported);await flushAutosave();expect((await repo.read(imported.id))?.project).toEqual(imported);expect(await repo.activeId()).toBe(p.id);expect(await readDraft()).toEqual(p);
});
it('discards an older pending edit after the same project is restored from a committed version',async()=>{
 const {repo,p}=await setup();stop=startAutosave(undefined,60000);useEditor.getState().renameProject('복원 전에 남은 옛 편집');const replacement={...p,name:'확정된 복원 버전'};
 await replaceLocalProject(replacement,1);useEditor.getState().loadProject(replacement,true);await flushAutosave();expect(await readDraft()).toEqual(replacement);expect((await repo.read(p.id))?.summary.revision).toBe(2);expect(useEditor.getState().saveStatus).toBe('saved');
});
it('retires both an in-flight failure and its queued successor after a committed same-ID restoration',async()=>{
 const {repo,p}=await setup(),entered=gate<void>(),ack=gate<void>(),save=repo.save.bind(repo);releases.push(()=>ack.resolve());vi.spyOn(repo,'save').mockImplementationOnce(async(...args)=>{entered.resolve();await ack.promise;return save(...args);});
 stop=startAutosave(undefined,60000);useEditor.getState().renameProject('옛 저장 1');const first=flushAutosave();await entered.promise;useEditor.getState().renameProject('옛 저장 2');const second=flushAutosave();
 const replacement={...p,name:'새로 확정된 버전'};await replaceLocalProject(replacement,1);useEditor.getState().loadProject(replacement,true);useEditor.getState().notify('복원 완료');ack.resolve();await first;await second;
 expect(await readDraft()).toEqual(replacement);expect((await repo.read(p.id))?.summary.revision).toBe(2);expect(useEditor.getState().saveStatus).toBe('saved');expect(useEditor.getState().message).toBe('복원 완료');
});
it('queues edits made before hydration finishes and persists them after the initial read retires',async()=>{
 const {repo,p}=await setup(),read=gate<unknown>();useEditor.setState({hydrated:false});stop=startAutosave(undefined,60000);const job=hydrateEditor(()=>read.promise);
 useEditor.getState().renameProject('초기 읽기 중의 실제 수정');const edited=useEditor.getState().project;read.resolve({...p,name:'이전 저장 이름'});await job;await flushAutosave();expect((await repo.read(p.id))?.project).toEqual(edited);expect(await readDraft()).toEqual(edited);expect(useEditor.getState().saveStatus).toBe('saved');
});
it('does not mark newer unsaved edits saved when an initial read returns late',async()=>{
 await setup();const read=gate<unknown>(),ack=gate<void>();releases.push(()=>ack.resolve());stop=startAutosave(async()=>ack.promise,60000);
 const job=hydrateEditor(()=>read.promise);useEditor.getState().renameProject('새로운 미저장 편집');expect(useEditor.getState().saveStatus).toBe('saving');read.resolve(createDemoProject());await job;
 expect(useEditor.getState().project.name).toBe('새로운 미저장 편집');expect(useEditor.getState().saveStatus).toBe('saving');
});
it.each(['success','failure'] as const)('ignores an old hydration %s after same-ID document restoration',async result=>{
 const {p}=await setup(),read=gate<unknown>(),job=hydrateEditor(()=>read.promise);useEditor.getState().loadProject({...p,name:'직접 복원한 최신 전시'},true);useEditor.getState().notify('현재 작업 안내');const before=useEditor.getState();
 if(result==='success')read.resolve({...p,name:'오래된 읽기'});else read.reject(new Error('이전 읽기 실패'));await job;
 expect(useEditor.getState().project).toBe(before.project);expect(useEditor.getState().saveStatus).toBe(before.saveStatus);expect(useEditor.getState().message).toBe('현재 작업 안내');
});
it('accepts only the latest hydration request and discards a later failure from its predecessor',async()=>{
 const {p}=await setup(),old=gate<unknown>(),first=hydrateEditor(()=>old.promise);await hydrateEditor(async()=>({...p,name:'최신 불러오기'}));useEditor.getState().notify('최신 안내');const before=useEditor.getState();old.reject(new Error('앞선 읽기 실패'));await first;
 expect(useEditor.getState().project).toBe(before.project);expect(useEditor.getState().saveStatus).toBe('saved');expect(useEditor.getState().message).toBe('최신 안내');
});
