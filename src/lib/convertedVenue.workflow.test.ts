import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createCanvas,loadImage,Image as NativeImage,type Canvas} from '@napi-rs/canvas';
import {Box3,Mesh,Vector3,type Object3D,type MeshStandardMaterial} from 'three';
import {artworkTestGltf} from './modelArtworkTestFixture';
import {packEmbeddedGltf} from './artworkModelPayload';
import {readModelFile,readModelWalls} from './modelImport';
import {loadStaticModel} from './loadStaticModel';
import {disposeModelAsset} from './modelAssetResources';
import {exportProjectPackage,importProjectPackage} from './projectPackage';
import {prepareSharePresentation} from './sharePresentation';
import {exportProjectGlb} from './modelExport';
import {createDemoProject,parseProject,wallLength} from '../domain/model';
import {floorFromLoops} from '../domain/importedFloor';
import {resolveMeasurement,wallAnchor} from '../domain/measurements';
import {artworkElevationDimensions} from '../domain/artworkElevationDimensions';
import {sceneProject} from '../domain/sceneProject';
import {useEditor} from '../state/editor';
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
class ImageTransport{
 native?:NativeImage;naturalWidth=0;naturalHeight=0;onload?:()=>void;onerror?:()=>void;
 set src(url:string){if(url)void loadImage(url).then(image=>{this.native=image;this.naturalWidth=image.width;this.naturalHeight=image.height;this.onload?.();},()=>this.onerror?.());}
}
beforeEach(()=>{
 // Native pixels and file transport only, no renderer or geometry mocks.
 vi.stubGlobal('self',{URL});vi.stubGlobal('Image',ImageTransport);vi.stubGlobal('ImageBitmap',NativeImage);vi.stubGlobal('HTMLCanvasElement',createCanvas(1,1).constructor);
 vi.stubGlobal('createImageBitmap',async(blob:Blob)=>Object.assign(await loadImage(Buffer.from(await blob.arrayBuffer())),{close(){}}));
 vi.stubGlobal('FileReader',class{result:unknown;onload?:()=>void;onloadend?:()=>void;readAsArrayBuffer(blob:Blob){void blob.arrayBuffer().then(b=>{this.result=b;this.onload?.();this.onloadend?.();});}readAsDataURL(blob:Blob){void blob.arrayBuffer().then(b=>{this.result='data:'+blob.type+';base64,'+Buffer.from(b).toString('base64');this.onload?.();this.onloadend?.();});}});
 vi.stubGlobal('document',{createElement:()=>{const c=createCanvas(1,1),ctx=c.getContext('2d'),draw=ctx.drawImage.bind(ctx);ctx.drawImage=((image:ImageTransport|NativeImage|Canvas,...args:unknown[])=>Reflect.apply(draw,ctx,[image instanceof ImageTransport?image.native!:image,...args])) as typeof ctx.drawImage;Object.defineProperty(c,'data',{value:undefined});Object.assign(c,{toBlob:(done:(b:Blob)=>void)=>done(new Blob([new Uint8Array(c.toBuffer('image/png'))],{type:'image/png'}))});return c;}});
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
function editableVenue(){
 const {doc}=artworkTestGltf();
 const nodes=[{mesh:0,translation:[0,1.5,-3],scale:[8,3,.2]},{mesh:0,translation:[-4,1.5,0],scale:[.2,3,6]},{mesh:0,translation:[4,1.5,0],scale:[.2,3,6]},{mesh:0,translation:[0,1.5,0],scale:[4,3,.2]},{mesh:1,translation:[0,.075,0],scale:[8,.15,6]}];
 return new Uint8Array(packEmbeddedGltf({...doc,nodes,scenes:[{nodes:nodes.map((_,i)=>i)}]}));
}
function imageUrl(index:number){const c=createCanvas(32,48),ctx=c.getContext('2d');ctx.fillStyle=['#4b85bf','#f4bd5a','#aa4354','#4c936c','#886ab2'][index];ctx.fillRect(0,0,32,48);ctx.fillStyle='#ffffff';ctx.fillRect(3+index,4,4,40);return c.toDataURL('image/png');}
function bounds(root:Object3D){const b=new Box3().setFromObject(root,true);return {min:b.min.toArray(),max:b.max.toArray()};}
it('converts an actual model and reinstalls the same five artworks through measurements, two wall faces, Scene/Undo, exact backup and public/GLB delivery',async()=>{
 const input=editableVenue(),sourceHash=hash(input),model={...await readModelFile(new File([input],'EditableVenue.glb')),positionMm:[1000,0,-2000] as [number,number,number],rotationDeg:30,scale:1.25},result=await readModelWalls(model);
 expect(result.walls).toHaveLength(4);expect(result.unresolvedFloor).toBeUndefined();expect(Math.abs(floorFromLoops(result.importedFloor!).areaMm2-75_000_000)).toBeLessThan(20000);
 const yaw=model.rotationDeg*Math.PI/180;for(const [x,z] of [[-4,-3],[4,-3],[4,3],[-4,3]]){const a=(x+model.sourceOffsetM[0])*model.scale,b=(z+model.sourceOffsetM[2])*model.scale,px=(a*Math.cos(yaw)+b*Math.sin(yaw))*1000+model.positionMm[0],pz=(-a*Math.sin(yaw)+b*Math.cos(yaw))*1000+model.positionMm[2];expect(Math.min(...result.importedFloor!.flat().map(p=>Math.hypot(p.x-px,p.z-pz)))).toBeLessThan(.8);}
 const p=createDemoProject();p.id='converted-venue-20261011';p.name='변환 후 작품 재설치';p.referenceModel=model;p.scenes=[];p.lights=[];p.artworks=p.artworks.map((a,i)=>({...a,widthMm:400+i*100,heightMm:600,frame:'none',imageUrl:imageUrl(i),note:'PRIVATE_ART_'+i}));p.note='PRIVATE_PROJECT';
 useEditor.getState().loadProject(p,true);useEditor.getState().saveScene('기존 공간');const before=useEditor.getState().project;useEditor.getState().adoptModelWalls(result.walls,model,result.importedFloor);const converted=useEditor.getState().project;
 expect(converted.artworks).toEqual([]);expect(converted.unplacedArtworks).toHaveLength(5);expect(converted.referenceModel?.visible).toBe(false);expect(converted.scenes[0].structure?.walls).toEqual(before.walls);
 useEditor.getState().undo();expect(useEditor.getState().project).toEqual(before);useEditor.getState().redo();expect(useEditor.getState().project).toEqual(converted);
 const wall=converted.walls.reduce((a,b)=>wallLength(a)>wallLength(b)?a:b),length=wallLength(wall),ids=p.artworks.map(a=>a.id),scenes=[] as string[],outputs=[] as Array<{name:string;bytes:ArrayBuffer;artworks:Array<{id:string;bounds:ReturnType<typeof bounds>}>}>;
 useEditor.getState().setTool('measure');useEditor.getState().pickMeasurement(wallAnchor(converted,wall.id,{...wall.start,y:0}),'plan');useEditor.getState().pickMeasurement(wallAnchor(converted,wall.id,{...wall.end,y:0}),'plan');useEditor.getState().saveMeasurement();
 expect(resolveMeasurement(useEditor.getState().project,useEditor.getState().project.dimensions![0])).toMatchObject({detached:false,verticalMm:0});expect(resolveMeasurement(useEditor.getState().project,useEditor.getState().project.dimensions![0]).distanceMm).toBeCloseTo(length,6);
 for(const [index,side] of (['front','back'] as const).entries()){
  const gapMm=200+index*100,height=1500+index*300;expect(useEditor.getState().arrangeArtworkSeries({artworkIds:ids,count:5,wallId:wall.id,wallSide:side,axis:'horizontal',gapMm,centerHeightMm:height,group:true},p.id)).toBe(true);const installed=useEditor.getState().project;expect(installed.unplacedArtworks).toEqual([]);
  let cursor=(length-3000-gapMm*4)/2;for(const [i,a] of installed.artworks.entries()){const x=cursor+(400+i*100)/2;expect(a.alongMm).toBeCloseTo(side==='back'?length-x:x,5);expect(a.centerHeightMm).toBe(height);expect(a.widthMm).toBe(p.artworks[i].widthMm);expect(a.imageUrl).toBe(p.artworks[i].imageUrl);expect(a.note).toBe(p.artworks[i].note);cursor+=400+i*100+gapMm;}
  const dimensions=artworkElevationDimensions(installed,wall.id,side,ids).filter(d=>d.kind==='gap');expect(dimensions).toHaveLength(4);dimensions.forEach(d=>expect(d.distanceMm).toBeCloseTo(gapMm,5));
  useEditor.getState().saveScene(index?'B면 설치':'A면 설치');const s=useEditor.getState().project.scenes.at(-1)!;scenes.push(s.id);useEditor.getState().patchArtwork(ids[0],{centerHeightMm:height+50});useEditor.getState().restoreScene(s.id);expect(useEditor.getState().project.artworks).toEqual(installed.artworks);expect(useEditor.getState().project.dimensions).toEqual(installed.dimensions);
 }
 const final=useEditor.getState().project,json=JSON.stringify(final);expect(JSON.stringify(parseProject(JSON.parse(json)))).toBe(json);const backup=await exportProjectPackage(final,async()=>{throw new Error('No external assets');});expect(JSON.stringify(await importProjectPackage(await backup.arrayBuffer()))).toBe(json);
 const publicAssets=await prepareSharePresentation(final,{includeDimensions:true,sceneIds:scenes});expect(publicAssets.snapshot.scenes).toHaveLength(2);expect(publicAssets.uploads.length).toBe(5);expect(publicAssets.models.size).toBe(0);expect(JSON.stringify(publicAssets.snapshot)).not.toMatch(/PRIVATE|unplacedArtworks|dataUrl/);
 for(const sceneId of scenes){const s=final.scenes.find(s=>s.id===sceneId)!,layout=sceneProject(final,s),blob=await exportProjectGlb(layout),buffer=await blob.arrayBuffer(),received=await loadStaticModel(buffer);try{
  expect(received.scene.getObjectByName('EditableVenue.glb')).toBeUndefined();expect(layout.referenceModel?.visible).toBe(false);expect(new TextDecoder().decode(buffer)).not.toContain('PRIVATE');const arts=[] as typeof outputs[number]['artworks'];
  for(const a of layout.artworks){const root=received.scene.getObjectByName('artwork-'+a.id)!;expect(root).toBeTruthy();expect(root.getWorldPosition(new Vector3()).y*1000).toBeCloseTo(a.centerHeightMm,3);const w=layout.walls.find(w=>w.id===a.wallId)!,dx=(w.end.x-w.start.x)/wallLength(w),dz=(w.end.z-w.start.z)/wallLength(w),sign=a.wallSide==='back'?-1:1,offset=w.thicknessMm/2+a.depthMm/2+5,pose=root.getWorldPosition(new Vector3());expect(pose.x*1000).toBeCloseTo(w.start.x+dx*a.alongMm-dz*sign*offset,3);expect(pose.z*1000).toBeCloseTo(w.start.z+dz*a.alongMm+dx*sign*offset,3);let image:Mesh|undefined;root.traverse(o=>{if(o instanceof Mesh&&o.name.startsWith('image'))image=o;});expect(image).toBeTruthy();const material=image!.material as MeshStandardMaterial,texture=material.map!;expect(texture.image.width).toBe(32);expect(texture.image.height).toBe(48);const original=await loadImage(a.imageUrl),expected=createCanvas(32,48),actual=createCanvas(32,48);expected.getContext('2d').drawImage(original,0,0);actual.getContext('2d').drawImage(texture.image,0,0);expect(Buffer.from(actual.getContext('2d').getImageData(0,0,32,48).data)).toEqual(Buffer.from(expected.getContext('2d').getImageData(0,0,32,48).data));arts.push({id:a.id,bounds:bounds(root)});}
  outputs.push({name:s.name,bytes:buffer,artworks:arts});
 }finally{disposeModelAsset(received.scenes);}}
 expect(JSON.stringify(useEditor.getState().project)).toBe(json);expect(hash(input)).toBe(sourceHash);
 if(process.env.GONGGAN_CONVERTED_VENUE_PROOF==='1'){const dir='docs/validation/converted-venue-2026-10-11';await mkdir(dir,{recursive:true});await writeFile(dir+'/input.glb',input);await writeFile(dir+'/project.gonggan.zip',new Uint8Array(await backup.arrayBuffer()));await writeFile(dir+'/public.json',JSON.stringify(publicAssets.snapshot,null,2)+'\n');for(const [i,o] of outputs.entries())await writeFile(dir+`/Scene-${i?'B':'A'}.glb`,new Uint8Array(o.bytes));await writeFile(dir+'/workflow.json',JSON.stringify({date:'2026-10-11',sourceHash,extractedWalls:result.walls.length,floorAreaMm2:floorFromLoops(result.importedFloor!).areaMm2,reinstalledOriginalArtworks:5,gapsMm:[200,300],centerHeightsMm:[1500,1800],measuredWallMm:length,backupExactJson:true,publicScenes:2,publicImages:5,publicModels:0,glbImagesPerScene:5,allNativeImagePixelsPreserved:true,scenes:outputs.map((o,i)=>({name:o.name,file:`Scene-${i?'B':'A'}.glb`,sha256:hash(new Uint8Array(o.bytes)),artworks:o.artworks})),gpuMeasured:false,limitations:['Owned convertible fixture; not automatic reconstruction of arbitrary venues','Actual model/store/series/measurement/Scene/backup/public/export paths, with native file/pixel transport','No browser/GPU or operating sharing/auth/SketchUp/full acceptance']},null,2)+'\n');}
},30000);
