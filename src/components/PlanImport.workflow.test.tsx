// @vitest-environment jsdom
import {act,StrictMode} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {PlanImportDialog} from './PlanImportDialog';
import {PlanView} from './PlanView';
import {PlanRegionEditor} from './PlanRegionEditor';
import {LengthUnitContext} from './LengthUnits';
import {useEditor} from '../state/editor';
import {createDemoProject,parseProject,wallLength} from '../domain/model';
import {loadPlanFile,type PlanFile,type PlanPage} from '../lib/planImport';
import {transformPlan} from '../lib/planTransform';
import {analyzePlan} from '../lib/analyzePlan';
import {selectPlanPage} from '../lib/selectPlanPage';
import {createCanvas,loadImage,Image as NativeImage,type Canvas} from '@napi-rs/canvas';
import {File as NodeFile} from 'node:buffer';

vi.mock('../lib/planImport',async original=>({...await original<typeof import('../lib/planImport')>(),loadPlanFile:vi.fn()}));
vi.mock('../lib/analyzePlan',()=>({analyzePlan:vi.fn()}));
vi.mock('../lib/readPlanOcr',()=>({readPlanOcr:vi.fn(async()=>[])}));
vi.mock('../lib/selectPlanPage',()=>({selectPlanPage:vi.fn()}));
vi.mock('../lib/planTransform',async original=>({...await original<typeof import('../lib/planTransform')>(),transformPlan:vi.fn()}));
// Replace only the browser Worker transport; execute both production pixel
// algorithms with the same message fields as their real worker entrypoints.
vi.mock('../lib/wallDetection.worker?worker',async()=>{
 const {detectWallCandidates}=await import('../domain/wallCandidates');
 return {default:class {onmessage:((event:unknown)=>void)|null=null;onerror=null;stopped=false;terminate(){this.stopped=true;}postMessage(input:{data:ArrayBuffer;width:number;height:number;threshold:number;minLengthPx:number;minThicknessPx:number;maxCandidates:number}){queueMicrotask(()=>{if(!this.stopped)this.onmessage?.({data:{candidates:detectWallCandidates(new Uint8ClampedArray(input.data),input.width,input.height,input)}});});}}};
});
vi.mock('../lib/signDetection.worker?worker',async()=>{
 const {pageSignSymbols}=await import('../domain/pageSignSymbols');
 return {default:class {onmessage:((event:unknown)=>void)|null=null;onerror=null;stopped=false;terminate(){this.stopped=true;}postMessage(input:{data:ArrayBuffer;width:number;height:number}){queueMicrotask(()=>{if(!this.stopped)this.onmessage?.({data:{symbols:pageSignSymbols(new Uint8ClampedArray(input.data),input.width,input.height)}});});}}};
});
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=';
function page(url=png):PlanPage{return {imageUrl:url,widthPx:1000,heightPx:800,textSource:'pdf-text',labels:[],analysis:{textState:'complete',lineState:'complete',numericCount:0,issues:[],selfCheck:{status:'withheld',attempts:2},lines:[{id:'top',start:{x:100,y:100},end:{x:900,y:100},thicknessPx:5},{id:'right',start:{x:900,y:100},end:{x:900,y:700},thicknessPx:5}]}};}
function loaded(input=page(),count=1):PlanFile{return {pageCount:count,renderPage:vi.fn(async()=>input),destroy:vi.fn(async()=>{})};}
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};}
let root:Root,container:HTMLDivElement,source:File;
const close=vi.fn(),adopt=vi.fn(),place=vi.fn(),busy=vi.fn(),changed=vi.fn(),received=vi.fn();
async function renderDialog(file=source){await act(async()=>root.render(<StrictMode><PlanImportDialog file={file} existingProject={useEditor.getState().project} onClose={close} onAdopt={adopt} onImport={place}/></StrictMode>));}
async function renderPlan(file:File|null=source){await act(async()=>root.render(<StrictMode><LengthUnitContext.Provider value="cm"><PlanView incomingFile={file} onFileReceived={received}/></LengthUnitContext.Provider></StrictMode>));}
async function click(label:string){const b=[...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.trim()===label||b.getAttribute('aria-label')===label)!;expect(b).toBeDefined();await act(async()=>b.click());}
async function change(label:string,value:string){const input=container.querySelector<HTMLInputElement|HTMLSelectElement>(`[aria-label="${label}"]`)!;expect(input).not.toBeNull();await act(async()=>{Object.getOwnPropertyDescriptor(input instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event(input instanceof HTMLSelectElement?'change':'input',{bubbles:true}));});}
async function number(label:string,value:string){const input=container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;await act(async()=>input.focus());await change(label,value);await act(async()=>input.blur());}
beforeEach(()=>{
 vi.resetAllMocks();
 (globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.open=true;}});
 useEditor.getState().loadProject({...createDemoProject(),id:'plan-workflow',name:'입력 전시',displayUnit:'cm'});source=new File(['fixture'],'평면도.jpg',{type:'image/jpeg'});
 vi.mocked(loadPlanFile).mockImplementation(async()=>loaded());vi.mocked(analyzePlan).mockImplementation(async p=>({...p,analysis:page().analysis}));
 vi.mocked(transformPlan).mockImplementation(async p=>({...p,imageUrl:'rotated',widthPx:p.heightPx,heightPx:p.widthPx}));
 container=document.createElement('div');document.body.append(container);root=createRoot(container);
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.restoreAllMocks();vi.clearAllMocks();vi.unstubAllGlobals();});

