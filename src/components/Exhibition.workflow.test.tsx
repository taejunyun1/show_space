// @vitest-environment jsdom
import {act,useEffect,StrictMode} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {it,expect,vi,afterEach} from 'vitest';
import {Blob as NodeBlob,File as NodeFile,resolveObjectURL} from 'node:buffer';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {createCanvas,loadImage,DOMMatrix,Path2D,ImageData,type Canvas,type Image as NativeImage} from '@napi-rs/canvas';
import {IDBFactory} from 'fake-indexeddb';
import App from '../App';
import {useEditor,captureAutosaveFlush,flushAutosave} from '../state/editor';
import {createDemoProject,parseProject,wallLength} from '../domain/model';
import * as projects from '../lib/projectLibrary';
import {saveNewLocalProject,readDraft} from '../lib/persistence';
import {downloadBlob} from '../lib/art';
import {importProjectPackage} from '../lib/projectPackage';
import {prepareSharePresentation} from '../lib/sharePresentation';
import type {CameraView3D} from './cameraView3d';

vi.mock('../lib/art',async original=>({...await original<typeof import('../lib/art')>(),downloadBlob:vi.fn()}));
vi.mock('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url',()=>({default:pathToFileURL(createRequire(import.meta.url).resolve('pdfjs-dist/legacy/build/pdf.worker.min.mjs')).href}));
// Local production pixel algorithms; worker messaging and OCR are adapters.
vi.mock('../lib/readPlanOcr',()=>({readPlanOcr:vi.fn(async()=>[])}));
vi.mock('../lib/wallDetection.worker?worker',async()=>{
 const {detectWallCandidates}=await import('../domain/wallCandidates');
 return {default:class {onmessage:((event:unknown)=>void)|null=null;stopped=false;terminate(){this.stopped=true;}postMessage(input:{data:ArrayBuffer;width:number;height:number;threshold:number;minLengthPx:number;minThicknessPx:number;maxCandidates:number}){queueMicrotask(()=>{if(!this.stopped)this.onmessage?.({data:{candidates:detectWallCandidates(new Uint8ClampedArray(input.data),input.width,input.height,input)}});});}}};
});
vi.mock('../lib/signDetection.worker?worker',async()=>{
 const {pageSignSymbols}=await import('../domain/pageSignSymbols');
 return {default:class {onmessage:((event:unknown)=>void)|null=null;stopped=false;terminate(){this.stopped=true;}postMessage(input:{data:ArrayBuffer;width:number;height:number}){queueMicrotask(()=>{if(!this.stopped)this.onmessage?.({data:{symbols:pageSignSymbols(new Uint8ClampedArray(input.data),input.width,input.height)}});});}}};
});
// Only GPU transport is replaced, not Workspace's camera/Scene UI or snapshots.
const camera=vi.hoisted(()=>({view:{position:[6,8,9],target:[0,1,0],zoom:40,projection:'orthographic'} as CameraView3D,requests:[] as CameraView3D[]}));
vi.mock('./Gallery3D',()=>({Gallery3D:({onCameraReady,onCameraApplied,cameraRequest}:{onCameraReady:(get:(()=>CameraView3D)|null)=>void;onCameraApplied:(token:number)=>void;cameraRequest:{token:number;view:CameraView3D}|null})=>{
 useEffect(()=>{onCameraReady(()=>camera.view);return()=>onCameraReady(null);},[onCameraReady]);
 useEffect(()=>{if(cameraRequest){camera.view=structuredClone(cameraRequest.view);camera.requests.push(camera.view);onCameraApplied(cameraRequest.token);}},[cameraRequest,onCameraApplied]);return <div aria-label="GPU transport adapter"/>;
}}));
vi.mock('../lib/pdfRender3d',async original=>({...await original<typeof import('../lib/pdfRender3d')>(),renderPdf3d:async()=>{const c=createCanvas(320,200);c.getContext('2d').fillRect(0,0,320,200);return new Uint8Array(c.toBuffer('image/png'));}}));
let root:Root|undefined,container:HTMLDivElement;
afterEach(async()=>{const finish=captureAutosaveFlush();if(root)await act(async()=>root!.unmount());await finish().catch(()=>{});container?.remove();vi.restoreAllMocks();vi.unstubAllGlobals();vi.clearAllMocks();});

