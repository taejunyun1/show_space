// @vitest-environment jsdom
import {act,StrictMode} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {File as NodeFile,Blob as NodeBlob} from 'node:buffer';
import {readFile} from 'node:fs/promises';
import {ReferenceModelControls} from './ReferenceModelControls';
import {useEditor} from '../state/editor';
import {createDemoProject} from '../domain/model';
import {testVenueModel} from '../lib/venueModelTestFixture';
import {readModelFile,readModelWalls} from '../lib/modelImport';
import {downloadBlob} from '../lib/art';
import type {Project} from '../domain/types';
vi.mock('../lib/modelImport',async original=>({...await original<typeof import('../lib/modelImport')>(),readModelWalls:vi.fn()}));
vi.mock('../lib/art',async original=>({...await original<typeof import('../lib/art')>(),downloadBlob:vi.fn()}));
vi.mock('./NoteEditor',()=>({NoteEditor:()=>null}));
let p:Project,root:Root,container:HTMLDivElement;
let settle:Array<()=>void>=[];
const result=()=>({walls:[{...p.walls[0],id:'converted-wall'}],triangles:12});
function deferred(){let resolve!:(value:ReturnType<typeof result>)=>void,reject!:(error:Error)=>void;const promise=new Promise<ReturnType<typeof result>>((r,j)=>{resolve=r;reject=j;});settle.push(()=>resolve(result()));return {promise,resolve,reject};}
const button=()=>[...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>/모델 벽으로 공간|벽 형상 분석/.test(b.textContent??''))!;
async function click(){await act(async()=>button().click());}
async function finish(job:ReturnType<typeof deferred>){await act(async()=>job.resolve(result()));}
beforeEach(async()=>{
 vi.resetAllMocks();settle=[];(globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
 vi.stubGlobal('ArrayBuffer',(await new NodeBlob([]).arrayBuffer()).constructor);vi.stubGlobal('Uint8Array',Object.getPrototypeOf(Buffer.prototype).constructor);vi.stubGlobal('File',NodeFile);vi.stubGlobal('Blob',NodeBlob);
 vi.stubGlobal('FileReader',class{result:unknown;onload?:()=>void;readAsDataURL(blob:Blob){void blob.arrayBuffer().then(b=>{this.result='data:model/gltf-binary;base64,'+Buffer.from(b).toString('base64');this.onload?.();});}});
 p={...createDemoProject(),id:'model-controls-'+crypto.randomUUID(),referenceModel:testVenueModel(),scenes:[]};useEditor.getState().loadProject(p,true);vi.mocked(readModelWalls).mockResolvedValue(result());
 container=document.createElement('div');document.body.append(container);root=createRoot(container);await act(async()=>root.render(<StrictMode><ReferenceModelControls/></StrictMode>));
});
afterEach(async()=>{await act(async()=>root.unmount());await act(async()=>{settle.forEach(f=>f());});container.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('ignores a result after a batched project A→B→A, including backup and notification',async()=>{
 const job=deferred();vi.mocked(readModelWalls).mockReturnValueOnce(job.promise);await click();await act(async()=>{useEditor.getState().loadProject({...p,id:'other'});useEditor.getState().loadProject(p);useEditor.getState().notify('새 알림');});const before=useEditor.getState().project;await finish(job);expect(useEditor.getState().project).toBe(before);expect(useEditor.getState().message).toBe('새 알림');expect(downloadBlob).not.toHaveBeenCalled();
});
it('ignores a result after a batched model transform A→B→A',async()=>{
 const job=deferred();vi.mocked(readModelWalls).mockReturnValueOnce(job.promise);await click();await act(async()=>{useEditor.getState().patchProject({referenceModel:{...p.referenceModel!,rotationDeg:30}});useEditor.getState().patchProject({referenceModel:p.referenceModel});});const before=useEditor.getState().project;await finish(job);expect(useEditor.getState().project).toBe(before);expect(downloadBlob).not.toHaveBeenCalled();
});
it('retires extraction after a wall edit and undo even when the original space returns',async()=>{
 const job=deferred();vi.mocked(readModelWalls).mockReturnValueOnce(job.promise);await click();await act(async()=>{useEditor.getState().patchWall(p.walls[0].id,{heightMm:p.walls[0].heightMm+100});useEditor.getState().undo();});const before=useEditor.getState().project;await finish(job);expect(useEditor.getState().project).toBe(before);expect(downloadBlob).not.toHaveBeenCalled();
});
it('keeps a new notification when a failed extraction arrives after unmount',async()=>{
 const job=deferred();vi.mocked(readModelWalls).mockReturnValueOnce(job.promise);await click();await act(async()=>root.unmount());await act(async()=>useEditor.getState().notify('다른 화면'));await act(async()=>job.reject(new Error('OLD_ERROR')));expect(useEditor.getState().message).toBe('다른 화면');expect(downloadBlob).not.toHaveBeenCalled();
});
it('starts only one extraction for two clicks before React renders',async()=>{
 const job=deferred();vi.mocked(readModelWalls).mockReturnValue(job.promise);const b=button();await act(async()=>{b.click();b.click();});expect(readModelWalls).toHaveBeenCalledTimes(1);await finish(job);expect(downloadBlob).toHaveBeenCalledTimes(1);
});
it('allows the new model job and ignores the earlier rejection/finally',async()=>{
 const old=deferred(),next=deferred();vi.mocked(readModelWalls).mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);await click();await act(async()=>useEditor.getState().patchProject({referenceModel:{...p.referenceModel!,rotationDeg:30}}));expect(button().disabled).toBe(false);await click();await act(async()=>old.reject(new Error('OLD_ERROR')));expect(button().disabled).toBe(true);expect(useEditor.getState().message).not.toBe('OLD_ERROR');await finish(next);expect(downloadBlob).toHaveBeenCalledTimes(1);
});
it('does not replace a new pointer gesture while extraction is pending',async()=>{
 const job=deferred();vi.mocked(readModelWalls).mockReturnValueOnce(job.promise);await click();await act(async()=>useEditor.setState({previewProject:structuredClone(p)}));const before=useEditor.getState().project,preview=useEditor.getState().previewProject;await finish(job);expect(useEditor.getState().project).toBe(before);expect(useEditor.getState().previewProject).toBe(preview);expect(downloadBlob).not.toHaveBeenCalled();expect(useEditor.getState().message).toContain('이동·회전');
});
it('does not adopt into another project if the backup download switches the editor',async()=>{
 vi.mocked(downloadBlob).mockImplementationOnce(()=>useEditor.getState().loadProject({...p,id:'after-backup'}));await click();expect(useEditor.getState().project.id).toBe('after-backup');expect(useEditor.getState().project.walls).toEqual(p.walls);expect(useEditor.getState().project.referenceModel?.visible).toBe(true);expect(downloadBlob).toHaveBeenCalledTimes(1);
});
it('backs up the latest draft and keeps edits and legacy Scenes in one undoable adoption',async()=>{
 await act(async()=>useEditor.getState().loadProject({...p,scenes:[{id:'legacy',name:'이전 Scene',artworks:structuredClone(p.artworks),wallVisibility:Object.fromEntries(p.walls.map(w=>[w.id,true]))}]},true));
 const job=deferred();vi.mocked(readModelWalls).mockReturnValueOnce(job.promise);await act(async()=>useEditor.getState().patchProject({venue:'old venue'}));await click();await act(async()=>{useEditor.getState().renameProject('추가 편집');useEditor.getState().patchProject({venue:'latest venue'});});const before=useEditor.getState().project;await finish(job);const next=useEditor.getState().project;expect(next.venue).toBe('latest venue');expect(next.artworks).toEqual([]);expect(next.unplacedArtworks).toHaveLength(p.artworks.length);expect(next.referenceModel?.visible).toBe(false);expect(next.scenes[0].structure?.walls).toEqual(before.walls);expect(JSON.parse(await vi.mocked(downloadBlob).mock.calls[0][0].text())).toEqual(before);await act(async()=>useEditor.getState().undo());expect(useEditor.getState().project).toEqual(before);
});
it('preserves the entire actual 30-room venue when only partial walls and no usable floor are found',async()=>{
 const bytes=new Uint8Array(await readFile('docs/validation/model-preflight-2026-10-11/venue.glb')),model=await readModelFile(new File([bytes],'whole-venue.glb'));await act(async()=>useEditor.getState().patchProject({referenceModel:model}));const actual=await vi.importActual<typeof import('../lib/modelImport')>('../lib/modelImport');vi.mocked(readModelWalls).mockImplementation(actual.readModelWalls);const before=useEditor.getState().project;await click();await act(async()=>{await vi.waitFor(()=>expect(button().disabled).toBe(false));});expect(useEditor.getState().project).toBe(before);expect(useEditor.getState().project.referenceModel?.visible).toBe(true);expect(useEditor.getState().message).toContain('바닥');expect(downloadBlob).not.toHaveBeenCalled();
});
