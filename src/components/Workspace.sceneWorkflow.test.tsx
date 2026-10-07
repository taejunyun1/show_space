// @vitest-environment jsdom
import {act,useEffect,StrictMode} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {Workspace} from './Workspace';
import {LengthUnitContext} from './LengthUnits';
import {useEditor} from '../state/editor';
import {createDemoProject} from '../domain/model';
import {renderSceneThumbnail,thumbnailFromBlob} from '../lib/sceneThumbnail';
import {captureSvg} from '../lib/captureSvg';
import {downloadBlob} from '../lib/art';
import type {Project,SceneThumbnail} from '../domain/types';
import type {CameraView3D} from './cameraView3d';

vi.mock('../lib/sceneThumbnail',()=>({renderSceneThumbnail:vi.fn(),thumbnailFromBlob:vi.fn()}));
vi.mock('../lib/captureSvg',async original=>({...await original<typeof import('../lib/captureSvg')>(),captureSvg:vi.fn()}));
vi.mock('../lib/art',async original=>({...await original<typeof import('../lib/art')>(),downloadBlob:vi.fn()}));
// Only the GPU transport and unrelated plan importer are replaced. Scene controls,
// restore/undo, actual elevation SVG and capture dialog are production components.
const adapter=vi.hoisted(()=>({camera:{position:[1,2,3],target:[0,1,0],zoom:40,projection:'orthographic'} as CameraView3D,requests:[] as CameraView3D[],capture:vi.fn(),ready:true}));
vi.mock('./Gallery3D',()=>({Gallery3D:({onCameraReady,onCameraApplied,cameraRequest,onCaptureReady}:{onCameraReady:(get:(()=>CameraView3D)|null)=>void;onCameraApplied:(token:number)=>void;cameraRequest:{token:number;view:CameraView3D}|null;onCaptureReady:(capture:typeof adapter.capture)=>void|(()=>void)})=>{
 useEffect(()=>{if(!adapter.ready)return;onCameraReady(()=>adapter.camera);const unregister=onCaptureReady(adapter.capture);return()=>{onCameraReady(null);unregister?.();};},[onCameraReady,onCaptureReady]);
 useEffect(()=>{if(cameraRequest){adapter.camera=structuredClone(cameraRequest.view);adapter.requests.push(adapter.camera);onCameraApplied(cameraRequest.token);}},[cameraRequest,onCameraApplied]);
 return <canvas/>;
}}));
vi.mock('./PlanView',()=>({PlanView:()=> <div className="drawing-view"><svg viewBox="0 0 800 600"/></div>}));
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=';
const thumbnail:SceneThumbnail={imageUrl:png,widthPx:1,heightPx:1,view:'3d'};
type Pending={source:Project;signal:AbortSignal;resolve:(value:SceneThumbnail)=>void;reject:(error:Error)=>void};
let root:Root,container:HTMLDivElement,p:Project,pending:Pending[];
const captureRef={current:null as (()=>void)|null},cameraGetterRef={current:null as (()=>CameraView3D)|null};
async function click(label:string){const button=[...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===label||b.getAttribute('aria-label')===label)!;expect(button).toBeDefined();await act(async()=>button.click());}
async function name(value:string){const input=container.querySelector<HTMLInputElement>('input[aria-label="Scene 이름"]')!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});}
async function save(label='Scene A'){await name(label);await click('현재 Scene 저장');}
const saveButton=()=>container.querySelector<HTMLButtonElement>('button[aria-label="현재 Scene 저장"]')!;
beforeEach(async()=>{
 (globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.open=true;}});
 Object.defineProperty(SVGElement.prototype,'viewBox',{configurable:true,get(){const values=this.getAttribute('viewBox')!.split(/[ ,]+/).map(Number);return {baseVal:{x:values[0],y:values[1],width:values[2],height:values[3]}};}});
 vi.stubGlobal('ResizeObserver',class {observe(){}disconnect(){}});
 vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue({width:800,height:600,x:0,y:0,top:0,left:0,right:800,bottom:600,toJSON:()=>({})});
 pending=[];vi.mocked(renderSceneThumbnail).mockImplementation((source,_camera,signal)=>new Promise((resolve,reject)=>pending.push({source,signal,resolve,reject})));
 vi.mocked(thumbnailFromBlob).mockResolvedValue({...thumbnail,view:'elevation'});
 vi.mocked(captureSvg).mockResolvedValue(new Blob(['png'],{type:'image/png'}));adapter.capture.mockResolvedValue(new Blob(['3d'],{type:'image/png'}));adapter.requests=[];adapter.ready=true;
 adapter.camera={position:[1,2,3],target:[0,1,0],zoom:40,projection:'orthographic'};
 p=createDemoProject();p.scenes=[];p.artworks=p.artworks.slice(0,2);useEditor.getState().loadProject(p);useEditor.getState().setView('3d');
 container=document.createElement('div');document.body.append(container);root=createRoot(container);
 await act(async()=>root.render(<StrictMode><LengthUnitContext.Provider value="mm"><Workspace incomingPlan={null} onPlanReceived={()=>{}} captureRef={captureRef} cameraGetterRef={cameraGetterRef}/></LengthUnitContext.Provider></StrictMode>));
 await click('Scene ');
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.restoreAllMocks();vi.clearAllMocks();vi.unstubAllGlobals();});

