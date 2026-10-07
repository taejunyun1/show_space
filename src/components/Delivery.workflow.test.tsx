// @vitest-environment jsdom
import {act,StrictMode} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {readFile,writeFile} from 'node:fs/promises';
import {PDFDocument} from 'pdf-lib';
import JSZip from 'jszip';
import {ExportDialog} from './ExportDialog';
import PdfDialog from './PdfDialog';
import {LengthUnitContext} from './LengthUnits';
import {createDemoProject} from '../domain/model';
import {appendSceneSnapshot} from '../domain/sceneSnapshot';
import {useEditor} from '../state/editor';
import {downloadBlob} from '../lib/art';
import {exportProjectPdf} from '../lib/pdfExport';
import {exportProjectBackup,readProjectBackup} from '../lib/projectBackup';
import {exportProjectGlb,exportProjectGltf} from '../lib/modelExport';
import {importProjectPackage} from '../lib/projectPackage';
import {prepareSharePresentation} from '../lib/sharePresentation';
import {createCanvas,loadImage,type Image as NativeImage,type Canvas} from '@napi-rs/canvas';
import type {Project} from '../domain/types';

vi.mock('../lib/art',async original=>({...await original<typeof import('../lib/art')>(),downloadBlob:vi.fn()}));
vi.mock('../lib/pdfExport',async original=>({...await original<typeof import('../lib/pdfExport')>(),exportProjectPdf:vi.fn()}));
vi.mock('../lib/projectBackup',async original=>({...await original<typeof import('../lib/projectBackup')>(),exportProjectBackup:vi.fn()}));
vi.mock('../lib/modelExport',async original=>({...await original<typeof import('../lib/modelExport')>(),exportProjectGlb:vi.fn(),exportProjectGltf:vi.fn()}));
let root:Root,container:HTMLDivElement,p:Project;
const close=vi.fn(),getCamera=vi.fn();
async function mount(kind:'pdf'|'export'){
 await act(async()=>root.render(<StrictMode><LengthUnitContext.Provider value="mm">{kind==='pdf'?<PdfDialog onClose={close} getCamera={getCamera}/>:<ExportDialog onClose={close} onPng={()=>{}} onPdf={()=>{}}/>}</LengthUnitContext.Provider></StrictMode>));
}
async function click(label:string){const b=[...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.trim()===label||b.getAttribute('aria-label')===label||b.querySelector('strong')?.textContent===label)!;expect(b).toBeDefined();await act(async()=>b.click());}
async function change(label:string,value:string){const input=container.querySelector<HTMLInputElement|HTMLSelectElement>(`[aria-label="${label}"]`)!;expect(input).toBeDefined();await act(async()=>{Object.getOwnPropertyDescriptor(input instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event(input instanceof HTMLSelectElement?'change':'input',{bubbles:true}));});}
async function check(label:string){const input=[...container.querySelectorAll('label')].find(l=>l.textContent?.trim()===label)!.querySelector<HTMLInputElement>('input')!;await act(async()=>input.click());}
function pendingBlob(mock:typeof exportProjectPdf|typeof exportProjectBackup|typeof exportProjectGlb|typeof exportProjectGltf){let resolve!:(value:Blob)=>void,reject!:(error:Error)=>void;vi.mocked(mock).mockImplementationOnce(()=>new Promise<Blob>((r,j)=>{resolve=r;reject=j;}));return {resolve:(value:Blob)=>resolve(value),reject:(error:Error)=>reject(error)};}
beforeEach(()=>{
 (globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.open=true;}});
 p=createDemoProject();p.id='delivery-project';p.name='전달 검증';p.scenes=[];p.artworks=[];p.note='PRIVATE_PROJECT';p.walls[0].note='PRIVATE_WALL';p=appendSceneSnapshot(p,p,'처음 배치');p.walls[0].heightMm=3500;useEditor.getState().loadProject(p);
 container=document.createElement('div');document.body.append(container);root=createRoot(container);
 vi.mocked(exportProjectPdf).mockResolvedValue(new Blob(['pdf']));vi.mocked(exportProjectBackup).mockResolvedValue(new Blob(['zip']));vi.mocked(exportProjectGlb).mockResolvedValue(new Blob(['glb']));vi.mocked(exportProjectGltf).mockResolvedValue(new Blob(['gltf']));getCamera.mockReturnValue(undefined);
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.restoreAllMocks();vi.clearAllMocks();vi.unstubAllGlobals();});