it('closes an old import on project A→B→A and prevents either placement or adoption',async()=>{
 await renderDialog();await act(async()=>{const p=useEditor.getState().project;useEditor.getState().loadProject({...p,id:'other-plan-project'});useEditor.getState().loadProject(p);});await click('이 도면 배치');await click('벽 초안으로 편집 시작');expect(close).toHaveBeenCalledTimes(1);expect(place).not.toHaveBeenCalled();expect(adopt).not.toHaveBeenCalled();expect(useEditor.getState().past).toHaveLength(0);
});

it('clears the previous file preview while a replacement decoder is pending',async()=>{
 await renderDialog();const old=container.querySelector('img.plan-import-preview')!.getAttribute('src'),job=deferred<PlanFile>();vi.mocked(loadPlanFile).mockImplementationOnce(()=>job.promise);await renderDialog(new File(['new'],'새 도면.png',{type:'image/png'}));expect(container.querySelector('img.plan-import-preview')).toBeNull();expect([...container.querySelectorAll('button')].find(b=>b.textContent==='이 도면 배치')!.disabled).toBe(true);expect(container.textContent).not.toContain('구조선 후보 2개');const next=loaded(page('new-plan'));await act(async()=>job.resolve(next));await click('이 도면 배치');expect(place).toHaveBeenCalledWith(expect.objectContaining({imageUrl:'new-plan'}));expect(old).toBe(png);
});

it('does not leave the previous file available when the replacement fails',async()=>{
 await renderDialog();vi.mocked(loadPlanFile).mockRejectedValueOnce(new Error('새 파일 decode 실패'));await renderDialog(new File(['broken'],'손상.jpg',{type:'image/jpeg'}));expect(container.querySelector('[role="alert"]')?.textContent).toContain('새 파일 decode 실패');await click('이 도면 배치');expect(place).not.toHaveBeenCalled();expect(container.querySelector('img.plan-import-preview')).toBeNull();
});

it('disposes a document arriving after unmount and never renders it',async()=>{
 const jobs:Array<ReturnType<typeof deferred<PlanFile>>>=[];vi.mocked(loadPlanFile).mockImplementation(()=>{const job=deferred<PlanFile>();jobs.push(job);return job.promise;});await renderDialog();await act(async()=>root.unmount());for(const job of jobs){const doc=loaded();await act(async()=>job.resolve(doc));expect(doc.destroy).toHaveBeenCalledTimes(1);expect(doc.renderPage).not.toHaveBeenCalled();}expect(place).not.toHaveBeenCalled();
});

it('drops an old crop result after the input page changes without clearing the new crop job',async()=>{
 const first=deferred<PlanPage>(),second=deferred<PlanPage>();vi.mocked(transformPlan).mockImplementationOnce(()=>first.promise).mockImplementationOnce(()=>second.promise);
 const render=async(p:PlanPage)=>act(async()=>root.render(<StrictMode><PlanRegionEditor page={p} onChange={changed} onBusy={busy}/></StrictMode>));await render(page());await click('오른쪽 90°');await render(page('new-plan'));await click('오른쪽 90°');expect(transformPlan).toHaveBeenCalledTimes(2);await act(async()=>first.resolve(page('old-rotated')));expect(changed).not.toHaveBeenCalled();expect(busy).toHaveBeenLastCalledWith(true);await act(async()=>second.resolve(page('new-rotated')));expect(changed).toHaveBeenCalledWith(expect.objectContaining({imageUrl:'new-rotated'}));expect(busy).toHaveBeenLastCalledWith(false);
});