it('saves the captured layout while preserving edits made during rendering, restores its camera, and captures it',async()=>{
 const source=structuredClone(useEditor.getState().project),camera=structuredClone(adapter.camera);await save('첫 배치');
 await act(async()=>useEditor.getState().patchArtwork(p.artworks[0].id,{alongMm:2100}));const edited=structuredClone(useEditor.getState().project);await name('다음 배치');
 await act(async()=>pending[0].resolve(thumbnail));const saved=useEditor.getState().project;expect(saved.artworks).toEqual(edited.artworks);expect(saved.scenes[0].artworks).toEqual(source.artworks);expect(saved.scenes[0].cameraView).toEqual(camera);expect(saved.scenes[0].thumbnail).toEqual(thumbnail);expect(container.querySelector<HTMLInputElement>('input[aria-label="Scene 이름"]')!.value).toBe('다음 배치');
 const sceneButton=container.querySelector<HTMLButtonElement>('.scene-open')!;await act(async()=>sceneButton.click());expect(useEditor.getState().project.artworks).toEqual(source.artworks);expect(adapter.requests.at(-1)).toEqual(camera);
 await click('현재 화면 캡처');await click('PNG 저장');expect(adapter.capture).toHaveBeenCalledWith(expect.objectContaining({longEdge:1920,includeDimensions:true,includeGrid:true}));expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob),`${p.name}-3D.png`);expect(container.querySelector('dialog')).toBeNull();
 await act(async()=>useEditor.getState().undo());expect(useEditor.getState().project.artworks).toEqual(edited.artworks);await act(async()=>useEditor.getState().redo());expect(useEditor.getState().project.artworks).toEqual(source.artworks);
});

it('does not let a cancelled preview attach a Scene or clear a newer save',async()=>{
 await save('취소할 배치');await click('취소');expect(pending[0].signal.aborted).toBe(true);await save('남길 배치');await act(async()=>pending[0].resolve(thumbnail));expect(useEditor.getState().project.scenes).toHaveLength(0);expect(saveButton().disabled).toBe(true);await act(async()=>pending[1].resolve(thumbnail));expect(useEditor.getState().project.scenes.map(s=>s.name)).toEqual(['남길 배치']);expect(useEditor.getState().past).toHaveLength(1);
});

it('invalidates a Scene preview even when project A→B→A is batched into one render',async()=>{
 await save();await act(async()=>{useEditor.getState().loadProject({...p,id:'temporary-project'});useEditor.getState().loadProject(p);});expect(pending[0].signal.aborted).toBe(true);const before=useEditor.getState().project;await act(async()=>pending[0].resolve(thumbnail));expect(useEditor.getState().project).toBe(before);expect(useEditor.getState().past).toHaveLength(0);expect(saveButton().disabled).toBe(false);
});

it('lets a new project save without late errors or completion from an abandoned save',async()=>{
 await save('이전 전시');await act(async()=>useEditor.getState().loadProject({...p,id:'new-project',name:'새 전시'}));await save('새 전시 배치');await act(async()=>useEditor.getState().notify('새 작업'));await act(async()=>pending[0].reject(new Error('이전 렌더 오류')));expect(useEditor.getState().message).toBe('새 작업');expect(saveButton().disabled).toBe(true);await act(async()=>pending[1].resolve(thumbnail));expect(useEditor.getState().project.scenes.map(s=>s.name)).toEqual(['새 전시 배치']);
});

it('preserves the layout without a preview when the current renderer fails',async()=>{
 await save('미리보기 실패');await act(async()=>pending[0].reject(new Error('GPU unavailable')));expect(useEditor.getState().project.scenes[0].name).toBe('미리보기 실패');expect(useEditor.getState().project.scenes[0].thumbnail).toBeUndefined();expect(useEditor.getState().message).toContain('배치안은 저장');expect(saveButton().disabled).toBe(false);
});

it('aborts a Scene save on unmount and ignores late failure',async()=>{
 await save();const before=useEditor.getState().project;await act(async()=>root.unmount());expect(pending[0].signal.aborted).toBe(true);await act(async()=>useEditor.getState().notify('화면 이동'));await act(async()=>pending[0].reject(new Error('지난 작업')));expect(useEditor.getState().project).toBe(before);expect(useEditor.getState().message).toBe('화면 이동');expect(captureRef.current).toBeNull();expect(cameraGetterRef.current).toBeNull();
});

