// @vitest-environment jsdom
import {act,StrictMode} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {File as NodeFile} from 'node:buffer';
import {createCanvas,loadImage,type Image as NativeImage,type Canvas} from '@napi-rs/canvas';
import {Inspector} from './Inspector';
import {FloorMaterialDialog} from './FloorMaterialDialog';
import {LengthUnitContext} from './LengthUnits';
import {useEditor} from '../state/editor';
import {createDemoProject,parseProject} from '../domain/model';
import {rotatedArtworkOuterSize} from '../domain/artworkPresentation';
import {newLight} from '../domain/lighting';
import {readSurfaceTexture} from '../lib/readSurfaceTexture';
import {readSurfaceNormal} from '../lib/readSurfaceNormal';
import type {SurfaceTexture} from '../domain/surfaceTexture';
import type {Project} from '../domain/types';

vi.mock('../lib/readSurfaceTexture',async original=>({...await original<typeof import('../lib/readSurfaceTexture')>(),readSurfaceTexture:vi.fn()}));
vi.mock('../lib/readSurfaceNormal',async original=>({...await original<typeof import('../lib/readSurfaceNormal')>(),readSurfaceNormal:vi.fn()}));
let root:Root,container:HTMLDivElement,p:Project;
const png=createCanvas(1,1);png.getContext('2d').fillStyle='#80c8ff';png.getContext('2d').fillRect(0,0,1,1);const map:SurfaceTexture={imageUrl:png.toDataURL('image/png'),widthMm:500,heightMm:500};
function Ui({floor=false}:{floor?:boolean}){const unit=useEditor(s=>s.project.displayUnit??'mm');return <LengthUnitContext.Provider value={unit}>{floor?<FloorMaterialDialog onClose={()=>{}}/>:<Inspector/>}</LengthUnitContext.Provider>;}
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};}
async function mount(floor=false){await act(async()=>root.render(<StrictMode><Ui floor={floor}/></StrictMode>));}
async function choose(type:'artwork'|'wall'|'light',id:string,add=false){await act(async()=>useEditor.getState().select({type,id},add));}
async function click(label:string){const button=[...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.trim()===label||b.getAttribute('aria-label')===label)!;expect(button,container.textContent).toBeDefined();expect(button.matches(':disabled'),container.textContent).toBe(false);await act(async()=>button.click());}
async function change(label:string,value:string){const input=container.querySelector<HTMLInputElement|HTMLSelectElement>(`[aria-label="${label}"]`)!;expect(input).toBeDefined();expect(input.matches(':disabled')).toBe(false);await act(async()=>{Object.getOwnPropertyDescriptor(input instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event(input instanceof HTMLSelectElement?'change':'input',{bubbles:true}));});}
async function draft(label:string,value:string){const input=container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;await act(async()=>input.focus());await change(label,value);return input;}
async function number(label:string,value:string){const input=await draft(label,value);await act(async()=>input.blur());}
async function file(label:string){const input=container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;expect(input).toBeDefined();Object.defineProperty(input,'files',{configurable:true,value:[new File(['image'],'surface.png',{type:'image/png'})]});await act(async()=>input.dispatchEvent(new Event('change',{bubbles:true})));}
beforeEach(()=>{
 vi.resetAllMocks();(globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;vi.stubGlobal('File',NodeFile);Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.open=true;}});
 p={...createDemoProject(),id:'inspector-workflow',displayUnit:'cm',scenes:[]};p.artworks=p.artworks.slice(0,3).map(a=>({...a,frame:'none',presentationType:'photo-print',wallSide:'front'}));p.lights=[newLight(p,'spot')];useEditor.getState().loadProject(p,true);useEditor.getState().select({type:'artwork',id:p.artworks[0].id});
 vi.mocked(readSurfaceTexture).mockResolvedValue(map);vi.mocked(readSurfaceNormal).mockResolvedValue({...map,strength:1});container=document.createElement('div');document.body.append(container);root=createRoot(container);
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});

