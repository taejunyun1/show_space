// @vitest-environment jsdom
import {act,StrictMode} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {createCanvas,loadImage,DOMMatrix,Path2D,ImageData,type Image as NativeImage,type Canvas} from '@napi-rs/canvas';
import {File as NodeFile} from 'node:buffer';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {writeFile} from 'node:fs/promises';
import {PlanImportDialog} from './PlanImportDialog';
import {PlanView} from './PlanView';
import {LengthUnitContext} from './LengthUnits';
import {createDemoProject,parseProject,wallLength} from '../domain/model';
import {useEditor} from '../state/editor';
import {loadPlanFile,type PlanFile} from '../lib/planImport';

// Run real PDF.js parsing/rendering on its local Node transport. Only the worker
// asset URL differs from the browser build; no getDocument/page/render mock.
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url',()=>({default:pathToFileURL(createRequire(import.meta.url).resolve('pdfjs-dist/build/pdf.worker.min.mjs')).href}));
vi.mock('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url',()=>({default:pathToFileURL(createRequire(import.meta.url).resolve('pdfjs-dist/legacy/build/pdf.worker.min.mjs')).href}));
vi.mock('../lib/readPlanOcr',()=>({readPlanOcr:vi.fn(async()=>[])}));
vi.mock('../lib/wallDetection.worker?worker',async()=>{
 const {detectWallCandidates}=await import('../domain/wallCandidates');
 return {default:class {onmessage:((event:unknown)=>void)|null=null;onerror=null;stopped=false;terminate(){this.stopped=true;}postMessage(input:{data:ArrayBuffer;width:number;height:number;threshold:number;minLengthPx:number;minThicknessPx:number;maxCandidates:number}){queueMicrotask(()=>{if(!this.stopped)this.onmessage?.({data:{candidates:detectWallCandidates(new Uint8ClampedArray(input.data),input.width,input.height,input)}});});}}};
});
vi.mock('../lib/signDetection.worker?worker',async()=>{
 const {pageSignSymbols}=await import('../domain/pageSignSymbols');
 return {default:class {onmessage:((event:unknown)=>void)|null=null;onerror=null;stopped=false;terminate(){this.stopped=true;}postMessage(input:{data:ArrayBuffer;width:number;height:number}){queueMicrotask(()=>{if(!this.stopped)this.onmessage?.({data:{symbols:pageSignSymbols(new Uint8ClampedArray(input.data),input.width,input.height)}});});}}};
});
let root:Root,container:HTMLDivElement;let docs:PlanFile[]=[];
const close=vi.fn(),adopt=vi.fn(),place=vi.fn(),received=vi.fn();
beforeEach(()=>{
 vi.clearAllMocks();docs=[];(globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
 vi.stubGlobal('File',NodeFile);vi.stubGlobal('DOMMatrix',DOMMatrix);vi.stubGlobal('Path2D',Path2D);vi.stubGlobal('ImageData',ImageData);
 class ImageAdapter {native?:NativeImage;naturalWidth=0;naturalHeight=0;pending=Promise.resolve();set src(url:string){if(!url)return;this.pending=loadImage(url).then(image=>{this.native=image;this.naturalWidth=image.width;this.naturalHeight=image.height;});}decode(){return this.pending;}}
 vi.stubGlobal('Image',ImageAdapter);
 const realCreate=document.createElement.bind(document);
 vi.spyOn(document,'createElement').mockImplementation(((tag:string,options?:ElementCreationOptions)=>{
  if(tag!=='canvas')return realCreate(tag,options);
  const canvas=createCanvas(1,1),ctx=canvas.getContext('2d'),draw=ctx.drawImage.bind(ctx);ctx.drawImage=((image:ImageAdapter|NativeImage|Canvas,...args:unknown[])=>Reflect.apply(draw,ctx,[image instanceof ImageAdapter?image.native!:image,...args])) as typeof ctx.drawImage;return canvas as unknown as HTMLCanvasElement;
 }) as typeof document.createElement);
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.open=true;}});
 useEditor.getState().loadProject({...createDemoProject(),id:'real-pdf-workflow',displayUnit:'cm',name:'PDF 입력 전시',note:'PRIVATE_PDF_PROJECT',scenes:[]});
 container=document.createElement('div');document.body.append(container);root=createRoot(container);
});
afterEach(async()=>{await act(async()=>root.unmount());for(const doc of docs)await doc.destroy();container.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
async function fixture(){
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),cover=doc.addPage([600,500]);cover.drawText('Exhibition proposal',{x:80,y:380,size:30,font});
 const page=doc.addPage([600,500]);
 for(const [x,y,width,height] of [[100,100,400,8],[100,392,400,8],[100,100,8,300],[492,100,8,300]])page.drawRectangle({x,y,width,height,color:rgb(0,0,0)});
 for(const [text,x,y] of [['8000 mm',260,420],['6000 mm',510,250],['DOOR',270,112],['AC',440,375],['FIRE HYDRANT',120,120]] as const)page.drawText(text,{x,y,size:12,font});
 return new File([new Uint8Array(await doc.save()).buffer],'다중 페이지 전시장.pdf',{type:'application/pdf'});
}
async function click(label:string){const button=[...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.trim()===label||b.getAttribute('aria-label')===label)!;expect(button,container.textContent).toBeDefined();expect(button.disabled,container.textContent).toBe(false);await act(async()=>button.click());}
async function ready(){await vi.waitFor(async()=>{await act(async()=>{});expect(container.querySelector('.plan-import-dialog > p[role="alert"]'),container.textContent).toBeNull();expect([...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='이 도면 배치')?.disabled,container.textContent).toBe(false);},{timeout:20000});}

it('reads real PDF text and wall pixels at preview/full/detail resolution without losing vector coordinates',async()=>{
 const file=await fixture();if(process.env.GONGGAN_PDF_INPUT_PROOF==='1')await writeFile('docs/validation/2026-10-09-pdf-vector-input.pdf',new Uint8Array(await file.arrayBuffer()));const doc=await loadPlanFile(file);docs.push(doc);expect(doc.pageCount).toBe(2);
 const preview=await doc.previewPage!(2),full=await doc.renderPage(2),detail=await doc.renderPage(2,true);
 expect([preview.widthPx,full.widthPx,detail.widthPx]).toEqual([900,2400,4800]);
 expect(full.textSource).toBe('pdf-text');expect(full.labels?.map(l=>l.text)).toEqual(expect.arrayContaining(['8000 mm','6000 mm','DOOR','AC','FIRE HYDRANT']));
 expect(full.labels?.map(l=>l.kind)).toEqual(expect.arrayContaining(['dimension','door','air-conditioner','fire-hydrant']));
 expect(preview.vectorRects).toHaveLength(4);expect(full.vectorRects).toHaveLength(4);expect(detail.vectorRects).toHaveLength(4);
 expect(full.vectorRects?.[0]).toMatchObject({x:400,y:1568,width:1600,height:32});expect(detail.vectorRects?.[0]).toMatchObject({x:800,y:3136,width:3200,height:64});
 const img=await loadImage(full.imageUrl),canvas=createCanvas(img.width,img.height);canvas.getContext('2d').drawImage(img,0,0);const pixel=(x:number,y:number)=>Array.from(canvas.getContext('2d').getImageData(x,y,1,1).data);expect(pixel(500,1580)).toEqual([0,0,0,255]);expect(pixel(1000,1000)).toEqual([255,255,255,255]);if(process.env.GONGGAN_PDF_INPUT_PROOF==='1')await writeFile('docs/validation/2026-10-09-pdf-plan-render.png',canvas.toBuffer('image/png'));
 await doc.destroy();await expect(doc.renderPage(2)).rejects.toThrow('닫혔습니다');
},20000);

it('automatically selects the real plan page and adopts its editable result through PlanView',async()=>{
 const file=await fixture();await act(async()=>root.render(<StrictMode><LengthUnitContext.Provider value="cm"><PlanView incomingFile={file} onFileReceived={received}/></LengthUnitContext.Provider></StrictMode>));await ready();
 expect(container.textContent).toContain('2페이지를 선택');expect(container.querySelector('img.plan-import-preview')?.getAttribute('alt')).toContain('2페이지');
 const button=[...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>['벽 초안으로 편집 시작','검증된 공간 초안 적용'].includes(b.textContent??''))!;expect(button).toBeDefined();await click(button.textContent!);
 const p=useEditor.getState().project;expect(p.id).toBe('real-pdf-workflow');expect(p.name).toBe('PDF 입력 전시');expect(p.note).toBe('PRIVATE_PDF_PROJECT');expect(p.planReference).toMatchObject({widthPx:2400,heightPx:2000});expect(p.walls.length).toBeGreaterThanOrEqual(4);expect(p.planLabels?.map(l=>l.text)).toEqual(expect.arrayContaining(['8000 mm','6000 mm','DOOR','AC','FIRE HYDRANT']));expect(parseProject(p)).toEqual(p);expect(useEditor.getState().past).toHaveLength(1);expect(container.querySelector('dialog')).toBeNull();await act(async()=>useEditor.getState().undo());expect(useEditor.getState().project.planImageUrl).toBeUndefined();await act(async()=>useEditor.getState().redo());expect(useEditor.getState().project).toEqual(p);
},30000);

it('switches real PDF pages, rerenders detail and delivers the selected original to its placement callback',async()=>{
 const file=await fixture();await act(async()=>root.render(<StrictMode><PlanImportDialog file={file} existingProject={useEditor.getState().project} onClose={close} onAdopt={adopt} onImport={place}/></StrictMode>));await ready();
 const select=container.querySelector<HTMLSelectElement>('[aria-label="PDF 페이지"]')!;await act(async()=>{select.value='1';select.dispatchEvent(new Event('change',{bubbles:true}));});await ready();expect(container.querySelector('img.plan-import-preview')?.getAttribute('alt')).toContain('1페이지');
 const detail=[...container.querySelectorAll('label')].find(l=>l.textContent?.includes('고해상도 렌더'))!.querySelector<HTMLInputElement>('input')!;await act(async()=>detail.click());await ready();expect(container.textContent).toContain('4800 × 4000px');await click('이 도면 배치');expect(place).toHaveBeenCalledWith(expect.objectContaining({widthPx:4800,heightPx:4000}));expect(adopt).not.toHaveBeenCalled();
},30000);


it('preserves a real low-resolution scanned PDF as an editable unscaled draft and calibrates it in cm',async()=>{
 const image=createCanvas(300,250),ctx=image.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,300,250);ctx.fillStyle='black';ctx.fillRect(50,50,200,4);ctx.fillRect(246,50,4,150);
 const pdf=await PDFDocument.create(),png=await pdf.embedPng(image.toDataURL('image/png')),page=pdf.addPage([600,500]);page.drawImage(png,{x:0,y:0,width:600,height:500});const file=new File([new Uint8Array(await pdf.save()).buffer],'저해상도 스캔.pdf',{type:'application/pdf'});
 if(process.env.GONGGAN_PDF_INPUT_PROOF==='1')await writeFile('docs/validation/2026-10-09-pdf-scanned-input.pdf',new Uint8Array(await file.arrayBuffer()));
 await act(async()=>root.render(<StrictMode><LengthUnitContext.Provider value="cm"><PlanView incomingFile={file} onFileReceived={received}/></LengthUnitContext.Provider></StrictMode>));await ready();expect(container.textContent).toContain('텍스트 레이어');await click('벽 초안으로 편집 시작');
 const draft=useEditor.getState().project;expect(draft.walls.length).toBeGreaterThanOrEqual(2);expect(draft.planReference).toMatchObject({widthPx:2400,heightPx:2000,calibrated:false});expect(draft.planAnalysis?.numericCount).toBe(0);expect(draft.planDraft?.kind).toBe('partial');expect(parseProject(draft)).toEqual(draft);
 await click('두 점 축척 보정');const svg=container.querySelector('svg.plan-svg')!;Object.defineProperty(svg,'getScreenCTM',{value:()=>({inverse:()=>({a:1,b:0,c:0,d:1,e:0,f:0})}),configurable:true});vi.stubGlobal('DOMPoint',class {constructor(public x:number,public y:number){}matrixTransform(){return {x:this.x,y:this.y};}});
 for(const x of [400,500])await act(async()=>svg.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,button:0,clientX:x,clientY:400})));
 const input=container.querySelector<HTMLInputElement>('[aria-label="보정 실제 길이"]')!;await act(async()=>input.focus());await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'100');input.dispatchEvent(new Event('input',{bubbles:true}));});await act(async()=>input.blur());await click('축척 적용');
 const calibrated=useEditor.getState().project;expect(calibrated.planReference).toMatchObject({calibrated:true,mmPerPixel:10});for(let i=0;i<draft.walls.length;i++)expect(wallLength(calibrated.walls[i])).toBeCloseTo(wallLength(draft.walls[i])*10);expect(calibrated.planImageUrl).toBe(draft.planImageUrl);expect(parseProject(calibrated)).toEqual(calibrated);expect(useEditor.getState().past).toHaveLength(2);await act(async()=>useEditor.getState().undo());expect(useEditor.getState().project).toEqual(draft);await act(async()=>useEditor.getState().redo());expect(useEditor.getState().project).toEqual(calibrated);
},30000);
