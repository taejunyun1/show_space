// @vitest-environment jsdom
import {act,StrictMode} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {Blob as NodeBlob} from 'node:buffer';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {createCanvas,DOMMatrix,Path2D,ImageData,type Canvas} from '@napi-rs/canvas';
import {Mesh,Vector3} from 'three';
import {PDFDocument} from 'pdf-lib';
import PdfDialog from './PdfDialog';
import {PlanView} from './PlanView';
import {LengthUnitContext} from './LengthUnits';
import SharedViewer from './SharedViewer';
import {useEditor} from '../state/editor';
import {sceneProject} from '../domain/sceneProject';
import {parseProject} from '../domain/model';
import {exportProjectPdf} from '../lib/pdfExport';
import {exportProjectGlb} from '../lib/modelExport';
import {importProjectPackage,exportProjectPackage} from '../lib/projectPackage';
import {prepareSharePresentation} from '../lib/sharePresentation';
import {loadStaticModel} from '../lib/loadStaticModel';
import {disposeModelAsset} from '../lib/modelAssetResources';
import {downloadBlob} from '../lib/art';
import {commentFixture} from '../worker/commentApi.fixture';
import type {Project,Wall} from '../domain/types';

vi.mock('../lib/art',async original=>({...await original<typeof import('../lib/art')>(),downloadBlob:vi.fn()}));
vi.mock('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url',()=>({default:pathToFileURL(createRequire(import.meta.url).resolve('pdfjs-dist/legacy/build/pdf.worker.min.mjs')).href}));
// The locked 2D viewer, Scene navigation, selection and Worker API are real.
// Its unused initial GPU view is a transport adapter, never GPU pixel proof.
vi.mock('./SharedViewer3D',()=>({default:()=> <div aria-label="GPU transport adapter"/>}));
let root:Root|undefined,container:HTMLDivElement,service:ReturnType<typeof commentFixture>|undefined;
afterEach(async()=>{if(root)await act(async()=>root!.unmount());container?.remove();service?.close();service=undefined;vi.restoreAllMocks();vi.unstubAllGlobals();vi.clearAllMocks();});
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
function corners(w:Wall){const dx=w.end.x-w.start.x,dz=w.end.z-w.start.z,len=Math.hypot(dx,dz),t={x:dx/len,z:dz/len},n={x:-t.z,z:t.x},center={x:(w.start.x+w.end.x)/2,z:(w.start.z+w.end.z)/2},result:Vector3[]=[];
 for(const a of [-1,1])for(const b of [-1,1])for(const y of [0,w.heightMm])result.push(new Vector3(center.x+a*t.x*len/2+b*n.x*w.thicknessMm/2,y,center.z+a*t.z*len/2+b*n.z*w.thicknessMm/2).multiplyScalar(.001));return result;
}
function meshError(mesh:Mesh,wall:Wall){const expected=corners(wall),attr=mesh.geometry.getAttribute('position');mesh.updateWorldMatrix(true,false);let error=0;for(let i=0;i<attr.count;i++){const p=new Vector3().fromBufferAttribute(attr,i).applyMatrix4(mesh.matrixWorld);error=Math.max(error,Math.min(...expected.map(q=>p.distanceTo(q)))*1000);}return error;}
function pdfWallLineErrors(canvas:Canvas,viewport:{convertToViewportPoint:(x:number,y:number)=>number[]},p:Project){
 // Independent bounds/fit. Test the visible grey centreline, since these
 // owned walls are white and white fill alone could also match blank paper.
 const points=p.walls.flatMap(w=>[w.start,w.end]),minX=Math.min(...points.map(q=>q.x)),maxX=Math.max(...points.map(q=>q.x)),minZ=Math.min(...points.map(q=>q.z)),maxZ=Math.max(...points.map(q=>q.z)),s=Math.min((841.89-96-40)/(maxX-minX),(385-40)/(maxZ-minZ)),left=48+(841.89-96-(maxX-minX)*s)/2,top=76+(385+(maxZ-minZ)*s)/2,errors:number[]=[];
 for(const w of p.walls)for(const t of [.2,.5,.8]){const x=w.start.x+t*(w.end.x-w.start.x),z=w.start.z+t*(w.end.z-w.start.z),[px,py]=viewport.convertToViewportPoint(left+(x-minX)*s,top-(z-minZ)*s),pixels=canvas.getContext('2d').getImageData(Math.floor(px)-1,Math.floor(py)-1,3,3).data;let error=255;for(let offset=0;offset<pixels.length;offset+=4)error=Math.min(error,Math.max(...[92,107,125].map((v,j)=>Math.abs(v-pixels[offset+j]))));errors.push(error);}
 return errors;
}