it.each(['selection','selection-roundtrip','project-roundtrip'] as const)('discards an uncommitted equal-valued width after %s',async mode=>{
 await mount();const old=await draft('W','123');await act(async()=>{if(mode==='project-roundtrip'){useEditor.getState().loadProject({...p,id:'other-inspector-project'});useEditor.getState().loadProject(p);}else{useEditor.getState().select({type:'artwork',id:p.artworks[1].id});if(mode==='selection-roundtrip')useEditor.getState().select({type:'artwork',id:p.artworks[0].id});}});
 const current=container.querySelector<HTMLInputElement>('[aria-label="W"]')!;expect(current.value).toBe('90');await act(async()=>{old.blur();current.focus();current.blur();});expect(useEditor.getState().project.artworks.map(a=>a.widthMm)).toEqual([900,900,900]);expect(useEditor.getState().past).toHaveLength(0);
});

it.each(['texture','normal'] as const)('discards a delayed %s after selection A→B→A without retaining its processing state',async kind=>{
 const job=deferred<SurfaceTexture&{strength?:number}>();if(kind==='texture')vi.mocked(readSurfaceTexture).mockImplementationOnce(()=>job.promise);else vi.mocked(readSurfaceNormal).mockImplementationOnce(()=>job.promise as ReturnType<typeof readSurfaceNormal>);
 await choose('wall','wall-a');await mount();await file(kind==='texture'?'벽 재질 텍스처 파일':'벽 재질 노멀 맵 파일');await act(async()=>{useEditor.getState().select({type:'wall',id:'wall-b'});useEditor.getState().select({type:'wall',id:'wall-a'});});const before=useEditor.getState().project;await act(async()=>job.resolve({...map,strength:1}));expect(useEditor.getState().project).toBe(before);expect(container.querySelector('[role="alert"]')).toBeNull();expect(container.textContent).not.toContain(kind==='texture'?'이미지 처리 중':'노멀 맵 처리 중');
});

it('does not attach a late floor texture after project A→B→A',async()=>{
 const job=deferred<SurfaceTexture>();vi.mocked(readSurfaceTexture).mockImplementationOnce(()=>job.promise);await mount(true);await file('바닥 재질 텍스처 파일');await act(async()=>{useEditor.getState().loadProject({...p,id:'other-floor-project'});useEditor.getState().loadProject(p);});const before=useEditor.getState().project;await act(async()=>job.resolve(map));expect(useEditor.getState().project).toBe(before);expect(useEditor.getState().project.floorMaterial?.texture).toBeUndefined();
});

it('invalidates a pending normal when its wall is locked and unlocked in one batch',async()=>{
 const job=deferred<Awaited<ReturnType<typeof readSurfaceNormal>>>();vi.mocked(readSurfaceNormal).mockImplementationOnce(()=>job.promise);await choose('wall','wall-a');await mount();await file('벽 재질 노멀 맵 파일');await act(async()=>{useEditor.getState().patchWall('wall-a',{locked:true});useEditor.getState().patchWall('wall-a',{locked:false});});const before=useEditor.getState().project;await act(async()=>job.resolve({...map,strength:1}));expect(useEditor.getState().project).toBe(before);expect(before.walls[0].material?.normal).toBeUndefined();
});

it('keeps an old texture error out of the current inspector and lets the new input finish',async()=>{
 const old=deferred<SurfaceTexture>(),next=deferred<SurfaceTexture>();vi.mocked(readSurfaceTexture).mockImplementationOnce(()=>old.promise).mockImplementationOnce(()=>next.promise);await choose('wall','wall-a');await mount();await file('벽 재질 텍스처 파일');await act(async()=>{useEditor.getState().select({type:'wall',id:'wall-b'});useEditor.getState().select({type:'wall',id:'wall-a'});});await click('텍스처 불러오기');await file('벽 재질 텍스처 파일');await act(async()=>old.reject(new Error('OLD TEXTURE ERROR')));expect(container.textContent).not.toContain('OLD TEXTURE ERROR');expect(container.textContent).toContain('이미지 처리 중');await act(async()=>next.resolve(map));expect(useEditor.getState().project.walls[0].material?.texture).toEqual(map);expect(container.textContent).not.toContain('이미지 처리 중');
});

