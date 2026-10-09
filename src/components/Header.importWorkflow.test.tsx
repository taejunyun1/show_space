// @vitest-environment jsdom
import {act,StrictMode} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {File as NodeFile,Blob as NodeBlob} from 'node:buffer';
import {IDBFactory} from 'fake-indexeddb';
import {Header} from './Header';
import {useAuth} from '../state/auth';
import {useEditor,startAutosave,captureAutosaveFlush} from '../state/editor';
import {createDemoProject} from '../domain/model';
import * as libraries from '../lib/projectLibrary';
import {saveNewLocalProject,writeDraft} from '../lib/persistence';
import {readModelFile} from '../lib/modelImport';
import {testVenueModel,venueTestGlb} from '../lib/venueModelTestFixture';
import {readProjectBackup} from '../lib/projectBackup';
import {downloadBlob} from '../lib/art';
import {appendSceneSnapshot} from '../domain/sceneSnapshot';
import type {Project} from '../domain/types';
import {createCanvas,loadImage,type Image as NativeImage} from '@napi-rs/canvas';
import {exportProjectPackage} from '../lib/projectPackage';

vi.mock('../lib/modelImport',async original=>({...await original<typeof import('../lib/modelImport')>(),readModelFile:vi.fn()}));
vi.mock('../lib/projectBackup',async original=>({...await original<typeof import('../lib/projectBackup')>(),readProjectBackup:vi.fn()}));
vi.mock('../lib/art',async original=>({...await original<typeof import('../lib/art')>(),downloadBlob:vi.fn()}));
// Unopened account/notes/project dialogs are outside this input workflow.
vi.mock('./AccountDialog',()=>({AccountDialog:()=>null}));
vi.mock('./ProjectNotesDialog',()=>({ProjectNotesDialog:()=>null}));
vi.mock('./ProjectsDialog',()=>({ProjectsDialog:()=>null}));
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=';
let root:Root,container:HTMLDivElement,p:Project,library:ReturnType<typeof libraries.createProjectLibrary>,stop:()=>void,writer:ReturnType<typeof vi.fn<(project:Project)=>Promise<void>>>;
const plan=vi.fn();let releaseSaves:Array<()=>void>=[];
function saveGate(){const job=deferred<void>();releaseSaves.push(()=>job.resolve());return job;}
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};}
function imported(){let next:Project={...createDemoProject(),id:'external-backup',name:'받은 전시',note:'PRIVATE_IMPORTED_NOTE',referenceModel:testVenueModel(),scenes:[]};next.artworks=next.artworks.slice(0,2).map((a,i)=>({...a,imageUrl:png,note:`PRIVATE_ART_${i}`}));next=appendSceneSnapshot(next,next,'받은 Scene');return next;}
async function mount(){await act(async()=>root.render(<StrictMode><Header onExport={()=>{}} onShare={()=>{}} onPlanImport={plan} onInstallation={()=>{}} onPresentation={()=>{}}/></StrictMode>));}
async function click(label:string){const b=[...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.trim()===label||b.getAttribute('aria-label')===label)!;expect(b).toBeDefined();await act(async()=>b.click());}
async function upload(kind:'model'|'backup'|'plan',file?:File){await click('도면·3D 불러오기');const input=container.querySelector<HTMLInputElement>(`input[aria-label="${kind==='model'?'3D 모델 파일':kind==='plan'?'도면 파일':'저장 프로젝트 파일'}"]`)!;Object.defineProperty(input,'files',{configurable:true,value:[file??new File(['fixture'],kind==='model'?'전시장.glb':kind==='plan'?'도면.jpg':'전시.zip',{type:kind==='model'?'model/gltf-binary':kind==='plan'?'image/jpeg':'application/zip'})]});await act(async()=>input.dispatchEvent(new Event('change',{bubbles:true})));}
async function waitMessage(fragment:string){await act(async()=>{await vi.waitFor(()=>expect(useEditor.getState().message).toContain(fragment));});}
beforeEach(async()=>{
 vi.resetAllMocks();(globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
 // Keep binary transports in the native realm used by the external Three loader.
 releaseSaves=[];vi.stubGlobal('ArrayBuffer',(await new NodeBlob([]).arrayBuffer()).constructor);vi.stubGlobal('File',NodeFile);vi.stubGlobal('Blob',NodeBlob);Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.open=true;}});
 useAuth.setState({status:'disabled',user:null,config:null,error:''});library=libraries.createProjectLibrary(new IDBFactory(),'header-input-'+crypto.randomUUID());vi.spyOn(libraries,'projectLibrary').mockReturnValue(library);
 p={...createDemoProject(),id:crypto.randomUUID(),name:'입력 전 작업',scenes:[],note:'PRIVATE_ORIGINAL'};await saveNewLocalProject(p);useEditor.getState().loadProject(p,true);writer=vi.fn(writeDraft);stop=startAutosave(writer,60000);
 vi.mocked(readModelFile).mockResolvedValue(testVenueModel());vi.mocked(readProjectBackup).mockResolvedValue(imported());container=document.createElement('div');document.body.append(container);root=createRoot(container);await mount();
});
afterEach(async()=>{for(const release of releaseSaves)release();await act(async()=>root.unmount());container.remove();const finish=captureAutosaveFlush();stop();await finish().catch(()=>{});vi.restoreAllMocks();vi.unstubAllGlobals();});