it('does not emit crop completion or busy/error callbacks after unmount',async()=>{
 const job=deferred<PlanPage>();vi.mocked(transformPlan).mockImplementationOnce(()=>job.promise);await act(async()=>root.render(<StrictMode><PlanRegionEditor page={page()} onChange={changed} onBusy={busy}/></StrictMode>));await click('오른쪽 90°');await act(async()=>root.unmount());const calls=busy.mock.calls.length;await act(async()=>job.resolve(page('late-crop')));expect(changed).not.toHaveBeenCalled();expect(busy.mock.calls).toHaveLength(calls);
});

it('never commits the old drawing through PlanView after switching projects',async()=>{
 await renderPlan();const next={...createDemoProject(),id:'next-plan-project'};await act(async()=>useEditor.getState().loadProject(next));expect(container.querySelector('dialog')).toBeNull();expect(useEditor.getState().project).toEqual(next);expect(useEditor.getState().past).toHaveLength(0);
});

it('places a reference in a minimal venue with finite bounds and retains its identity',async()=>{
 const p={...useEditor.getState().project,walls:useEditor.getState().project.walls.slice(0,1),artworks:[],scenes:[],importedFloor:undefined};useEditor.getState().loadProject(p);await renderPlan();const svg=container.querySelector('svg.plan-svg')!;expect(svg.getAttribute('viewBox')).not.toMatch(/NaN|Infinity/);await click('이 도면 배치');const next=useEditor.getState().project;expect(parseProject(next)).toEqual(next);expect(next.id).toBe(p.id);expect(next.planImageUrl).toBe(png);expect(next.planReference?.origin).toEqual(p.walls[0].start);expect(container.querySelector('dialog')).toBeNull();
});

it('adopts partial walls, calibrates two picked points in cm and preserves a single-step undo',async()=>{
 const before=structuredClone(useEditor.getState().project);await renderPlan();await click('벽 초안으로 편집 시작');expect(container.querySelector('dialog')).toBeNull();const draft=structuredClone(useEditor.getState().project);expect(draft.id).toBe(before.id);expect(draft.displayUnit).toBe('cm');expect(draft.walls).toHaveLength(2);expect(draft.planReference?.calibrated).toBe(false);expect(draft.artworks).toHaveLength(0);expect(useEditor.getState().past).toHaveLength(1);
 await click('두 점 축척 보정');const svg=container.querySelector('svg.plan-svg')!;Object.defineProperty(svg,'getScreenCTM',{value:()=>({inverse:()=>({a:1,b:0,c:0,d:1,e:0,f:0})}),configurable:true});vi.stubGlobal('DOMPoint',class {constructor(public x:number,public y:number){}matrixTransform(){return {x:this.x,y:this.y};}});
 const pick=async(x:number,y:number)=>act(async()=>svg.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,button:0,clientX:x,clientY:y})));await pick(100,100);await pick(200,100);await number('보정 실제 길이','100');await click('축척 적용');const calibrated=structuredClone(useEditor.getState().project);expect(calibrated.planReference?.mmPerPixel).toBe(10);expect(calibrated.planReference?.calibrated).toBe(true);expect(wallLength(calibrated.walls[0])).toBe(8000);expect(parseProject(calibrated)).toEqual(calibrated);expect(useEditor.getState().past).toHaveLength(2);await act(async()=>useEditor.getState().undo());expect(useEditor.getState().project).toEqual(draft);await act(async()=>useEditor.getState().redo());expect(useEditor.getState().project).toEqual(calibrated);
});

it('discards calibration anchors on project A→B→A even when drawing and reference coordinates match',async()=>{
 await renderPlan();await click('벽 초안으로 편집 시작');await click('두 점 축척 보정');const svg=container.querySelector('svg.plan-svg')!;Object.defineProperty(svg,'getScreenCTM',{value:()=>({inverse:()=>({a:1,b:0,c:0,d:1,e:0,f:0})}),configurable:true});vi.stubGlobal('DOMPoint',class {constructor(public x:number,public y:number){}matrixTransform(){return {x:this.x,y:this.y};}});await act(async()=>svg.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,button:0,clientX:100,clientY:100})));expect(container.textContent).toContain('두 번째');const p=useEditor.getState().project;await act(async()=>{useEditor.getState().loadProject({...p,id:'other-calibration'});useEditor.getState().loadProject(p);});expect(container.querySelector('.calibration-panel')).toBeNull();expect(useEditor.getState().project.planReference?.calibrated).toBe(false);expect(useEditor.getState().past).toHaveLength(0);
});