it('edits cm dimensions, spacing, group position and side while keeping size/rotation individual',async()=>{
 await mount();await number('W','95');expect(useEditor.getState().project.artworks[0].widthMm).toBe(950);await choose('artwork',p.artworks[1].id,true);await choose('artwork',p.artworks[2].id,true);await click('작품 그룹 만들기');await number('작품 사이 간격','35');await click('간격 적용');const spaced=structuredClone(useEditor.getState().project),works=spaced.artworks;
 for(let i=1;i<works.length;i++)expect(works[i].alongMm-rotatedArtworkOuterSize(works[i]).widthMm/2-(works[i-1].alongMm+rotatedArtworkOuterSize(works[i-1]).widthMm/2)).toBeCloseTo(350);await act(async()=>useEditor.getState().undo());expect(useEditor.getState().project.artworks[1].alongMm).toBe(p.artworks[1].alongMm);await act(async()=>useEditor.getState().redo());expect(useEditor.getState().project).toEqual(spaced);
 await number('벽 시작점에서','190');const moved=useEditor.getState().project;for(let i=1;i<works.length;i++)expect(moved.artworks[i].alongMm-works[i].alongMm).toBe(moved.artworks[0].alongMm-works[0].alongMm);await change('설치 면','back');expect(useEditor.getState().project.artworks.every(a=>a.wallSide==='back')).toBe(true);await number('면내 회전','90');expect(useEditor.getState().project.artworks.map(a=>a.rotationDeg??0)).toEqual([90,0,0]);await number('중심 높이','165');expect(useEditor.getState().project.artworks.every(a=>a.centerHeightMm===1650)).toBe(true);expect(parseProject(useEditor.getState().project)).toEqual(useEditor.getState().project);
});

it('edits Spot/Area/Kelvin and translates the light target in cm without scaling physical brightness',async()=>{
 await choose('light',p.lights![0].id);await mount();await number('색온도','5500');await number('조명 밝기','120');await number('조사각','35');expect(useEditor.getState().project.lights![0]).toMatchObject({kelvin:5500,intensity:120,beamDeg:35});const before=structuredClone(useEditor.getState().project.lights![0]);await number('조명 X',String(before.position.x/10+30));const shifted=useEditor.getState().project.lights![0];expect(shifted.position.x-before.position.x).toBeCloseTo(300);expect(shifted.target.x-before.target.x).toBeCloseTo(300);expect(shifted.target.z).toBe(before.target.z);await change('조명 종류','area');await number('조명 면 폭','150');await number('조명 면 높이','75');expect(useEditor.getState().project.lights![0]).toMatchObject({kind:'area',widthMm:1500,heightMm:750});await click('조명 잠금');expect(container.querySelector<HTMLInputElement>('[aria-label="색온도"]')?.disabled).toBe(true);const locked=useEditor.getState().project;await click('조명 잠금 해제');await act(async()=>useEditor.getState().undo());expect(useEditor.getState().project).toEqual(locked);expect(parseProject(locked)).toEqual(locked);
});

it('preserves the latest material edits while its current texture finishes and supports one-step Undo',async()=>{
 const job=deferred<SurfaceTexture>();vi.mocked(readSurfaceTexture).mockImplementationOnce(()=>job.promise);await choose('wall','wall-a');await mount();await file('벽 재질 텍스처 파일');await change('벽 재질 프리셋','wood');await number('벽 재질 거칠기','37');const before=structuredClone(useEditor.getState().project);await act(async()=>job.resolve(map));expect(useEditor.getState().project.walls[0].material).toMatchObject({preset:'wood',roughness:.37,texture:map});await act(async()=>useEditor.getState().undo());expect(useEditor.getState().project).toEqual(before);
});

