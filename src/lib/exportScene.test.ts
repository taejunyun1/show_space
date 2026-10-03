import {expect,it,vi} from 'vitest';
import {Box3,BoxGeometry,Group,Mesh,MeshStandardMaterial,Texture,Vector3} from 'three';
import {createDemoProject,artworkPosition} from '../domain/model';
import {buildExportScene,disposeExportScene} from './exportScene';

it('exports full walls at meter scale independently of camera cutaway and selection',()=>{
 const project=createDemoProject();project.walls[0].start={x:1000,z:2000};project.walls[0].end={x:4000,z:6000};project.artworks=[];
 const scene=buildExportScene(project),mesh=scene.getObjectByName('wall-wall-a')!;
 expect(new Box3().setFromObject(mesh).getSize(new Vector3()).y).toBeCloseTo(3.2);
 expect(mesh.position.toArray()).toEqual([2.5,1.6,4]);expect(mesh.rotation.y).toBeCloseTo(-Math.atan2(4,3));
 expect((mesh as Mesh).geometry.boundingBox).not.toBeNull();
 expect(scene.children.map(o=>o.name)).toEqual(['wall-wall-a','wall-wall-b','wall-wall-c','wall-wall-d']);
 disposeExportScene(scene);
});
it('retains back-face artwork transforms, frames, textures and rotation without private notes',()=>{
 const project=createDemoProject();project.artworks=[{...project.artworks[0],wallSide:'back',rotationDeg:30,note:'PRIVATE NOTE'}];project.walls[0].note='PRIVATE WALL';
 const texture=new Texture(),scene=buildExportScene(project,new Map([[project.artworks[0].id,texture]]));
 const art=scene.getObjectByName('artwork-artwork-1')!,pose=artworkPosition(project.artworks[0],project.walls[0]);
 expect(art.position.toArray()).toEqual([pose.x/1000,pose.y/1000,pose.z/1000]);expect(art.rotation.y).toBeCloseTo(pose.rotationY);expect(art.rotation.z).toBeCloseTo(Math.PI/6);
 const image=art.getObjectByName('image') as Mesh;expect((image.material as MeshStandardMaterial).map).toBe(texture);expect(image.position.z).toBeCloseTo(.014,5);
 const frame=art.getObjectByName('frame') as Mesh;frame.geometry.computeBoundingBox();expect(frame.geometry.boundingBox!.getSize(new Vector3()).x).toBeCloseTo(.945);
 expect(JSON.stringify(scene.toJSON())).not.toContain('PRIVATE');disposeExportScene(scene);
});
it('omits explicitly hidden walls and their artworks but retains the floor boundary',()=>{
 const project=createDemoProject();project.walls[0].visible=false;project.artworks[4].visible=false;
 const scene=buildExportScene(project);expect(scene.getObjectByName('wall-wall-a')).toBeUndefined();expect(scene.getObjectByName('artwork-artwork-1')).toBeUndefined();expect(scene.getObjectByName('artwork-artwork-5')).toBeUndefined();expect(scene.getObjectByName('floor-1')).toBeDefined();disposeExportScene(scene);
});
it('preserves floor holes and does not fill an open boundary',()=>{
 const project=createDemoProject();project.artworks=[];project.walls=project.walls.slice(0,3);
 expect(buildExportScene(project).getObjectByName('floor-1')).toBeUndefined();
 project.importedFloor=[[{x:-4000,z:-3000},{x:4000,z:-3000},{x:4000,z:3000},{x:-4000,z:3000}],[{x:-1000,z:-1000},{x:1000,z:-1000},{x:1000,z:1000},{x:-1000,z:1000}]];
 const scene=buildExportScene(project),floor=scene.getObjectByName('floor-1') as Mesh;
 const bounds=new Box3().setFromObject(floor);expect(bounds.min.y).toBeCloseTo(-.16);expect(bounds.max.y).toBeCloseTo(0);
 const position=floor.geometry.getAttribute('position');let area=0;
 floor.updateMatrixWorld(true);for(let i=0;i<position.count;i+=3){const points=[0,1,2].map(j=>new Vector3().fromBufferAttribute(position,i+j).applyMatrix4(floor.matrixWorld));const n=new Vector3().crossVectors(points[1].clone().sub(points[0]),points[2].clone().sub(points[0]));if(n.y>0)area+=n.y/2;}
 expect(area).toBeCloseTo(44);disposeExportScene(scene);
});
it('applies reference model transforms and excludes hidden source models',()=>{
 const project=createDemoProject();project.walls=[];project.artworks=[];project.referenceModel={name:'room.glb',dataUrl:'unused',visible:true,sizeMm:[2000,1000,3000],sourceOffsetM:[-1,0,-2],positionMm:[1000,2000,3000],rotationDeg:90,scale:2};
 const model=new Group(),box=new Mesh(new BoxGeometry(2,1,3),new MeshStandardMaterial());box.position.set(1,.5,2);model.add(box);
 const before=model.toJSON(),scene=buildExportScene(project,new Map(),model),bounds=new Box3().setFromObject(scene);
 bounds.getSize(new Vector3()).toArray().forEach((v,i)=>expect(v).toBeCloseTo([6,2,4][i]));bounds.getCenter(new Vector3()).toArray().forEach((v,i)=>expect(v).toBeCloseTo([1,3,3][i]));expect(model.toJSON()).toEqual(before);
 project.referenceModel.visible=false;expect(buildExportScene(project,new Map(),model).children).toEqual([]);disposeExportScene(scene);
});
it('refuses uncalibrated drawing coordinates rather than exporting them as millimeters',()=>{
 const project=createDemoProject();project.planReference={widthPx:100,heightPx:100,origin:{x:0,z:0},mmPerPixel:1,calibrated:false};
 expect(()=>buildExportScene(project)).toThrow(/축척/);
});
it('roundtrips a real binary GLB with wall dimensions and a floor hole intact',async()=>{
 // Node has Blob but no FileReader; the exporter still produces its real binary container.
 vi.stubGlobal('FileReader',class {result:ArrayBuffer|null=null;onloadend:(()=>void)|null=null;readAsArrayBuffer(blob:Blob){void blob.arrayBuffer().then(bytes=>{this.result=bytes;this.onloadend?.();});}});
 try{
  const project=createDemoProject();project.artworks=[];project.importedFloor=[[{x:-4000,z:-3000},{x:4000,z:-3000},{x:4000,z:3000},{x:-4000,z:3000}],[{x:-1000,z:-1000},{x:1000,z:-1000},{x:1000,z:1000},{x:-1000,z:1000}]];
  const {exportProjectGlb}=await import('./modelExport'),{GLTFLoader}=await import('three/examples/jsm/loaders/GLTFLoader.js'),{inspectGlb}=await import('./glbPayload');
  const bytes=await (await exportProjectGlb(project)).arrayBuffer();inspectGlb(bytes);
  const gltf=await new GLTFLoader().parseAsync(bytes,'');expect(gltf.scene.children).toHaveLength(5);
  const wall=gltf.scene.getObjectByName('wall-wall-a')!,bounds=new Box3().setFromObject(wall);expect(bounds.getSize(new Vector3()).x).toBeCloseTo(8);expect(bounds.getSize(new Vector3()).y).toBeCloseTo(3.2);
  const {extractModelWalls}=await import('./modelWalls');const result=extractModelWalls(gltf.scene,{name:'export.glb',dataUrl:'unused',visible:true,sizeMm:[8000,3200,6000],sourceOffsetM:[0,0,0],positionMm:[0,0,0],scale:1,rotationDeg:0});
  expect(result.walls).toHaveLength(4);expect(result.walls.every(w=>w.thicknessMm===160&&w.heightMm===3200)).toBe(true);expect(result.importedFloor).toHaveLength(2);disposeExportScene(gltf.scene);
 }finally{vi.unstubAllGlobals();}
});