it('saves the actual elevation SVG without a 3D camera and prevents duplicate saves',async()=>{
 await act(async()=>useEditor.getState().setView('elevation'));await save('벽면 배치');expect(captureSvg).toHaveBeenCalledWith(container.querySelector('.elevation>svg'),expect.objectContaining({longEdge:320,includeDimensions:false,includeGrid:false}));expect(renderSceneThumbnail).not.toHaveBeenCalled();expect(thumbnailFromBlob).toHaveBeenCalledWith(expect.any(Blob),'elevation',expect.any(AbortSignal));expect(useEditor.getState().project.scenes[0].cameraView).toBeUndefined();expect(useEditor.getState().project.scenes[0].thumbnail?.view).toBe('elevation');
 await act(async()=>useEditor.getState().setView('3d'));await save('중복 방지');await click('현재 Scene 저장');expect(renderSceneThumbnail).toHaveBeenCalledTimes(1);await act(async()=>pending[0].resolve(thumbnail));expect(useEditor.getState().project.scenes).toHaveLength(2);
});

it('does not save while hydration or a detached Scene preview is active',async()=>{
 await act(async()=>useEditor.setState({hydrated:false}));expect(saveButton().disabled).toBe(true);await click('현재 Scene 저장');expect(renderSceneThumbnail).not.toHaveBeenCalled();await act(async()=>useEditor.setState({hydrated:true,previewProject:p}));expect(saveButton().disabled).toBe(true);await click('현재 Scene 저장');expect(renderSceneThumbnail).not.toHaveBeenCalled();
});


it.each(['project','view','edit'] as const)('discards an encoded capture after a %s transition without closing a newer dialog',async transition=>{
 let finish!:(blob:Blob)=>void;adapter.capture.mockImplementationOnce(()=>new Promise(resolve=>finish=resolve));await click('현재 화면 캡처');await click('PNG 저장');
 await act(async()=>{
  if(transition==='project'){useEditor.getState().loadProject({...p,id:'capture-other-project'});useEditor.getState().loadProject(p);}
  else if(transition==='view'){useEditor.getState().setView('elevation');useEditor.getState().setView('3d');}
  else useEditor.getState().patchArtwork(p.artworks[0].id,{alongMm:2400});
 });
 if(transition!=='edit'){expect(container.querySelector('dialog')).toBeNull();await click('현재 화면 캡처');}
 const before=useEditor.getState().project;await act(async()=>finish(new Blob(['old png'])));expect(downloadBlob).not.toHaveBeenCalled();expect(container.querySelector('dialog[open]')).not.toBeNull();expect(useEditor.getState().project).toBe(before);
 if(transition==='edit')expect(container.querySelector('[role="alert"]')?.textContent).toContain('변경');
 await click('PNG 저장');expect(downloadBlob).toHaveBeenCalledTimes(1);expect(container.querySelector('dialog')).toBeNull();
});

it('drops a capture after the workspace unmounts',async()=>{
 let finish!:(blob:Blob)=>void;adapter.capture.mockImplementationOnce(()=>new Promise(resolve=>finish=resolve));await click('현재 화면 캡처');await click('PNG 저장');const before=useEditor.getState().project;await act(async()=>root.unmount());await act(async()=>finish(new Blob(['old png'])));expect(downloadBlob).not.toHaveBeenCalled();expect(useEditor.getState().project).toBe(before);
});

it('captures its own actual elevation SVG when another viewport is in the document',async()=>{
 const other=document.createElement('div');other.innerHTML='<div class="viewport-stage"><div class="elevation"><svg viewBox="0 0 30 20"/></div></div>';document.body.prepend(other);
 try{await act(async()=>useEditor.getState().setView('elevation'));await click('현재 화면 캡처');await click('PNG 저장');expect(captureSvg).toHaveBeenCalledWith(container.querySelector('.elevation>svg'),expect.objectContaining({longEdge:1920}));expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob),`${p.name}-벽면도.png`);}
 finally{other.remove();}
});

it('clears a disposed GPU capture adapter before reentering a loading 3D view',async()=>{
 await act(async()=>useEditor.getState().setView('elevation'));adapter.ready=false;await act(async()=>useEditor.getState().setView('3d'));await click('현재 화면 캡처');await click('PNG 저장');expect(adapter.capture).not.toHaveBeenCalled();expect(downloadBlob).not.toHaveBeenCalled();expect(container.querySelector('[role="alert"]')?.textContent).toContain('3D 화면을 불러온');
});