it.each(['pdf','backup','glb','gltf'] as const)('drops a late %s output after project A→B→A and leaves the new project untouched',async kind=>{
 const isPdf=kind==='pdf',job=pendingBlob(isPdf?exportProjectPdf:kind==='backup'?exportProjectBackup:kind==='glb'?exportProjectGlb:exportProjectGltf);await mount(isPdf?'pdf':'export');await click(isPdf?'PDF 저장':kind==='backup'?'프로젝트 자산 백업':kind==='glb'?'3D 모델':'glTF 파일 묶음');
 await act(async()=>{useEditor.getState().loadProject({...p,id:'another-delivery-project'});useEditor.getState().loadProject(p);});const before=useEditor.getState().project;await act(async()=>useEditor.getState().notify('새 작업'));await act(async()=>job.resolve(new Blob(['old artifact'])));
 expect(downloadBlob).not.toHaveBeenCalled();expect(useEditor.getState().project).toBe(before);expect(useEditor.getState().message).toBe('새 작업');expect(useEditor.getState().past).toHaveLength(0);expect(close).toHaveBeenCalledTimes(1);
});

it.each(['pdf','backup'] as const)('ignores late %s success after dialog unmount instead of closing a new dialog',async kind=>{
 const job=pendingBlob(kind==='pdf'?exportProjectPdf:exportProjectBackup);await mount(kind==='pdf'?'pdf':'export');await click(kind==='pdf'?'PDF 저장':'프로젝트 자산 백업');await act(async()=>root.unmount());await act(async()=>job.resolve(new Blob(['late'])));expect(downloadBlob).not.toHaveBeenCalled();expect(close).not.toHaveBeenCalled();expect(useEditor.getState().message).toBeNull();
});

it('keeps a current PDF error visible, avoids duplicate work and allows retry',async()=>{
 const job=pendingBlob(exportProjectPdf);await mount('pdf');await click('PDF 저장');await click('PDF 만드는 중…');expect(exportProjectPdf).toHaveBeenCalledTimes(1);await act(async()=>job.reject(new Error('글꼴 입력 실패')));expect(container.querySelector('[role="alert"]')?.textContent).toContain('글꼴 입력 실패');expect(close).not.toHaveBeenCalled();expect(downloadBlob).not.toHaveBeenCalled();await click('PDF 저장');expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob),'전달 검증-전시안.pdf');expect(close).toHaveBeenCalledTimes(1);
});

it('preserves the started backup snapshot while edits continue in the same project',async()=>{
 const job=pendingBlob(exportProjectBackup);await mount('export');await click('프로젝트 자산 백업');await act(async()=>useEditor.getState().renameProject('나중 이름'));const current=useEditor.getState().project;await act(async()=>job.resolve(new Blob(['zip'])));expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob),'전달 검증.gonggan.zip');expect(useEditor.getState().project).toBe(current);expect(exportProjectBackup).toHaveBeenCalledWith(expect.objectContaining({name:'전달 검증'}),expect.any(Function));
});

