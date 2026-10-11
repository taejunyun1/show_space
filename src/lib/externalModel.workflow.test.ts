import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createCanvas,loadImage,Image as NativeImage} from '@napi-rs/canvas';
import {Box3,Mesh,Vector3,SRGBColorSpace,NoColorSpace,type Object3D,type MeshStandardMaterial} from 'three';
import JSZip from 'jszip';
import {readModelArtworkFiles,artworkModelBytes} from './modelArtworkImport';
import {readModelFile} from './modelImport';
import {loadStaticModel} from './loadStaticModel';
import {disposeModelAsset} from './modelAssetResources';
import {modelAssetBounds} from './modelArtworkGeometry';
import {inspectStaticArtworkGlb} from './artworkModelPayload';
import {createDemoProject,parseProject} from '../domain/model';
import {addModelArtwork,patchModelArtwork} from '../domain/modelArtworks';
import {appendSceneSnapshot} from '../domain/sceneSnapshot';
import {sceneProject} from '../domain/sceneProject';
import {exportProjectPackage,importProjectPackage} from './projectPackage';
import {exportProjectGlb,exportProjectGltf} from './modelExport';
import {preparePublicModels} from './publicModelAsset';
import {createPublicShare} from '../domain/publicShare';
import type {ModelArtwork,Project} from '../domain/types';

