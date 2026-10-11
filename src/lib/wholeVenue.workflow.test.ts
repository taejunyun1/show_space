import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Mesh,Box3,Vector3,Raycaster,type Object3D} from 'three';
import JSZip from 'jszip';
import {readModelFile,readModelWalls} from './modelImport';
import {loadStaticModel} from './loadStaticModel';
import {disposeModelAsset} from './modelAssetResources';
import {placeReferenceModel} from './modelArtworkGeometry';
import {exportProjectGlb,exportProjectGltf} from './modelExport';
import {artworkModelBytes} from './modelArtworkImport';
import {exportProjectPackage,importProjectPackage} from './projectPackage';
import {prepareSharePresentation} from './sharePresentation';
import {createDemoProject,parseProject} from '../domain/model';
import {appendSceneSnapshot} from '../domain/sceneSnapshot';
import {sceneProject} from '../domain/sceneProject';
import type {ReferenceModel} from '../domain/types';
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
beforeEach(()=>{vi.stubGlobal('self',{URL});vi.stubGlobal('FileReader',class{result:unknown;onload?:()=>void;onloadend?:()=>void;readAsArrayBuffer(blob:Blob){void blob.arrayBuffer().then(b=>{this.result=b;this.onload?.();this.onloadend?.();});}readAsDataURL(blob:Blob){void blob.arrayBuffer().then(b=>{this.result='data:'+blob.type+';base64,'+Buffer.from(b).toString('base64');this.onload?.();this.onloadend?.();});}});});
afterEach(()=>vi.unstubAllGlobals());
function meshes(root:Object3D){const found:Mesh[]=[];root.traverse(o=>{if(o instanceof Mesh)found.push(o);});return found;}
function point(x:number,y:number,z:number,m:Pick<ReferenceModel,'sourceOffsetM'|'positionMm'|'rotationDeg'|'scale'|'sizeMm'>){const yaw=m.rotationDeg*Math.PI/180,c=Math.cos(yaw),s=Math.sin(yaw),a=(x+m.sourceOffsetM[0])*m.scale,b=(y+m.sourceOffsetM[1])*m.scale,d=(z+m.sourceOffsetM[2])*m.scale;return new Vector3(c*a+s*d+m.positionMm[0]/1000,b+m.positionMm[1]/1000,-s*a+c*d+m.positionMm[2]/1000);}
function expectedBounds(source:Object3D,m:Pick<ReferenceModel,'sourceOffsetM'|'positionMm'|'rotationDeg'|'scale'|'sizeMm'>){source.updateMatrixWorld(true);const points:Vector3[]=[];for(const mesh of meshes(source)){const p=mesh.geometry.getAttribute('position');for(let i=0;i<p.count;i++){const v=mesh.localToWorld(new Vector3().fromBufferAttribute(p,i));points.push(point(v.x,v.y,v.z,m));}}return new Box3().setFromPoints(points);}
function check(root:Object3D,source:Object3D,m:Pick<ReferenceModel,'sourceOffsetM'|'positionMm'|'rotationDeg'|'scale'|'sizeMm'>){
 const actual=new Box3().setFromObject(root,true),expected=expectedBounds(source,m);for(const key of ['min','max'] as const)actual[key].toArray().forEach((n,i)=>expect(n).toBeCloseTo(expected[key].toArray()[i],5));expect(meshes(root)).toHaveLength(450);root.updateMatrixWorld(true);
 for(let row=0;row<5;row++)for(let col=0;col<6;col++)for(const solid of [false,true]){const probe=point(10+col*12+(solid?-3.5:0),2,5+row*8,m);probe.y=m.positionMm[1]/1000+m.sizeMm[1]*m.scale/1000+10;const hits=new Raycaster(probe,new Vector3(0,-1,0)).intersectObject(root,true);if(solid)expect(hits.length).toBeGreaterThan(0);else expect(hits).toHaveLength(0);}
 return {min:expected.min.toArray(),max:expected.max.toArray()};
}
it('keeps the full 30-room model through partial extraction, two Scenes, exact backup, readonly data and GLB/glTF delivery',async()=>{
 const dir='docs/validation/whole-venue-2026-10-11',input=new Uint8Array(await readFile('docs/validation/model-preflight-2026-10-11/venue.glb')),sourceHash=hash(input),model={...await readModelFile(new File([input],'WholeVenue.glb')),name:'WholeVenue',note:'PRIVATE_SOURCE_NOTE'},result=await readModelWalls(model);
 expect(result.walls).toHaveLength(30);expect(result.triangles).toBe(5400);expect(result.importedFloor).toBeUndefined();expect(result.unresolvedFloor).toBe(true);
 const p=createDemoProject();p.id='whole-venue-20261011';p.name='전체 전시장 연결 검증';p.note='PRIVATE_PROJECT_NOTE';p.scenes=[];p.lights=[];p.referenceModel=model;
 const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=';p.unplacedArtworks=p.artworks.map(({wallId,...a})=>({...a,imageUrl:png}));p.artworks=[];p.walls=p.walls.slice(0,1).map(w=>({...w,visible:false,role:'partition'}));
 let project=appendSceneSnapshot(p,p,'Scene A');project={...project,referenceModel:{...model,positionMm:[3000,100,-2000],rotationDeg:30,scale:1.2}};project=appendSceneSnapshot(project,project,'Scene B');project=parseProject(project);const before=JSON.stringify(project),source=await loadStaticModel(input.slice().buffer);
 try{
  const backup=await exportProjectPackage(project,async()=>{throw new Error('No remote assets');}),backupBytes=await backup.arrayBuffer(),zip=await JSZip.loadAsync(backupBytes,{checkCRC32:true}),manifest=JSON.parse(await zip.file('manifest.json')!.async('string'));expect(manifest.assets).toHaveLength(2);expect(manifest.assets.find((a:{mime:string})=>a.mime==='model/gltf-binary').sha256).toBe(sourceHash);expect(JSON.stringify(await importProjectPackage(backupBytes))).toBe(before);
  const assets=await prepareSharePresentation(project,{includeDimensions:true,sceneIds:project.scenes.map(s=>s.id)}),snapshot=assets.snapshot;expect(assets.models.size).toBe(1);expect(snapshot.scenes).toHaveLength(2);expect(JSON.stringify(snapshot)).not.toMatch(/PRIVATE|dataUrl|unplacedArtworks/);const publicBytes=[...assets.models.values()][0],publicSource=await loadStaticModel(publicBytes);
  try{for(const s of snapshot.scenes!)check(placeReferenceModel(s.snapshot.referenceModel!,publicSource.scene),source.scene,s.snapshot.referenceModel!);}finally{disposeModelAsset(publicSource.scenes);}
  const outputs:Array<{name:string;bytes:ArrayBuffer;bounds:{min:number[];max:number[]}}>=[];
  for(const s of project.scenes){const layout=sceneProject(project,s),blob=await exportProjectGlb(layout),bytes=await blob.arrayBuffer(),loaded=await loadStaticModel(bytes);try{const root=loaded.scene.getObjectByName('WholeVenue')!;expect(root).toBeTruthy();const bounds=check(root,source.scene,layout.referenceModel!);expect(new TextDecoder().decode(bytes)).not.toContain('PRIVATE_');outputs.push({name:s.name,bytes,bounds});}finally{disposeModelAsset(loaded.scenes);}}
  const gltf=await exportProjectGltf(sceneProject(project,project.scenes[1])),gltfBytes=await gltf.arrayBuffer(),repacked=await artworkModelBytes([new File([gltfBytes],'whole-venue.gltf.zip')]),gltfReceived=await loadStaticModel(repacked.bytes);try{check(gltfReceived.scene.getObjectByName('WholeVenue')!,source.scene,project.referenceModel!);}finally{disposeModelAsset(gltfReceived.scenes);}expect(JSON.stringify(project)).toBe(before);expect(hash(new Uint8Array(await readFile('docs/validation/model-preflight-2026-10-11/venue.glb')))).toBe(sourceHash);
  if(process.env.GONGGAN_WHOLE_VENUE_PROOF==='1'){await mkdir(dir,{recursive:true});await writeFile(dir+'/project.gonggan.zip',new Uint8Array(backupBytes));await writeFile(dir+'/Scene-B.gltf.zip',new Uint8Array(gltfBytes));await writeFile(dir+'/public.json',JSON.stringify(snapshot,null,2)+'\n');await writeFile(dir+'/public-model.glb',new Uint8Array(publicBytes));for(const o of outputs)await writeFile(dir+'/'+o.name.replace(' ','-')+'.glb',new Uint8Array(o.bytes));await writeFile(dir+'/workflow.json',JSON.stringify({date:'2026-10-11',sourceHash,rooms:30,meshes:450,triangles:5400,partialWalls:30,unresolvedFloor:true,originalPreservedAsReference:true,scenes:outputs.map(o=>({name:o.name,bounds:o.bounds,sha256:hash(new Uint8Array(o.bytes))})),backupAssets:2,unplacedArtworks:5,exactJsonRestoration:true,publicModelAssets:1,publicScenes:2,gltfZipReloaded:true,courtyardRayProbesPerScene:30,solidFloorRayProbesPerScene:30,sourceAndProjectUnchanged:true,gpuMeasured:false,limitations:['Owned synthetic venue; partial conversion is protected, not automatic full reconstruction','Actual loader/Scene/ZIP/public/export paths with native FileReader transport','No operating publication/browser/GPU/account/device/SketchUp/full 24-step/user acceptance']},null,2)+'\n');}
 }finally{disposeModelAsset(source.scenes);}
},30000);