it('uses the real page builder and PDF exporter for ordered current/Scene pages, then restores the same project from ZIP',async()=>{
 const actualPdf=await vi.importActual<typeof import('../lib/pdfExport')>('../lib/pdfExport'),actualBackup=await vi.importActual<typeof import('../lib/projectBackup')>('../lib/projectBackup');vi.mocked(exportProjectPdf).mockImplementation(actualPdf.exportProjectPdf);vi.mocked(exportProjectBackup).mockImplementation(actualBackup.exportProjectBackup);
 // Real native PNG decode behind the browser Image/Canvas transport.
 class ImageAdapter {
  native?:NativeImage;naturalWidth=0;naturalHeight=0;crossOrigin='';onload:(()=>void)|null=null;onerror:(()=>void)|null=null;
  set src(value:string){if(!value)return;void loadImage(value).then(image=>{this.native=image;this.naturalWidth=image.width;this.naturalHeight=image.height;this.onload?.();},()=>this.onerror?.());}
 }
 vi.stubGlobal('Image',ImageAdapter);
 const canvases=new WeakMap<HTMLCanvasElement,Canvas>();
 const contextBridge=function(this:HTMLCanvasElement,kind:string){
  if(kind!=='2d')return null;let canvas=canvases.get(this);if(!canvas){canvas=createCanvas(this.width,this.height);canvases.set(this,canvas);}const context=canvas.getContext('2d'),draw=context.drawImage.bind(context);
  context.drawImage=((image:ImageAdapter|NativeImage,...args:unknown[])=>Reflect.apply(draw,context,[image instanceof ImageAdapter?image.native!:image,...args])) as typeof context.drawImage;
  return context as unknown as RenderingContext;
 };
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockImplementation(contextBridge as HTMLCanvasElement['getContext']);
 vi.spyOn(HTMLCanvasElement.prototype,'toDataURL').mockImplementation(function(this:HTMLCanvasElement){return canvases.get(this)!.toDataURL('image/png');});
 const template=createDemoProject().artworks[0];p.artworks=Array.from({length:10},(_,i)=>{const canvas=createCanvas(64,48),context=canvas.getContext('2d');context.fillStyle=i===0?'#ff0000':`hsl(${i*36},80%,50%)`;context.fillRect(0,0,64,48);return {...template,id:`delivery-art-${i}`,name:`전달 작품 ${i+1}`,alongMm:600+i*650,widthMm:400,heightMm:600,frame:'none' as const,imageUrl:canvas.toDataURL('image/png'),note:'PRIVATE_ART'};});
 p.scenes[0].artworks=structuredClone(p.artworks);p.scenes[0].artworks[0].widthMm=777;useEditor.getState().loadProject(p);
 const font=new Uint8Array(await readFile('public/fonts/NotoSansKR-Regular.ttf'));vi.stubGlobal('fetch',vi.fn(async()=>new Response(font)));await mount('pdf');await check('3D 공간');await check('벽면도');await check('처음 배치');await click('페이지 직접 구성');
 // Start with two plans and two schedules, then add current/Scene image details.
 expect(container.querySelectorAll('.pdf-page-row')).toHaveLength(4);await change('페이지 1 보기','cover');await change('페이지 1 제목','검증 표지');await change('페이지 2 제목','저장된 처음 배치');await click('페이지 2 위로');await click('페이지 추가');await change('페이지 5 보기','detail');await change('페이지 5 제목','현재 작품 상세');await click('페이지 추가');await change('페이지 6 보기','detail');await change('페이지 6 배치안',p.scenes[0].id);await change('페이지 6 제목','저장 작품 상세');await click('PDF 저장');await act(async()=>{await vi.waitFor(()=>expect(downloadBlob).toHaveBeenCalled(),{timeout:10000});});
 const downloaded=vi.mocked(downloadBlob).mock.calls[0];expect(downloaded[1]).toBe('전달 검증-전시안.pdf');const bytes=new Uint8Array(await downloaded[0].arrayBuffer()),doc=await PDFDocument.load(bytes);expect(doc.getPageCount()).toBe(8);expect(doc.getPages().every(page=>Math.abs(page.getWidth()-841.89)<.1)).toBe(true);
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs'),task=getDocument({data:bytes.slice(),useSystemFonts:false}),pdf=await task.promise;
 try{const texts=[];for(let i=1;i<=pdf.numPages;i++)texts.push((await (await pdf.getPage(i)).getTextContent()).items.map(item=>'str' in item?item.str:'').join(' '));expect(texts[0]).toContain('저장된 처음 배치');expect(texts[1]).toContain('검증 표지');expect(texts[2]).toContain('3,500');expect(texts[4]).toContain('3,200');expect(texts[6]).toContain('현재 작품 상세');expect(texts[6]).toContain('400 × 600');expect(texts[7]).toContain('저장 작품 상세');expect(texts[7]).toContain('777 × 600');expect(texts.slice(2,6).join(' ')).toContain('전달 작품 10');expect(texts.join(' ')).not.toContain('PRIVATE');
  for(const index of [7,8]){const page=await pdf.getPage(index),viewport=page.getViewport({scale:1}),canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));await page.render({canvas:canvas as unknown as HTMLCanvasElement,viewport}).promise;const pixel=(x:number,y:number)=>[...canvas.getContext('2d').getImageData(x,y,1,1).data];expect(pixel(284,333)).toEqual([255,0,0,255]);expect(pixel(100,333)).toEqual(index===7?[255,255,255,255]:[255,0,0,255]);if(process.env.GONGGAN_DELIVERY_PROOF==='1')await writeFile(`/tmp/gonggan-delivery-detail-${index}-20261008.png`,canvas.toBuffer('image/png'));}
  if(process.env.GONGGAN_DELIVERY_PROOF==='1')await writeFile('/tmp/gonggan-delivery-20261008.pdf',bytes);
 }finally{await task.destroy();}
 const before=structuredClone(useEditor.getState().project);await act(async()=>root.unmount());root=createRoot(container);vi.mocked(downloadBlob).mockClear();await mount('export');await click('프로젝트 자산 백업');await act(async()=>{await vi.waitFor(()=>expect(downloadBlob).toHaveBeenCalled(),{timeout:10000});});const backup=vi.mocked(downloadBlob).mock.calls[0][0],zip=await JSZip.loadAsync(await backup.arrayBuffer(),{checkCRC32:true});expect(zip.file('project.json')).not.toBeNull();const restored=await importProjectPackage(await backup.arrayBuffer());expect(restored).toEqual(before);if(process.env.GONGGAN_DELIVERY_PROOF==='1')await writeFile('/tmp/gonggan-delivery-20261008.gonggan.zip',new Uint8Array(await backup.arrayBuffer()));expect(await readProjectBackup({size:backup.size,arrayBuffer:()=>backup.arrayBuffer()} as File)).toEqual(before);
 const {snapshot:publication}=await prepareSharePresentation(restored,{includeDimensions:true,sceneIds:[restored.scenes[0].id]});expect(JSON.stringify(publication)).not.toContain('PRIVATE');expect(publication.scenes).toHaveLength(1);expect(publication.artworks).toHaveLength(10);expect(publication.scenes![0].snapshot.artworks[0].widthMm).toBe(777);expect(useEditor.getState().project).toEqual(before);
},20000);