const filePath='docs/validation/external-models-2026-10-11/BoomBox.glb';
const sourceHash='f8b918445ebdd006768232205a62f5182d2208ca57f84c6ccc084943c0bc8f15';
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
beforeEach(()=>{
 // Native PNG decode/encode only: actual loader, geometry, PBR materials,
 // exporter, ZIP parser and package restoration run without a GPU renderer.
 vi.stubGlobal('self',{URL});vi.stubGlobal('ImageBitmap',NativeImage);vi.stubGlobal('HTMLCanvasElement',createCanvas(1,1).constructor);
 vi.stubGlobal('createImageBitmap',async(blob:Blob)=>Object.assign(await loadImage(Buffer.from(await blob.arrayBuffer())),{close(){}}));
 vi.stubGlobal('FileReader',class {result:ArrayBuffer|string|null=null;onload:(()=>void)|null=null;onloadend:(()=>void)|null=null;readAsArrayBuffer(blob:Blob){void blob.arrayBuffer().then(bytes=>{this.result=bytes;this.onload?.();this.onloadend?.();});}readAsDataURL(blob:Blob){void blob.arrayBuffer().then(bytes=>{this.result=`data:${blob.type||'application/octet-stream'};base64,${Buffer.from(bytes).toString('base64')}`;this.onload?.();this.onloadend?.();});}});
 vi.stubGlobal('ProgressEvent',class {constructor(public type:string,init:unknown){Object.assign(this,init);}});
 vi.stubGlobal('document',{createElement:()=>{const canvas=createCanvas(1,1);Object.defineProperty(canvas,'data',{value:undefined});Object.assign(canvas,{toBlob:(done:(b:Blob)=>void)=>done(new Blob([new Uint8Array(canvas.toBuffer('image/png'))],{type:'image/png'}))});return canvas;}});
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
function parts(root:Object3D){const result:Mesh[]=[];root.traverse(o=>{if(o instanceof Mesh)result.push(o);});return result;}
function bytes(url:string){return new Uint8Array(Buffer.from(url.split(',')[1],'base64'));}
function imageBytes(buffer:ArrayBuffer,doc:ReturnType<typeof inspectStaticArtworkGlb>,index:number){const view=new DataView(buffer),base=28+view.getUint32(12,true),image=doc.images[index],bv=doc.bufferViews[image.bufferView];return new Uint8Array(buffer,base+(bv.byteOffset??0),bv.byteLength);}
function manualBounds(source:Object3D,a:ModelArtwork){
 const [rx,ry,rz]=[a.rotation.x,a.rotation.y,a.rotation.z].map(n=>n*Math.PI/180),cx=Math.cos(rx),sx=Math.sin(rx),cy=Math.cos(ry),sy=Math.sin(ry),cz=Math.cos(rz),sz=Math.sin(rz),points:Vector3[]=[];
 source.updateMatrixWorld(true);for(const mesh of parts(source)){const p=mesh.geometry.getAttribute('position');for(let i=0;i<p.count;i++){const v=mesh.localToWorld(new Vector3().fromBufferAttribute(p,i));const x=(v.x+a.model.sourceOffsetM[0])*a.widthMm/a.model.sizeMm[0],y=(v.y+a.model.sourceOffsetM[1])*a.heightMm/a.model.sizeMm[1],z=(v.z+a.model.sourceOffsetM[2])*a.depthMm/a.model.sizeMm[2];points.push(new Vector3(cy*cz*x-cy*sz*y+sy*z+a.position.x/1000,(cx*sz+sx*sy*cz)*x+(cx*cz-sx*sy*sz)*y-sx*cy*z+a.position.y/1000,(sx*sz-cx*sy*cz)*x+(sx*cz+cx*sy*sz)*y+cx*cy*z+a.position.z/1000));}}
 return new Box3().setFromPoints(points);
}
const nearBox=(actual:Box3,expected:Box3)=>{actual.min.toArray().forEach((n,i)=>expect(n).toBeCloseTo(expected.min.toArray()[i],5));actual.max.toArray().forEach((n,i)=>expect(n).toBeCloseTo(expected.max.toArray()[i],5));};

it('keeps an external CC0 PBR model through actual import, two Scene poses, exact package restore, public assets and GLB/glTF delivery',async()=>{
 const input=new Uint8Array(await readFile(filePath));expect(hash(input)).toBe(sourceHash);const original=input.slice().buffer,doc=inspectStaticArtworkGlb(original);expect(doc.images).toHaveLength(4);const file=new File([original],'BoomBox.glb');
 const model=await readModelArtworkFiles([file]),venue=await readModelFile(file);expect(Buffer.from(bytes(model.dataUrl)).equals(Buffer.from(input))).toBe(true);expect(venue.sizeMm).toEqual(model.sizeMm);expect(venue.sourceOffsetM).toEqual(model.sourceOffsetM);
 const source=await loadStaticModel(original);
 try{
  const sourceParts=parts(source.scene);expect(sourceParts).toHaveLength(1);const mesh=sourceParts[0],material=mesh.material as MeshStandardMaterial;expect(mesh.geometry.getAttribute('position').count).toBe(3575);expect(mesh.geometry.index?.count).toBe(18108);expect(modelAssetBounds(source.scene)).toEqual({sizeMm:model.sizeMm,sourceOffsetM:model.sourceOffsetM});
  for(const map of [material.map,material.normalMap,material.metalnessMap,material.roughnessMap,material.aoMap,material.emissiveMap]){expect(map).toBeTruthy();expect(map!.image.width).toBe(2048);expect(map!.image.height).toBe(2048);expect(map!.flipY).toBe(false);}
  expect(material.map!.colorSpace).toBe(SRGBColorSpace);expect(material.emissiveMap!.colorSpace).toBe(SRGBColorSpace);expect(material.normalMap!.colorSpace).toBe(NoColorSpace);expect(material.normalScale.toArray()).toEqual([1,1]);
  const base=createDemoProject();base.id='external-boombox-20261011';base.name='외부 PBR 모델 검증';base.artworks=[];base.scenes=[];base.walls=base.walls.slice(0,1).map(w=>({...w,role:'partition',visible:false}));base.lights=[];const added=addModelArtwork(base,model);let project=patchModelArtwork(added.project,added.artwork.id,{widthMm:500,heightMm:400,depthMm:250,position:{x:3000,y:150,z:-2000},rotation:{x:0,y:0,z:0},artist:'Microsoft · CC0',note:'PRIVATE_EXTERNAL_MODEL_NOTE'});
  project=appendSceneSnapshot(project,project,'Scene A');project=patchModelArtwork(project,added.artwork.id,{widthMm:700,heightMm:500,depthMm:350,position:{x:1600,y:200,z:700},rotation:{x:25,y:37,z:-13}});project=appendSceneSnapshot(project,project,'Scene B');project=parseProject(project);const before=JSON.stringify(project);
  const backup=await exportProjectPackage(project,async()=>{throw new Error('No external image URL should be requested');}),packed=await backup.arrayBuffer(),zip=await JSZip.loadAsync(packed,{checkCRC32:true}),manifest=JSON.parse(await zip.file('manifest.json')!.async('string'));expect(manifest.assets).toHaveLength(1);expect(manifest.assets[0].sha256).toBe(sourceHash);const restored=await importProjectPackage(packed);expect(hash(Buffer.from(JSON.stringify(restored)))).toBe(hash(Buffer.from(before)));
  const publicModels=await preparePublicModels(project),pub=createPublicShare(project,{includeDimensions:true,modelAssetIds:publicModels.ids}).snapshot;expect(publicModels.uploads.size).toBe(1);expect(JSON.stringify(pub)).not.toContain('PRIVATE');const publicBytes=[...publicModels.uploads.values()][0],publicDoc=inspectStaticArtworkGlb(publicBytes);expect(publicDoc.asset.generator).toBeUndefined();for(let i=0;i<4;i++)expect(Buffer.from(imageBytes(publicBytes,publicDoc,i)).equals(Buffer.from(imageBytes(original,doc,i)))).toBe(true);
  const outputs:Array<{name:string;buffer:ArrayBuffer;project:Project;bounds:{min:number[];max:number[]};materialSlots:number;imagePixelsCompared:number}>=[];
  for(const scene of project.scenes){
   const layout=sceneProject(project,scene),art=layout.modelArtworks![0],expected=manualBounds(source.scene,art),glb=await exportProjectGlb(layout),buffer=await glb.arrayBuffer(),outputDoc=inspectStaticArtworkGlb(buffer),received=await loadStaticModel(buffer);
   try{const root=received.scene.getObjectByName('model-artwork-'+art.id)!;expect(root).toBeDefined();nearBox(new Box3().setFromObject(root,true),expected);const r=parts(root)[0],m=r.material as MeshStandardMaterial;expect([...r.geometry.getAttribute('position').array]).toEqual([...mesh.geometry.getAttribute('position').array]);expect([...r.geometry.getAttribute('normal').array]).toEqual([...mesh.geometry.getAttribute('normal').array]);expect([...r.geometry.getAttribute('uv').array]).toEqual([...mesh.geometry.getAttribute('uv').array]);expect([...r.geometry.index!.array]).toEqual([...mesh.geometry.index!.array]);expect(m.normalScale.toArray()).toEqual(material.normalScale.toArray());expect(m.emissive.toArray()).toEqual(material.emissive.toArray());
    const pairs=[[m.map,material.map],[m.normalMap,material.normalMap],[m.metalnessMap,material.metalnessMap],[m.roughnessMap,material.roughnessMap],[m.aoMap,material.aoMap],[m.emissiveMap,material.emissiveMap]] as const;let pixelsCompared=0;
    for(const [actual,sourceMap] of pairs){expect(actual).toBeTruthy();expect(actual!.colorSpace).toBe(sourceMap!.colorSpace);expect(actual!.image.width).toBe(1024);expect(actual!.image.height).toBe(1024);const decoded=createCanvas(1024,1024),expectedImage=createCanvas(1024,1024);decoded.getContext('2d').drawImage(actual!.image,0,0);expectedImage.getContext('2d').drawImage(sourceMap!.image,0,0,1024,1024);for(const [x,y] of [[50,75],[233,877],[512,512],[940,137]]){expect([...decoded.getContext('2d').getImageData(x,y,1,1).data]).toEqual([...expectedImage.getContext('2d').getImageData(x,y,1,1).data]);pixelsCompared++;}}
    expect(outputDoc.images).toHaveLength(4);expect(new TextDecoder().decode(new Uint8Array(buffer))).not.toContain('PRIVATE_EXTERNAL_MODEL_NOTE');outputs.push({name:scene.name,buffer,project:layout,bounds:{min:expected.min.toArray(),max:expected.max.toArray()},materialSlots:6,imagePixelsCompared:pixelsCompared});
   }finally{disposeModelAsset(received.scenes);}
  }
  const gltfZip=await exportProjectGltf(sceneProject(project,project.scenes[1])),gltfBytes=await gltfZip.arrayBuffer(),unpacked=await JSZip.loadAsync(gltfBytes,{checkCRC32:true});expect(await unpacked.file('scene.gltf')!.async('string')).not.toContain('PRIVATE_EXTERNAL_MODEL_NOTE');const repacked=await artworkModelBytes([new File([gltfBytes],'BoomBox-delivery.zip')]),received=await loadStaticModel(repacked.bytes);try{const root=received.scene.getObjectByName('model-artwork-'+added.artwork.id)!;nearBox(new Box3().setFromObject(root,true),manualBounds(source.scene,project.modelArtworks![0]));expect((parts(root)[0].material as MeshStandardMaterial).normalMap).toBeTruthy();}finally{disposeModelAsset(received.scenes);}
  expect(JSON.stringify(project)).toBe(before);expect(hash(new Uint8Array(await readFile(filePath)))).toBe(sourceHash);
  if(process.env.GONGGAN_EXTERNAL_MODEL_PROOF==='1'){
   const dir='docs/validation/external-models-2026-10-11';await mkdir(dir,{recursive:true});await writeFile(dir+'/BoomBox.gonggan.zip',new Uint8Array(packed));await writeFile(dir+'/BoomBox.gltf.zip',new Uint8Array(gltfBytes));
   for(const output of outputs)await writeFile(dir+'/'+output.name.replace(' ','-')+'.glb',new Uint8Array(output.buffer));
   await writeFile(dir+'/workflow.json',JSON.stringify({date:'2026-10-11',sourceHash,sourceBytes:input.length,sourceVertices:3575,sourceTriangles:6036,sourceImages:4,sourceTextureSize:2048,backupAssets:1,exactRestoration:true,publicModelAssets:1,publicRawImageBytesPreserved:true,glbTextureLimit:1024,scenes:outputs.map(o=>({name:o.name,artwork:{...o.project.modelArtworks![0],model:{sizeMm:model.sizeMm,sourceOffsetM:model.sourceOffsetM}},bounds:o.bounds,materialSlots:o.materialSlots,imagePixelsCompared:o.imagePixelsCompared,glbSHA256:hash(new Uint8Array(o.buffer))})),gltfZipReloaded:true,sourceAndProjectUnchanged:true,gpuMeasured:false,limitations:['Native PNG transport, no actual browser/GPU/UI/3D pixels','External CC0 BoomBox object; not a whole venue or arbitrary user model acceptance','GLB/glTF textures deliberately exported at existing 1024px limit; original 2048px bytes retained in project backup/public model','Actual deployed URL/account/device/SketchUp and full 24-step/user metrics remain']},null,2)+'\n');
  }
 }finally{disposeModelAsset(source.scenes);}
},30000);