it('keeps one persisted exhibition through real PDF input, ten image uploads, edits, Scene A/B, native capture, PDF and ZIP re-read',async()=>{
 (globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
 vi.stubGlobal('File',NodeFile);vi.stubGlobal('Blob',NodeBlob);vi.stubGlobal('DOMMatrix',DOMMatrix);vi.stubGlobal('Path2D',Path2D);vi.stubGlobal('ImageData',ImageData);vi.stubGlobal('ResizeObserver',class {observe(){}disconnect(){}});
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.open=true;}});
 Object.defineProperty(SVGElement.prototype,'viewBox',{configurable:true,get(){const [x,y,width,height]=(this.getAttribute('viewBox')??'0 0 800 600').split(/[ ,]+/).map(Number);return {baseVal:{x,y,width,height}};}});
 Object.defineProperty(document,'fonts',{configurable:true,value:{ready:Promise.resolve()}});
 vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue({width:800,height:600,x:0,y:0,top:0,left:0,right:800,bottom:600,toJSON:()=>({})});
 const imageErrors:string[]=[];let capturedSvg='';
 class ImageAdapter {
  native?:NativeImage;naturalWidth=0;naturalHeight=0;onload:(()=>void)|null=null;onerror:(()=>void)|null=null;pending=Promise.resolve();
  set src(url:string){if(!url)return;this.pending=(async()=>{const blob=url.startsWith('blob:')?resolveObjectURL(url):undefined;if(blob)capturedSvg=await blob.text();this.native=await loadImage(blob?Buffer.from(await blob.arrayBuffer()):url);this.naturalWidth=this.native.width;this.naturalHeight=this.native.height;this.onload?.();})().catch(error=>{imageErrors.push(url.slice(0,35)+': '+String(error));this.onerror?.();throw error;});void this.pending.catch(()=>{});}decode(){return this.pending;}
 }
 vi.stubGlobal('Image',ImageAdapter);vi.stubGlobal('createImageBitmap',async(blob:Blob)=>Object.assign(await loadImage(Buffer.from(await blob.arrayBuffer())),{close(){}}));
 const create=document.createElement.bind(document);
 vi.spyOn(document,'createElement').mockImplementation(((tag:string,options?:ElementCreationOptions)=>{
  if(tag!=='canvas')return create(tag,options);const c=createCanvas(1,1),context=c.getContext('2d'),draw=context.drawImage.bind(context);
  context.drawImage=((image:ImageAdapter|NativeImage|Canvas,...args:unknown[])=>Reflect.apply(draw,context,[image instanceof ImageAdapter?image.native!:image,...args])) as typeof context.drawImage;
  Object.assign(c,{toBlob:(done:(blob:Blob)=>void)=>done(new Blob([new Uint8Array(c.toBuffer('image/png'))],{type:'image/png'}))});return c as unknown as HTMLCanvasElement;
 }) as typeof document.createElement);
 const font=new Uint8Array(await readFile('public/fonts/NotoSansKR-Regular.ttf'));
 vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>String(input)==='/api/auth/config'?Response.json({enabled:false}):String(input).includes('NotoSansKR')?new Response(font):new Response('Unexpected local fetch',{status:404})));
 const factory=new IDBFactory(),dbName='exhibition-workflow-'+crypto.randomUUID(),repo=projects.createProjectLibrary(factory,dbName);vi.spyOn(projects,'projectLibrary').mockReturnValue(repo);
 const empty={...createDemoProject(),id:crypto.randomUUID(),name:'연속 검증 전시',displayUnit:'cm' as const,artworks:[],unplacedArtworks:[],scenes:[],lights:[],note:'PRIVATE_EXHIBITION'};
 await saveNewLocalProject(empty);container=document.createElement('div');document.body.append(container);root=createRoot(container);
 await act(async()=>root!.render(<StrictMode><App/></StrictMode>));
 async function wait(check:()=>void){const deadline=Date.now()+25000;for(;;){await act(async()=>{await new Promise(r=>setTimeout(r,10));});try{check();return;}catch(error){if(Date.now()>deadline)throw error;}}}
 async function click(label:string){let b!:HTMLButtonElement;await wait(()=>{b=[...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.trim()===label||b.getAttribute('aria-label')===label||b.querySelector('strong')?.textContent===label)!;expect(b,container.textContent).toBeDefined();expect(b.matches(':disabled'),container.textContent).toBe(false);});await act(async()=>b.click());}
 async function field(label:string,value:string,blur=false){const el=container.querySelector<HTMLInputElement|HTMLSelectElement>(`[aria-label="${label}"]`)!;expect(el,label).toBeTruthy();await act(async()=>{if(blur)el.focus();Object.getOwnPropertyDescriptor(el instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value')!.set!.call(el,value);el.dispatchEvent(new Event(el instanceof HTMLSelectElement?'change':'input',{bubbles:true}));if(blur)el.blur();});}
 async function upload(selector:string,file:File){const el=container.querySelector<HTMLInputElement>(selector)!;expect(el,selector).toBeDefined();Object.defineProperty(el,'files',{configurable:true,value:[file]});await act(async()=>el.dispatchEvent(new Event('change',{bubbles:true})));}
 async function check(label:string){let el!:HTMLInputElement;await wait(()=>{el=[...container.querySelectorAll('label')].find(l=>l.textContent?.trim()===label)?.querySelector<HTMLInputElement>('input')!;expect(el,label).toBeTruthy();});await act(async()=>el.click());}
 const steps:string[]=[];await wait(()=>expect(useEditor.getState().hydrated).toBe(true));expect(useEditor.getState().project.id).toBe(empty.id);steps.push('Persisted empty project hydrated through App');
 const input=await PDFDocument.create(),fontPdf=await input.embedFont(StandardFonts.Helvetica);input.addPage([600,500]).drawText('Exhibition proposal',{x:80,y:380,size:30,font:fontPdf});const page=input.addPage([600,500]);
 for(const [x,y,width,height] of [[100,100,400,8],[100,392,400,8],[100,100,8,300],[492,100,8,300]])page.drawRectangle({x,y,width,height,color:rgb(0,0,0)});
 for(const [text,x,y] of [['8000 mm',260,420],['6000 mm',510,250],['DOOR',270,112],['AC',440,375],['FIRE HYDRANT',120,120]] as const)page.drawText(text,{x,y,size:12,font:fontPdf});const inputBytes=new Uint8Array(await input.save());
 await click('도면·3D 불러오기');await upload('[aria-label="도면 파일"]',new File([inputBytes],'전시장.pdf',{type:'application/pdf'}));
 await wait(()=>expect([...container.querySelectorAll('button')].some(b=>['벽 초안으로 편집 시작','검증된 공간 초안 적용'].includes(b.textContent??'')&&!b.disabled),container.querySelector('.plan-import-dialog')?.textContent).toBe(true));
 expect(container.textContent).toContain('2페이지를 선택');const adopt=[...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>['벽 초안으로 편집 시작','검증된 공간 초안 적용'].includes(b.textContent??''))!;await click(adopt.textContent!);
 const plan=useEditor.getState().project;expect(plan.id).toBe(empty.id);expect(plan.walls.length).toBeGreaterThanOrEqual(4);expect(plan.planLabels?.map(l=>l.text)).toEqual(expect.arrayContaining(['8000 mm','DOOR','AC','FIRE HYDRANT']));steps.push('Header PDF -> automatic page 2 -> editable draft and door/equipment labels');
 if(!plan.planReference?.calibrated){
  await click('두 점 축척 보정');const svg=container.querySelector('svg.plan-svg')!;Object.defineProperty(svg,'getScreenCTM',{configurable:true,value:()=>({inverse:()=>({a:1,b:0,c:0,d:1,e:0,f:0})})});vi.stubGlobal('DOMPoint',class {constructor(public x:number,public y:number){}matrixTransform(){return {x:this.x,y:this.y};}});
  for(const x of [100,200])await act(async()=>svg.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,button:0,clientX:x,clientY:100})));await field('보정 실제 길이','50',true);await click('축척 적용');
 }
 expect(useEditor.getState().project.planReference?.calibrated).toBe(true);steps.push('50cm two-point scale calibration through actual PlanView');
 const wall=[...useEditor.getState().project.walls].sort((a,b)=>wallLength(b)-wallLength(a))[0];await click(wall.name);await field('높이','350',true);expect(useEditor.getState().project.walls.find(w=>w.id===wall.id)?.heightMm).toBe(3500);
 for(let i=0;i<10;i++){
  const img=createCanvas(64,48);img.getContext('2d').fillStyle=`hsl(${i*36},80%,50%)`;img.getContext('2d').fillRect(0,0,64,48);
  await upload('.add-art-card input[accept="image/png,image/jpeg,image/webp"]',new File([new Uint8Array(img.toBuffer('image/png'))],`작품 ${String(i+1).padStart(2,'0')}.png`,{type:'image/png'}));await wait(()=>expect(useEditor.getState().project.artworks).toHaveLength(i+1));
  await field('W','40',true);await field('H','60',true);
 }
 expect(useEditor.getState().project.artworks.every(a=>a.wallId===wall.id&&a.widthMm===400&&a.heightMm===600)).toBe(true);steps.push('Ten real native PNG uploads via Outliner and cm size editing via Inspector');
 // Real multiselection and series dialog, preserving all imported IDs/assets.
 for(const a of useEditor.getState().project.artworks.slice(0,9)){const b=[...container.querySelectorAll<HTMLButtonElement>('.entity-main')].find(b=>b.textContent?.includes(a.name))!;await act(async()=>b.dispatchEvent(new MouseEvent('click',{bubbles:true,shiftKey:true})));}
 expect(useEditor.getState().selected).toHaveLength(10);await click('시리즈 자동 배열');await field('시리즈 작품 간격','25',true);await click('10점 배열 적용');const arrangement=structuredClone(useEditor.getState().project.artworks);
 expect(arrangement.every(a=>a.groupId===arrangement[0].groupId)).toBe(true);expect(new Set(arrangement.map(a=>a.alongMm)).size).toBe(10);steps.push('Ten-point grouped array and 25cm spacing through production dialog');
 await click('스팟 추가');await field('색온도','5500',true);await field('조명 밝기','120',true);expect(useEditor.getState().project.lights?.[0]).toMatchObject({kelvin:5500,intensity:120});
 await click('3D');await click('버드아이뷰');await click('Scene');await field('Scene 이름','Scene A');await click('현재 Scene 저장');await wait(()=>expect(useEditor.getState().project.scenes).toHaveLength(1));const sceneA=structuredClone(useEditor.getState().project.scenes[0]);expect(sceneA.artworks).toEqual(arrangement);expect(sceneA.structure?.lights?.[0].kelvin).toBe(5500);expect(sceneA.cameraView).toEqual(camera.view);
 await click(arrangement[0].name);await field('W','50',true);await click('정면');await field('Scene 이름','Scene B');await click('현재 Scene 저장');await wait(()=>expect(useEditor.getState().project.scenes).toHaveLength(2));const sceneB=structuredClone(useEditor.getState().project.scenes[1]);expect(sceneB.artworks.find(a=>a.id===arrangement[0].id)?.widthMm).toBe(500);expect(sceneB.cameraView).not.toEqual(sceneA.cameraView);steps.push('Spot/Kelvin -> bird/front camera requests -> Scene A/B, including actual native thumbnail encoding with GPU adapter');
 const openA=[...container.querySelectorAll<HTMLButtonElement>('.scene-open')].find(b=>b.textContent?.includes('Scene A'))!;await act(async()=>openA.click());expect(useEditor.getState().project.artworks).toEqual(arrangement);expect(camera.requests.at(-1)).toEqual(sceneA.cameraView);
 await click('벽면도');await click('현재 화면 캡처');await click('PNG 저장');await wait(()=>{expect(container.querySelector('.capture-error')?.textContent??'',imageErrors.join(' | ')).toBe('');expect(downloadBlob).toHaveBeenCalledTimes(1);});const capture=vi.mocked(downloadBlob).mock.calls[0][0],pixels=await loadImage(Buffer.from(await capture.arrayBuffer()));expect(Math.max(pixels.width,pixels.height)).toBe(1920);const serialized=new DOMParser().parseFromString(capturedSvg,'image/svg+xml');expect(serialized.querySelector('parsererror')).toBeNull();expect(serialized.querySelectorAll('image')).toHaveLength(10);for(const img of serialized.querySelectorAll('image')){const decoded=await loadImage(img.getAttribute('href')!);expect(decoded.width).toBeGreaterThan(50);expect(decoded.height).toBeGreaterThan(80);}steps.push('Restore Scene A -> actual elevation SVG/native PNG capture at 1920px');
 await click('로컬 저장');await act(async()=>flushAutosave());const completed=structuredClone(useEditor.getState().project),second=projects.createProjectLibrary(factory,dbName);expect((await second.read(completed.id))?.project).toEqual(completed);expect(await readDraft()).toEqual(completed);expect(parseProject(completed)).toEqual(completed);steps.push('Manual save -> independent repository/readDraft exact project and Scene data');
 await click('내보내기');await click('전시안 PDF');await check('3D 공간');await check('Scene A');await check('Scene B');await click('PDF 저장');await wait(()=>expect(downloadBlob).toHaveBeenCalledTimes(2));const pdfBlob=vi.mocked(downloadBlob).mock.calls[1][0],pdfBytes=new Uint8Array(await pdfBlob.arrayBuffer()),pdfDoc=await PDFDocument.load(pdfBytes);expect(pdfDoc.getPageCount()).toBeGreaterThanOrEqual(9);
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs'),task=getDocument({data:pdfBytes.slice(),useSystemFonts:false}),pdf=await task.promise;let text='';try{for(let i=1;i<=pdf.numPages;i++)text+=(await (await pdf.getPage(i)).getTextContent()).items.map(item=>'str' in item?item.str:'').join(' ')+'\n';}finally{await task.destroy();}expect(text).toContain('Scene A');expect(text).toContain('Scene B');expect(text).toContain('작품 10');expect(text).toContain('500');expect(text).toContain('400');expect(text).not.toContain('PRIVATE');steps.push('Current/Scene A/Scene B vector PDF and Korean text inspection, with private notes excluded');
 await click('내보내기');await click('프로젝트 자산 백업');await wait(()=>expect(downloadBlob).toHaveBeenCalledTimes(3));const backup=vi.mocked(downloadBlob).mock.calls[2][0],restored=await importProjectPackage(await backup.arrayBuffer());expect(restored).toEqual(completed);
 const {snapshot}=await prepareSharePresentation(restored,{includeDimensions:true,sceneIds:restored.scenes.map(s=>s.id)});expect(snapshot.artworks).toHaveLength(10);expect(snapshot.scenes).toHaveLength(2);expect(JSON.stringify(snapshot)).not.toContain('PRIVATE');expect(useEditor.getState().project).toEqual(completed);steps.push('Exact ZIP/asset restore -> two-Scene public payload with private notes excluded');
 if(process.env.GONGGAN_EXHIBITION_PROOF==='1'){
  await writeFile('docs/validation/2026-10-11-exhibition-input.pdf',inputBytes);await writeFile('docs/validation/2026-10-11-exhibition-output.pdf',pdfBytes);await writeFile('docs/validation/2026-10-11-exhibition-elevation.svg',capturedSvg);await writeFile('docs/validation/2026-10-11-exhibition-elevation.png',new Uint8Array(await capture.arrayBuffer()));await writeFile('docs/validation/2026-10-11-exhibition.gonggan.zip',new Uint8Array(await backup.arrayBuffer()));await writeFile('docs/validation/2026-10-11-exhibition-workflow.json',JSON.stringify({date:'2026-10-11',projectId:completed.id,walls:completed.walls.length,artworks:10,sceneNames:completed.scenes.map(s=>s.name),pdfPages:pdfDoc.getPageCount(),capture:{width:pixels.width,height:pixels.height},steps,limitations:['jsdom/native Canvas/fake-indexeddb, not actual browser or disk durability','OCR empty and worker transport adapted; production PDF parser/pixel algorithms','GPU transport and 3D Scene preview image renderer adapted, no 3D pixel proof','Native SVG rasterizer skips embedded image href pixels; ten embedded images decode separately and SVG XML is verified; PNG evidence covers wall/frame geometry and dimensions','No actual login/public API publication/SketchUp/real-device/full 24-step acceptance']},null,2)+'\n');
 }
},90000);