it('roundtrips the real separate glTF ZIP with meter dimensions and a floor hole intact',async()=>{
 vi.stubGlobal('FileReader',class {result:string|null=null;onloadend:(()=>void)|null=null;readAsDataURL(blob:Blob){void blob.arrayBuffer().then(bytes=>{this.result=`data:${blob.type||'application/octet-stream'};base64,${Buffer.from(bytes).toString('base64')}`;this.onloadend?.();});}});
 vi.stubGlobal('ProgressEvent',class {constructor(public type:string,public init:unknown){}});
 try{
  const project=createDemoProject();project.artworks=[];project.walls[0].note='PRIVATE';project.importedFloor=[[{x:-4000,z:-3000},{x:4000,z:-3000},{x:4000,z:3000},{x:-4000,z:3000}],[{x:-1000,z:-1000},{x:1000,z:-1000},{x:1000,z:1000},{x:-1000,z:1000}]];const before=structuredClone(project);
  const {exportProjectGltf}=await import('./modelExport'),{default:JSZip}=await import('jszip'),{GLTFLoader}=await import('three/examples/jsm/loaders/GLTFLoader.js'),{LoadingManager}=await import('three');
  const zip=await JSZip.loadAsync(await (await exportProjectGltf(project)).arrayBuffer(),{checkCRC32:true}),json=await zip.file('scene.gltf')!.async('string'),doc=JSON.parse(json);
  expect(json).not.toContain('PRIVATE');expect(doc.buffers[0].uri).toBe('buffers/buffer-1.bin');expect(doc.buffers[0].uri).not.toContain('data:');
  const buffer=await zip.file(doc.buffers[0].uri)!.async('uint8array'),manager=new LoadingManager().setURLModifier(url=>{if(url!==doc.buffers[0].uri)throw new Error(`Unexpected resource: ${url}`);return `data:application/octet-stream;base64,${Buffer.from(buffer).toString('base64')}`;});
  const gltf=await new GLTFLoader(manager).parseAsync(json,''),wall=gltf.scene.getObjectByName('wall-wall-a')!,size=new Box3().setFromObject(wall).getSize(new Vector3());expect(size.x).toBeCloseTo(8);expect(size.y).toBeCloseTo(3.2);expect(size.z).toBeCloseTo(.16);expect(gltf.scene.children).toHaveLength(5);
  const {extractModelWalls}=await import('./modelWalls');const result=extractModelWalls(gltf.scene,{name:'scene.gltf',dataUrl:'unused',visible:true,sizeMm:[8000,3200,6000],sourceOffsetM:[0,0,0],positionMm:[0,0,0],rotationDeg:0,scale:1});expect(result.walls).toHaveLength(4);expect(result.importedFloor).toHaveLength(2);expect(project).toEqual(before);disposeExportScene(gltf.scene);
 }finally{vi.unstubAllGlobals();}
});