it('delivers the owned two-plan exhibition through actual PDF selection/calibration, eight-page PDF, independent GLB geometry and locked local Worker Scene viewing',async()=>{
 (globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
 vi.stubGlobal('Blob',NodeBlob);vi.stubGlobal('DOMMatrix',DOMMatrix);vi.stubGlobal('Path2D',Path2D);vi.stubGlobal('ImageData',ImageData);
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.open=true;}});
 const create=document.createElement.bind(document);vi.spyOn(document,'createElement').mockImplementation(((tag:string,options?:ElementCreationOptions)=>tag==='canvas'?createCanvas(1,1) as unknown as HTMLCanvasElement:create(tag,options)) as typeof document.createElement);
 vi.stubGlobal('FileReader',class {result:ArrayBuffer|string|null=null;onloadend:(()=>void)|null=null;readAsArrayBuffer(blob:Blob){void blob.arrayBuffer().then(bytes=>{const copy=new ArrayBuffer(bytes.byteLength);new Uint8Array(copy).set(new Uint8Array(bytes));this.result=copy;this.onloadend?.();});}readAsDataURL(blob:Blob){void blob.arrayBuffer().then(bytes=>{this.result=`data:${blob.type};base64,${Buffer.from(bytes).toString('base64')}`;this.onloadend?.();});}});
 const inputBytes=new Uint8Array(await readFile('docs/validation/scene-plan-2026-10-11/project.gonggan.zip')),input=await importProjectPackage(inputBytes.slice().buffer),font=new Uint8Array(await readFile('public/fonts/NotoSansKR-Regular.ttf'));
 useEditor.getState().loadProject(input);container=document.createElement('div');document.body.append(container);root=createRoot(container);
 service=commentFixture();const calls:Array<{path:string;method:string;status:number}>=[];
 vi.stubGlobal('fetch',vi.fn(async(url:RequestInfo|URL,init:RequestInit={})=>{const path=String(url);if(path==='/fonts/NotoSansKR-Regular.ttf')return new Response(font);if(path.startsWith('/api/')){const response=await service!.bridge(path,init);calls.push({path,method:init.method??'GET',status:response.status});return response;}throw new Error('Unexpected fetch '+path);}));
 async function wait(check:()=>void){await vi.waitFor(async()=>{await act(async()=>{await new Promise(r=>setTimeout(r,0));});check();},{timeout:10000});}
 async function click(label:string){const button=[...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.trim()===label||b.getAttribute('aria-label')===label)!;expect(button,label).toBeTruthy();expect(button.disabled).toBe(false);await act(async()=>button.click());}
 async function toggle(label:string){const el=[...container.querySelectorAll('label')].find(l=>l.textContent?.trim()===label)?.querySelector<HTMLInputElement>('input[type="checkbox"]')!;expect(el,label).toBeTruthy();await act(async()=>el.click());}
 // The current reference is still uncalibrated, but saved A has measured walls.
 await act(async()=>root!.render(<StrictMode><PdfDialog onClose={()=>{}} getCamera={()=>undefined}/></StrictMode>));
 await toggle('현재 배치');await toggle('도면 A');await toggle('3D 공간');await toggle('벽면도');await click('PDF 저장');
 await wait(()=>expect(downloadBlob).toHaveBeenCalledTimes(1));const selectedA=vi.mocked(downloadBlob).mock.calls[0][0];expect((await PDFDocument.load(new Uint8Array(await selectedA.arrayBuffer()))).getPageCount()).toBe(2);expect(useEditor.getState().project).toEqual(input);
 // Calibrating reference B changes only its image anchor/scale, never the
 // existing millimetre walls from A. Retain the old uncalibrated B Scene.
 await act(async()=>root!.render(<StrictMode><LengthUnitContext.Provider value="cm"><PlanView/></LengthUnitContext.Provider></StrictMode>));await click('두 점 축척 보정');
 const svg=container.querySelector('svg.plan-svg')!;Object.defineProperty(svg,'getScreenCTM',{configurable:true,value:()=>({inverse:()=>({a:1,b:0,c:0,d:1,e:0,f:0})})});vi.stubGlobal('DOMPoint',class {constructor(public x:number,public y:number){}matrixTransform(){return {x:this.x,y:this.y};}});
 const r=input.planReference!;for(const x of [100,200])await act(async()=>svg.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,button:0,clientX:r.origin.x+x*r.mmPerPixel,clientY:r.origin.z+100*r.mmPerPixel})));
 const field=container.querySelector<HTMLInputElement>('[aria-label="보정 실제 길이"]')!;await act(async()=>field.focus());await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(field,'100');field.dispatchEvent(new Event('input',{bubbles:true}));});await act(async()=>field.blur());await click('축척 적용');
 await act(async()=>{expect(useEditor.getState().saveScene('도면 B · 보정')).toBe(true);useEditor.getState().patchNote({type:'project'},{text:'PRIVATE_DELIVERY_NOTE'});});
 const project=structuredClone(useEditor.getState().project),sceneA=project.scenes[0],oldB=project.scenes[1],sceneB=project.scenes[2];expect(project.walls).toEqual(input.walls);expect(project.planReference?.calibrated).toBe(true);expect(project.planReference!.mmPerPixel).toBeCloseTo(10,12);
 const fetches=vi.mocked(fetch).mock.calls.length;await expect(exportProjectPdf(project,{current:false,sceneIds:[oldB.id],threeD:false,plan:true,elevation:false,allWallFaces:false},undefined)).rejects.toThrow(/도면 B.*축척/);expect(vi.mocked(fetch)).toHaveBeenCalledTimes(fetches);
 const layouts=[sceneProject(project,sceneA),sceneProject(project,sceneB)],pages=[sceneA,sceneB].flatMap(s=>[{id:s.id+'plan',kind:'plan' as const,sceneId:s.id},...s.structure!.walls.map(w=>({id:s.id+w.id,kind:'elevation' as const,sceneId:s.id,wallId:w.id,side:'front' as const})),{id:s.id+'list',kind:'schedule' as const,sceneId:s.id}]);
 const pdfBlob=await exportProjectPdf(project,{current:false,sceneIds:[sceneA.id,sceneB.id],threeD:false,plan:true,elevation:true,allWallFaces:true,pages},undefined),pdfBytes=new Uint8Array(await pdfBlob.arrayBuffer()),{getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs'),task=getDocument({data:pdfBytes.slice(),useSystemFonts:false}),pdf=await task.promise,pdfErrors:number[]=[],renders:Uint8Array[]=[];
 try{expect(pdf.numPages).toBe(8);for(let i=0;i<8;i++){const page=await pdf.getPage(i+1),text=(await page.getTextContent()).items.map(v=>'str' in v?v.str:'').join(' ');expect(text).toContain(i<4?sceneA.name:sceneB.name);expect(text).not.toMatch(/PRIVATE|planImageUrl|sourcePlan/);if(i%4===3){for(const w of layouts[Math.floor(i/4)].walls)expect(text).toContain(Math.round(Math.hypot(w.end.x-w.start.x,w.end.z-w.start.z)).toLocaleString('en-US'));}
  if(i%4!==0)continue;const viewport=page.getViewport({scale:2}),canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));await page.render({canvas:canvas as unknown as HTMLCanvasElement,viewport}).promise;
  const errors=pdfWallLineErrors(canvas,viewport,layouts[i/4]);expect(Math.max(...errors)).toBeLessThanOrEqual(3);pdfErrors.push(...errors);expect(Math.max(...pdfWallLineErrors(canvas,viewport,layouts[1-i/4]))).toBeGreaterThan(50);
  renders.push(new Uint8Array(canvas.toBuffer('image/png')));
 }}finally{await task.destroy();}
 const glbs:Uint8Array[]=[],glbErrors:number[]=[];
 for(const p of layouts){const blob=await exportProjectGlb(p),bytes=new Uint8Array(await blob.arrayBuffer()),model=await loadStaticModel(bytes.slice().buffer);try{for(const w of p.walls){const mesh=model.scene.getObjectByName('wall-'+w.id);expect(mesh).toBeInstanceOf(Mesh);const error=meshError(mesh as Mesh,w);expect(error).toBeLessThan(.003);glbErrors.push(error);expect(meshError(mesh as Mesh,{...w,start:{...w.start,x:w.start.x+100},end:{...w.end,x:w.end.x+100}})).toBeGreaterThan(20);}}finally{disposeModelAsset(model.scene);}glbs.push(bytes);}
 const presentation=await prepareSharePresentation(project,{includeDimensions:true,includeArtworkDetails:true,sceneIds:[sceneA.id,sceneB.id]});expect(presentation.uploads).toHaveLength(0);expect(presentation.snapshot.scenes).toHaveLength(2);expect(JSON.stringify(presentation.snapshot)).not.toMatch(/PRIVATE|data:image|planReference|planDraft|sourcePlan/);
 const draft=await service.call('POST','/api/shares','account-a');expect(draft.status).toBe(201);const id=(await draft.json()).id as string;expect((await service.call('POST',`/api/shares/${id}/publish`,'account-a',presentation.snapshot)).status).toBe(201);
 const editorBefore=useEditor.getState().project;await act(async()=>root!.render(<StrictMode><SharedViewer shareId={id}/></StrictMode>));await wait(()=>expect(container.querySelector('.shared-viewer')).not.toBeNull());await click('평면');
 const publicSnapshots=JSON.parse(JSON.stringify(presentation.snapshot));
 for(const [i,scene] of [sceneA,sceneB].entries()){await click(scene.name);const lines=container.querySelectorAll('.shared-stage svg g.shared-selectable > line:first-child');expect(lines).toHaveLength(2);for(const [j,line] of [...lines].entries()){const w=layouts[i].walls[j];expect(['x1','y1','x2','y2'].map(k=>Number(line.getAttribute(k)))).toEqual([w.start.x,w.start.z,w.end.x,w.end.z]);}await act(async()=>lines[0].dispatchEvent(new MouseEvent('click',{bubbles:true})));expect(container.querySelector('.shared-info')?.textContent).toContain(i?'길이 836 cm':'길이 796 cm');expect(container.querySelector('input[type="number"],textarea,[contenteditable="true"],.drag-handle')).toBeNull();await act(async()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true})));}
 expect(useEditor.getState().project).toBe(editorBefore);expect(presentation.snapshot).toEqual(publicSnapshots);expect((await service.call('DELETE',`/api/shares/${id}`,'account-b')).status).toBe(404);expect((await service.call('DELETE',`/api/shares/${id}`,'account-a')).status).toBe(204);
 Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});await act(async()=>document.dispatchEvent(new Event('visibilitychange')));await wait(()=>expect(container.querySelector('.shared-viewer')).toBeNull());expect((await service.call('GET',`/api/public/${id}`)).status).toBe(410);
 const backup=await exportProjectPackage(project,async()=>{throw new Error('Unexpected sample');});expect(await importProjectPackage(await backup.arrayBuffer())).toEqual(project);expect(parseProject(project)).toEqual(project);
 if(process.env.GONGGAN_SCENE_PLAN_DELIVERY_PROOF==='1'){const dir='docs/validation/scene-plan-delivery-2026-10-11';await mkdir(dir,{recursive:true});await writeFile(dir+'/selected-A.pdf',new Uint8Array(await selectedA.arrayBuffer()));await writeFile(dir+'/project.pdf',pdfBytes);await writeFile(dir+'/project.json',JSON.stringify(project,null,2)+'\n');await writeFile(dir+'/public.json',JSON.stringify(presentation.snapshot,null,2)+'\n');await writeFile(dir+'/project.gonggan.zip',new Uint8Array(await backup.arrayBuffer()));for(const [i,p] of layouts.entries()){await writeFile(dir+`/Scene-${i?'B':'A'}.json`,JSON.stringify(p,null,2)+'\n');await writeFile(dir+`/Scene-${i?'B':'A'}.glb`,glbs[i]);await writeFile(dir+`/PDF-${i?'B':'A'}.png`,renders[i]);}await writeFile(dir+'/workflow.json',JSON.stringify({date:'2026-10-11',inputBackupSha256:hash(inputBytes),pdfPages:8,selectedAOnlyPages:2,pdfSha256:hash(pdfBytes),pdfWallCenterlineRgbSamples:pdfErrors.length,pdfWallCenterlineRgbMaxError:Math.max(...pdfErrors),negativeWrongPdfSceneRejected:true,glbWallCornerMaxErrorMm:Math.max(...glbErrors),negative100mmShiftRejected:true,scenes:layouts.map((p,i)=>({file:`Scene-${i?'B':'A'}.glb`,projectFile:`Scene-${i?'B':'A'}.json`,sha256:hash(glbs[i]),walls:p.walls.map(w=>({id:w.id,start:w.start,end:w.end,heightMm:w.heightMm,thicknessMm:w.thicknessMm}))})),sharing:{localWorker:true,scenes:2,readOnly:true,apiCalls:calls,wrongOwnerDelete:404,ownerDelete:204,publicAfterRevoke:410},backupExact:true,gpuMeasured:false,limitations:['Owned two-JPEG fixture from prior UI/native plan workflow; B reference calibrated through actual PlanView','Native PDF.js vector raster and Three GLB importer, no browser/GPU or 3D capture pixels','Synthetic local SQLite/R2/auth Worker publication; not operational URL/account/two-device acceptance']},null,2)+'\n');}
},60000);