it('keeps a directly dragged wall and calibrated scale when placing new evidence for the same drawing',async()=>{
 const initial=page();vi.mocked(loadPlanFile).mockImplementation(async()=>loaded(initial));await renderPlan();await click('벽 초안으로 편집 시작');await click('두 점 축척 보정');const svg=container.querySelector('svg.plan-svg')!;Object.defineProperty(svg,'getScreenCTM',{value:()=>({a:1,inverse:()=>({a:1,b:0,c:0,d:1,e:0,f:0})}),configurable:true});Object.defineProperty(svg,'getBoundingClientRect',{value:()=>({width:800,height:600}),configurable:true});vi.stubGlobal('DOMPoint',class {constructor(public x:number,public y:number){}matrixTransform(){return {x:this.x,y:this.y};}});Object.defineProperty(SVGElement.prototype,'setPointerCapture',{configurable:true,value:()=>{}});
 const pointer=async(element:Element,type:string,x:number,y:number)=>act(async()=>element.dispatchEvent(new MouseEvent(type,{bubbles:true,button:0,clientX:x,clientY:y})));await pointer(svg,'pointerdown',100,100);await pointer(svg,'pointerdown',200,100);await number('보정 실제 길이','100');await click('축척 적용');await pointer(svg.querySelector('line.selectable')!,'pointerdown',100,100);await pointer(svg,'pointerup',100,100);const handle=container.querySelectorAll('circle.drag-handle:not([aria-label])')[1];expect(handle).toBeDefined();await pointer(handle,'pointerdown',8100,100);await pointer(svg,'pointermove',6600,100);await pointer(svg,'pointerup',6600,100);const edited=structuredClone(useEditor.getState().project);expect(edited.walls[0].end.x).toBe(6600);expect(edited.walls[1].start).toEqual(edited.walls[0].end);expect(container.textContent).toContain('수정 2');
 const revised=page();revised.analysis!.lines.push({id:'new-bottom',start:{x:100,y:700},end:{x:900,y:700},thicknessPx:5});vi.mocked(loadPlanFile).mockImplementation(async()=>loaded(revised));await renderPlan(new File(['same'],'재분석.jpg',{type:'image/jpeg'}));await click('이 도면 배치');const after=useEditor.getState().project;expect(after.walls).toEqual(edited.walls);expect(after.planReference).toEqual(edited.planReference);expect(after.planDraft).toEqual(edited.planDraft);expect(after.planAnalysis?.lines).toHaveLength(3);expect(parseProject(after)).toEqual(after);await act(async()=>useEditor.getState().undo());expect(useEditor.getState().project).toEqual(edited);await act(async()=>useEditor.getState().redo());expect(useEditor.getState().project.planAnalysis?.lines).toHaveLength(3);
});

it('selects the automatic PDF page, reads another page and rerenders it at high resolution',async()=>{
 const doc=loaded(page(),3);doc.renderPage=vi.fn(async(number,detail)=>page(`pdf-${number}-${detail}`));vi.mocked(loadPlanFile).mockImplementation(async()=>doc);vi.mocked(selectPlanPage).mockResolvedValue({pageNumber:2,page:page('pdf-auto-2'),inspected:3,verified:false,failures:[]});await renderDialog(new File(['pdf'],'전시장.pdf',{type:'application/pdf'}));expect(container.textContent).toContain('3페이지를 분석해 2페이지를 선택');expect(container.querySelector('img.plan-import-preview')?.getAttribute('src')).toBe('pdf-auto-2');await change('PDF 페이지','3');expect(doc.renderPage).toHaveBeenCalledWith(3,false);const detail=[...container.querySelectorAll('label')].find(l=>l.textContent?.includes('고해상도 렌더'))!.querySelector('input')!;await act(async()=>detail.click());expect(doc.renderPage).toHaveBeenLastCalledWith(3,true);await click('이 도면 배치');expect(place).toHaveBeenCalledWith(expect.objectContaining({imageUrl:'pdf-3-true'}));
});