it('decodes real color/DirectX normal images, edits physical repeat sizes and preserves them in Scene and JSON',async()=>{
 const actualTexture=await vi.importActual<typeof import('../lib/readSurfaceTexture')>('../lib/readSurfaceTexture'),actualNormal=await vi.importActual<typeof import('../lib/readSurfaceNormal')>('../lib/readSurfaceNormal');vi.mocked(readSurfaceTexture).mockImplementation(actualTexture.readSurfaceTexture);vi.mocked(readSurfaceNormal).mockImplementation(actualNormal.readSurfaceNormal);
 class ImageAdapter {native?:NativeImage;naturalWidth=0;naturalHeight=0;onload:(()=>void)|null=null;onerror:(()=>void)|null=null;set src(url:string){if(!url)return;void loadImage(url).then(image=>{this.native=image;this.naturalWidth=image.width;this.naturalHeight=image.height;this.onload?.();},()=>this.onerror?.());}}
 vi.stubGlobal('Image',ImageAdapter);const closed=vi.fn();vi.stubGlobal('createImageBitmap',async(f:File)=>Object.assign(await loadImage(Buffer.from(await f.arrayBuffer())),{close:closed}));const canvases=new WeakMap<HTMLCanvasElement,Canvas>();vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockImplementation(function(this:HTMLCanvasElement,kind:string){if(kind!=='2d')return null;let canvas=canvases.get(this);if(!canvas){canvas=createCanvas(this.width,this.height);canvases.set(this,canvas);}return canvas.getContext('2d') as unknown as RenderingContext;} as HTMLCanvasElement['getContext']);vi.spyOn(HTMLCanvasElement.prototype,'toDataURL').mockImplementation(function(this:HTMLCanvasElement,type?:string){return canvases.get(this)!.toDataURL(type==='image/webp'?'image/webp':'image/png');});
 const image=createCanvas(32,16),ctx=image.getContext('2d');ctx.fillStyle='#80c8ff';ctx.fillRect(0,0,32,16);const upload=async(label:string)=>{const input=container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;Object.defineProperty(input,'files',{configurable:true,value:[new File([new Uint8Array(image.toBuffer('image/png')).buffer],'native.png',{type:'image/png'})]});await act(async()=>input.dispatchEvent(new Event('change',{bubbles:true})));};await choose('wall','wall-a');await mount();await change('벽 재질 프리셋','white-paint');await upload('벽 재질 텍스처 파일');await act(async()=>{await vi.waitFor(()=>expect(useEditor.getState().project.walls[0].material?.texture).toBeDefined());});await number('벽 재질 텍스처 폭','200');await number('벽 재질 텍스처 높이','100');await change('벽 재질 노멀 맵 형식','directx');await upload('벽 재질 노멀 맵 파일');await act(async()=>{await vi.waitFor(()=>expect(useEditor.getState().project.walls[0].material?.normal).toBeDefined());});await number('벽 재질 노멀 강도','150');await number('벽 재질 노멀 맵 폭','50');await number('벽 재질 노멀 맵 높이','25');const material=useEditor.getState().project.walls[0].material!;expect(material.texture).toMatchObject({widthMm:2000,heightMm:1000});expect(material.normal).toMatchObject({widthMm:500,heightMm:250,strength:1.5});const normal=await loadImage(material.normal!.imageUrl),probe=createCanvas(32,16);probe.getContext('2d').drawImage(normal,0,0);expect(Array.from(probe.getContext('2d').getImageData(8,8,1,1).data)).toEqual([128,55,255,255]);expect(closed).toHaveBeenCalledTimes(2);await act(async()=>useEditor.getState().saveScene('재질 배치'));const saved=structuredClone(useEditor.getState().project);expect(parseProject(JSON.parse(JSON.stringify(saved)))).toEqual(saved);await number('벽 재질 텍스처 폭','50');await act(async()=>useEditor.getState().restoreScene(saved.scenes[0].id));expect(useEditor.getState().project.walls[0].material).toEqual(material);
},15000);


it('rejects a texture completion within the same React batch as project A→B→A',async()=>{
 const job=deferred<SurfaceTexture>();vi.mocked(readSurfaceTexture).mockImplementationOnce(()=>job.promise);await mount(true);await file('바닥 재질 텍스처 파일');await act(async()=>{useEditor.getState().loadProject({...p,id:'batch-floor-project'});useEditor.getState().loadProject(p);job.resolve(map);await job.promise;});expect(useEditor.getState().project.floorMaterial?.texture).toBeUndefined();expect(useEditor.getState().past).toHaveLength(0);
});