it('reports a broken camera getter in the PDF dialog and recovers on retry',async()=>{
 getCamera.mockImplementationOnce(()=>{throw new Error('시점 읽기 실패');});await mount('pdf');await click('PDF 저장');expect(container.querySelector('[role="alert"]')?.textContent).toContain('시점 읽기 실패');expect(exportProjectPdf).not.toHaveBeenCalled();await click('PDF 저장');expect(downloadBlob).toHaveBeenCalledTimes(1);expect(close).toHaveBeenCalledTimes(1);
});

it.each(['pdf','backup'] as const)('ignores old %s progress and failure after mounting a new dialog',async kind=>{
 const job=pendingBlob(kind==='pdf'?exportProjectPdf:exportProjectBackup);await mount(kind==='pdf'?'pdf':'export');await click(kind==='pdf'?'PDF 저장':'프로젝트 자산 백업');const calls=kind==='pdf'?vi.mocked(exportProjectPdf).mock.calls:vi.mocked(exportProjectBackup).mock.calls,progress=calls[0].at(-1) as (message:string)=>void;
 await act(async()=>root.unmount());root=createRoot(container);await mount(kind==='pdf'?'pdf':'export');await act(async()=>{progress('지난 작업 진행');job.reject(new Error('지난 작업 실패'));});expect(container.textContent).not.toContain('지난 작업');expect(container.querySelector('[role="alert"]')).toBeNull();expect(close).not.toHaveBeenCalled();await click(kind==='pdf'?'PDF 저장':'프로젝트 자산 백업');expect(downloadBlob).toHaveBeenCalledTimes(1);expect(close).toHaveBeenCalledTimes(1);
});