it.each(['model','backup'] as const)('rejects a late %s after batched project A→B→A without changing view, files or notification',async kind=>{
 const job=deferred<Awaited<ReturnType<typeof readModelFile>>|Project>();if(kind==='model')vi.mocked(readModelFile).mockImplementationOnce(()=>job.promise as ReturnType<typeof readModelFile>);else vi.mocked(readProjectBackup).mockImplementationOnce(()=>job.promise as ReturnType<typeof readProjectBackup>);await upload(kind);
 await act(async()=>{useEditor.getState().loadProject({...p,id:'intermediate-header-project'});useEditor.getState().loadProject(p);useEditor.getState().setView('plan');useEditor.getState().notify('다음 작업');});const before=useEditor.getState().project;await act(async()=>job.resolve(kind==='model'?testVenueModel():imported()));expect(useEditor.getState().project).toBe(before);expect(useEditor.getState().view).toBe('plan');expect(useEditor.getState().message).toBe('다음 작업');expect(downloadBlob).not.toHaveBeenCalled();expect(container.querySelector<HTMLButtonElement>('button[aria-label="도면·3D 불러오기"]')?.disabled).toBe(false);
});

it.each(['model','backup'] as const)('ignores a %s completing after Header unmount',async kind=>{
 const job=deferred<Awaited<ReturnType<typeof readModelFile>>|Project>();if(kind==='model')vi.mocked(readModelFile).mockImplementationOnce(()=>job.promise as ReturnType<typeof readModelFile>);else vi.mocked(readProjectBackup).mockImplementationOnce(()=>job.promise as ReturnType<typeof readProjectBackup>);await upload(kind);await act(async()=>root.unmount());const before=useEditor.getState().project;await act(async()=>useEditor.getState().notify('다른 화면'));await act(async()=>job.resolve(kind==='model'?testVenueModel():imported()));expect(useEditor.getState().project).toBe(before);expect(useEditor.getState().message).toBe('다른 화면');expect(downloadBlob).not.toHaveBeenCalled();
});