it('ignores automatic PDF selection progress and results after its file is replaced',async()=>{
 const job=deferred<Awaited<ReturnType<typeof selectPlanPage>>>();let progress!:(stage:string)=>void,signal!:AbortSignal;vi.mocked(selectPlanPage).mockImplementationOnce((_doc,s,p)=>{signal=s;progress=p;return job.promise;});vi.mocked(loadPlanFile).mockImplementation(async f=>loaded(page(f.name),f.name.endsWith('.pdf')?2:1));await renderDialog(new File(['pdf'],'old.pdf',{type:'application/pdf'}));await renderDialog(new File(['image'],'new.jpg',{type:'image/jpeg'}));expect(signal.aborted).toBe(true);await act(async()=>{progress('OLD PDF STATUS');job.resolve({pageNumber:2,page:page('old-pdf'),inspected:2,verified:false,failures:[]});});expect(container.textContent).not.toContain('OLD PDF STATUS');expect(container.textContent).not.toContain('2페이지를 분석');await click('이 도면 배치');expect(place).toHaveBeenCalledWith(expect.objectContaining({imageUrl:'new.jpg'}));
});

it('decodes a real JPEG, detects its actual wall pixels and adopts its editable draft through PlanView',async()=>{
 const actualImport=await vi.importActual<typeof import('../lib/planImport')>('../lib/planImport'),actualAnalysis=await vi.importActual<typeof import('../lib/analyzePlan')>('../lib/analyzePlan');
 vi.mocked(loadPlanFile).mockImplementation(actualImport.loadPlanFile);vi.mocked(analyzePlan).mockImplementation(actualAnalysis.analyzePlan);
 // Native JPEG/Image/Canvas transport for real local detector algorithms. OCR
 // returns no text in this fixture; it cannot certify numeric recognition.
 class ImageAdapter {native?:NativeImage;naturalWidth=0;naturalHeight=0;pending=Promise.resolve();set src(url:string){if(!url)return;this.pending=loadImage(url).then(image=>{this.native=image;this.naturalWidth=image.width;this.naturalHeight=image.height;});}decode(){return this.pending;}}
 vi.stubGlobal('File',NodeFile);vi.stubGlobal('Image',ImageAdapter);const closed=vi.fn();vi.stubGlobal('createImageBitmap',async(f:File)=>Object.assign(await loadImage(Buffer.from(await f.arrayBuffer())),{close:closed}));
 const canvases=new WeakMap<HTMLCanvasElement,Canvas>();const contextBridge=function(this:HTMLCanvasElement,kind:string){if(kind!=='2d')return null;let canvas=canvases.get(this);if(!canvas){canvas=createCanvas(this.width,this.height);canvases.set(this,canvas);}const ctx=canvas.getContext('2d'),draw=ctx.drawImage.bind(ctx);ctx.drawImage=((image:ImageAdapter|NativeImage,...args:unknown[])=>Reflect.apply(draw,ctx,[image instanceof ImageAdapter?image.native!:image,...args])) as typeof ctx.drawImage;return ctx as unknown as RenderingContext;};vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockImplementation(contextBridge as HTMLCanvasElement['getContext']);vi.spyOn(HTMLCanvasElement.prototype,'toDataURL').mockImplementation(function(this:HTMLCanvasElement){return canvases.get(this)!.toDataURL('image/png');});
 const input=createCanvas(1000,800),context=input.getContext('2d');context.fillStyle='white';context.fillRect(0,0,1000,800);context.fillStyle='black';context.fillRect(100,100,800,8);context.fillRect(892,100,8,600);const bytes=new Uint8Array(input.toBuffer('image/jpeg'));source=new File([bytes.buffer],'실제 벽.jpg',{type:'image/jpeg'});await renderPlan();
 await vi.waitFor(async()=>{await act(async()=>{});expect([...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='벽 초안으로 편집 시작')?.disabled,container.textContent).toBe(false);},{timeout:10000});await click('벽 초안으로 편집 시작');const p=useEditor.getState().project;expect(p.planReference).toMatchObject({widthPx:1000,heightPx:800,calibrated:false});expect(p.planAnalysis?.lineState).toBe('complete');expect(p.walls.length).toBeGreaterThanOrEqual(2);expect(p.planAnalysis?.numericCount).toBe(0);expect(parseProject(p)).toEqual(p);expect(closed).toHaveBeenCalled();expect(useEditor.getState().past).toHaveLength(1);expect(container.querySelector('dialog')).toBeNull();
},20000);