it('allows the new project import while the old decoder remains pending and ignores its error/finally',async()=>{
 const old=deferred<Awaited<ReturnType<typeof readModelFile>>>(),next=deferred<Awaited<ReturnType<typeof readModelFile>>>();vi.mocked(readModelFile).mockImplementationOnce(()=>old.promise).mockImplementationOnce(()=>next.promise);await upload('model');await act(async()=>useEditor.getState().loadProject({...p,id:'next-header-project'}));await upload('model');expect(readModelFile).toHaveBeenCalledTimes(2);await act(async()=>old.reject(new Error('이전 모델 오류')));expect(useEditor.getState().message).not.toBe('이전 모델 오류');expect(container.querySelector<HTMLButtonElement>('button[aria-label="불러오는 중"]')?.disabled).toBe(true);await act(async()=>next.resolve(testVenueModel()));expect(useEditor.getState().project.referenceModel).toEqual(testVenueModel());expect(useEditor.getState().message).toContain('3D 참고 모델');
});

it('does not show progress from an old ZIP or replace a new project while an earlier save finishes',async()=>{
 const job=deferred<Project>(),save=saveGate();let progress!:(message:string)=>void,writing=false;vi.mocked(readProjectBackup).mockImplementationOnce((_file,update)=>{progress=update!;return job.promise;});writer.mockImplementationOnce(async value=>{writing=true;await save.promise;await writeDraft(value);});await upload('backup');await act(async()=>useEditor.getState().renameProject('원래 작업 수정'));await act(async()=>job.resolve(imported()));await vi.waitFor(()=>expect(writing).toBe(true));await act(async()=>useEditor.getState().loadProject({...p,id:'new-during-save'}));await act(async()=>{useEditor.getState().notify('새 작업 알림');progress('OLD ZIP PROGRESS');});expect(useEditor.getState().message).toBe('새 작업 알림');await act(async()=>save.resolve());expect(useEditor.getState().project.id).toBe('new-during-save');expect(useEditor.getState().message).toBe('새 작업 알림');expect(downloadBlob).not.toHaveBeenCalled();
});

it('restores a ZIP as a new saved local project and backs up the latest original draft',async()=>{
 const next=imported(),job=deferred<Project>();vi.mocked(readProjectBackup).mockImplementationOnce(()=>job.promise);await upload('backup');await act(async()=>useEditor.getState().renameProject('처리 중 추가 수정'));await act(async()=>job.resolve(next));await waitMessage('새 항목으로');const restored=useEditor.getState().project;expect(restored.id).not.toBe(next.id);expect(restored).toEqual({...next,id:restored.id});expect((await library.read(restored.id))?.project).toEqual(restored);expect((await library.read(p.id))?.project.name).toBe('처리 중 추가 수정');expect(await library.activeId()).toBe(restored.id);expect(downloadBlob).toHaveBeenCalledTimes(1);const [blob,name]=vi.mocked(downloadBlob).mock.calls[0];expect(name).toBe('처리 중 추가 수정-이전작업.json');expect(JSON.parse(await blob.text())).toMatchObject({id:p.id,name:'처리 중 추가 수정',note:'PRIVATE_ORIGINAL'});
});

it('never announces a successful restore before the new project write settles',async()=>{
 const save=saveGate();writer.mockImplementation(async value=>{if(value.id!==p.id)await save.promise;await writeDraft(value);});await upload('backup');await vi.waitFor(()=>expect(writer.mock.calls.some(([value])=>value.id!==p.id)).toBe(true));const id=useEditor.getState().project.id;expect(useEditor.getState().message??'').not.toContain('새 항목으로');expect(container.querySelector<HTMLButtonElement>('button[aria-label="불러오는 중"]')?.disabled).toBe(true);await act(async()=>save.resolve());await waitMessage('새 항목으로');expect((await library.read(id))?.project).toEqual(useEditor.getState().project);
});

it('routes a plan to its existing workflow and rejects SKP honestly without replacing any project',async()=>{
 const file=new File(['image'],'도면.JPG',{type:'image/jpeg'});await upload('plan',file);expect(plan).toHaveBeenCalledWith(file);expect(readModelFile).not.toHaveBeenCalled();expect(readProjectBackup).not.toHaveBeenCalled();const before=useEditor.getState().project;await upload('model',new File(['skp'],'원본.skp'));expect(useEditor.getState().message).toContain('아직 지원하지 않습니다');expect(useEditor.getState().project).toBe(before);expect(downloadBlob).not.toHaveBeenCalled();
});

it('loads a real full-venue GLB with actual bounds and source bytes through the Header',async()=>{
 const actual=await vi.importActual<typeof import('../lib/modelImport')>('../lib/modelImport');vi.mocked(readModelFile).mockImplementation(actual.readModelFile);
 class Reader {result:unknown;onload?:(()=>void);onerror?:(()=>void);readAsDataURL(blob:Blob){void blob.arrayBuffer().then(bytes=>{this.result='data:model/gltf-binary;base64,'+Buffer.from(bytes).toString('base64');this.onload?.();});}}
 vi.stubGlobal('FileReader',Reader);const bytes=venueTestGlb(),before=structuredClone(useEditor.getState().project);await upload('model',new File([bytes],'전시장 전체.glb',{type:'model/gltf-binary'}));await waitMessage('3D 참고 모델');const model=useEditor.getState().project.referenceModel!;expect(model.sizeMm).toEqual([expect.closeTo(12000),expect.closeTo(3000),expect.closeTo(8000)]);expect(model.sourceOffsetM).toEqual([expect.closeTo(-10),expect.closeTo(-2),expect.closeTo(-5)]);expect(model.scale).toBe(1);expect(model.positionMm).toEqual([0,0,0]);expect(Buffer.from(model.dataUrl.split(',')[1],'base64')).toEqual(Buffer.from(bytes));expect(useEditor.getState().project.walls).toEqual(before.walls);expect(useEditor.getState().project.artworks).toEqual(before.artworks);expect(useEditor.getState().view).toBe('3d');expect(useEditor.getState().past).toHaveLength(1);await act(async()=>useEditor.getState().undo());expect(useEditor.getState().project).toEqual(before);
});

it('retains edits made while the original draft is saving and does not replace or download it',async()=>{
 const save=saveGate();writer.mockImplementationOnce(async value=>{await save.promise;await writeDraft(value);});await upload('backup');await vi.waitFor(()=>expect(writer).toHaveBeenCalled());await act(async()=>useEditor.getState().renameProject('저장 중 새 수정'));await act(async()=>save.resolve());await waitMessage('작업이 변경');expect(useEditor.getState().project.id).toBe(p.id);expect(useEditor.getState().project.name).toBe('저장 중 새 수정');expect(downloadBlob).not.toHaveBeenCalled();
});

it('keeps the original local project and reports failure when the restored copy cannot be saved',async()=>{
 writer.mockImplementation(async value=>{if(value.id!==p.id)throw new Error('새 항목 저장 공간 부족');await writeDraft(value);});await upload('backup');await waitMessage('저장 공간 부족');const state=useEditor.getState();expect(state.project.id).not.toBe(p.id);expect(state.project.name).toBe('받은 전시');expect(state.saveStatus).toBe('error');expect((await library.read(p.id))?.project).toEqual(p);expect(await library.read(state.project.id)).toBeUndefined();expect(await library.activeId()).toBe(p.id);expect(state.message).not.toContain('새 항목으로');expect(downloadBlob).toHaveBeenCalledTimes(1);
});

function nativeImages(){
 class ImageAdapter {native?:NativeImage;naturalWidth=0;naturalHeight=0;onload:(()=>void)|null=null;onerror:(()=>void)|null=null;set src(value:string){if(!value)return;void loadImage(value).then(image=>{this.native=image;this.naturalWidth=image.width;this.naturalHeight=image.height;this.onload?.();},()=>this.onerror?.());}}
 vi.stubGlobal('Image',ImageAdapter);
 const canvas=createCanvas(32,16),ctx=canvas.getContext('2d');ctx.fillStyle='#ff0000';ctx.fillRect(0,0,32,16);return canvas.toDataURL('image/png');
}

it.each(['zip','json'] as const)('restores real %s bytes and native decoded images, model and Scene into actual IndexedDB',async kind=>{
 const imageUrl=nativeImages(),next=imported();for(const a of next.artworks)a.imageUrl=imageUrl;for(const s of next.scenes)for(const a of s.artworks)a.imageUrl=imageUrl;
 const actual=await vi.importActual<typeof import('../lib/projectBackup')>('../lib/projectBackup');vi.mocked(readProjectBackup).mockImplementation(actual.readProjectBackup);
 const blob=kind==='zip'?await exportProjectPackage(next,async()=>{throw new Error('예제 자산 참조가 없는 입력입니다.');}):new Blob([JSON.stringify(next)],{type:'application/json'});await upload('backup',new File([await blob.arrayBuffer()],`전시.${kind}`));await waitMessage('새 항목으로');const restored=useEditor.getState().project;expect(restored).toEqual({...next,id:restored.id});expect((await library.read(restored.id))?.project).toEqual(restored);expect(await library.activeId()).toBe(restored.id);expect(restored.artworks[0].imageUrl).toBe(imageUrl);expect(restored.scenes[0].artworks[0].imageUrl).toBe(imageUrl);expect(restored.referenceModel?.dataUrl).toBe(next.referenceModel?.dataUrl);expect(restored.scenes[0].structure?.referenceModel?.dataUrl).toBe(next.scenes[0].structure?.referenceModel?.dataUrl);expect(restored.note).toBe('PRIVATE_IMPORTED_NOTE');expect(downloadBlob).toHaveBeenCalledTimes(1);expect((await library.read(p.id))?.project).toEqual(p);
});

it('rejects a JSON with undecodable image bytes before replacing or backing up the current project',async()=>{
 nativeImages();const next=imported();next.artworks[0].imageUrl='data:image/png;base64,iVBORw0KGgo=';await upload('backup',new File([JSON.stringify(next)],'손상 프로젝트.json'));await waitMessage('이미지를 읽지 못');expect(useEditor.getState().project.id).toBe(p.id);expect(downloadBlob).not.toHaveBeenCalled();expect((await library.list())).toHaveLength(1);
});

it('does not restore a JSON whose file text arrives after batched A→B→A',async()=>{
 const text=deferred<string>(),file=new File(['fixture'],'지연.json');Object.defineProperty(file,'text',{value:()=>text.promise});await upload('backup',file);await act(async()=>{useEditor.getState().loadProject({...p,id:'json-other-project'});useEditor.getState().loadProject(p);useEditor.getState().notify('JSON 이후 새 작업');});const before=useEditor.getState().project;await act(async()=>text.resolve(JSON.stringify(imported())));expect(useEditor.getState().project).toBe(before);expect(useEditor.getState().message).toBe('JSON 이후 새 작업');expect(downloadBlob).not.toHaveBeenCalled();
});

it('does not start decoding during an active transform or apply a model if a transform starts while decoding',async()=>{
 await act(async()=>useEditor.setState({previewProject:{...p}}));await upload('model');expect(readModelFile).not.toHaveBeenCalled();expect(useEditor.getState().message).toContain('이동·회전을 마친');await act(async()=>useEditor.setState({previewProject:null}));const job=deferred<Awaited<ReturnType<typeof readModelFile>>>();vi.mocked(readModelFile).mockImplementationOnce(()=>job.promise);await upload('model');const before=useEditor.getState().project;await act(async()=>useEditor.setState({previewProject:{...before}}));await act(async()=>job.resolve(testVenueModel()));expect(useEditor.getState().project).toBe(before);expect(useEditor.getState().message).toContain('이동·회전을 마친');expect(useEditor.getState().project.referenceModel).toBeUndefined();
});
