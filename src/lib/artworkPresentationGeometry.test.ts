import {expect,it,vi} from 'vitest';
import {Box3,Group,Mesh,MeshPhysicalMaterial,Vector3} from 'three';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {createDemoProject} from '../domain/model';
import {buildExportScene,disposeExportScene} from './exportScene';
import {artworkPresentation} from '../domain/artworkPresentation';
import {artworkFrameGeometry} from './artworkPresentationGeometry';
const settings={widthMm:30,depthMm:70,material:'metal' as const,matWidthMm:60,matColor:'#f5f4ef',cover:'glass' as const};
it('builds a hollow frame, complete image and separate mat/cover at meter scale',()=>{
 const p=createDemoProject();p.artworks=[{...p.artworks[0],frameSettings:settings}];const a=p.artworks[0],scene=buildExportScene(p),root=scene.getObjectByName('artwork-'+a.id)!;
 const box=new Box3().setFromObject(root),size=box.getSize(new Vector3());expect(size.x).toBeCloseTo(1.08);expect(size.y).toBeCloseTo(1.38);expect(size.z).toBeCloseTo(.07);
 const image=root.getObjectByName('image') as Mesh;image.geometry.computeBoundingBox();expect(image.geometry.boundingBox!.getSize(new Vector3()).toArray()).toEqual([expect.closeTo(.9),expect.closeTo(1.2),0]);
 const cover=root.getObjectByName('front-cover') as Mesh;expect((cover.material as MeshPhysicalMaterial).transmission).toBe(1);expect((cover.material as MeshPhysicalMaterial).thickness).toBe(.002);expect(root.getObjectByName('mat')).toBeDefined();
 // Front faces of the ring contain only the border, leaving the full image/mat opening.
 const geometry=artworkFrameGeometry(a),position=geometry.getAttribute('position');let area=0;
 for(let i=0;i<position.count;i+=3){const v=[0,1,2].map(j=>new Vector3().fromBufferAttribute(position,i+j));const cross=new Vector3().crossVectors(v[1].clone().sub(v[0]),v[2].clone().sub(v[0]));if(cross.z>0)area+=cross.z/2;}
 expect(area).toBeCloseTo(1.08*1.38-1.02*1.32);expect(position.count).toBeLessThanOrEqual(96);geometry.dispose();disposeExportScene(scene);
});
it('roundtrips the actual frame, mat, cover and optical extensions in GLB and glTF',async()=>{
 vi.stubGlobal('FileReader',class {result:ArrayBuffer|string|null=null;onloadend:(()=>void)|null=null;readAsArrayBuffer(blob:Blob){void blob.arrayBuffer().then(b=>{this.result=b;this.onloadend?.();});}readAsDataURL(blob:Blob){void blob.arrayBuffer().then(b=>{this.result=`data:${blob.type||'application/octet-stream'};base64,${Buffer.from(b).toString('base64')}`;this.onloadend?.();});}});
 vi.stubGlobal('ProgressEvent',class {constructor(public type:string,public init:unknown){}});
 try{
  for(const binary of [true,false]){
   const p=createDemoProject();p.artworks=[{...p.artworks[0],frameSettings:settings,note:'PRIVATE'}];const source=buildExportScene(p),a=source.getObjectByName('artwork-artwork-1')!,root=new Group();root.add(a);root.updateMatrixWorld(true);
   const doc=await new GLTFExporter().parseAsync(root,{binary}),loaded=await new GLTFLoader().parseAsync(doc instanceof ArrayBuffer?doc:JSON.stringify(doc),'');
   const art=loaded.scene.getObjectByName('artwork-artwork-1')!,size=new Box3().setFromObject(art).getSize(new Vector3()),presentation=artworkPresentation(p.artworks[0]);expect(size.x*1000).toBeCloseTo(presentation.widthMm,1);expect(size.y*1000).toBeCloseTo(presentation.heightMm,1);expect(size.z*1000).toBeCloseTo(70,1);
   const cover=art.getObjectByName('front-cover') as Mesh;expect((cover.material as MeshPhysicalMaterial).transmission).toBe(1);expect((cover.material as MeshPhysicalMaterial).ior).toBe(1.5);expect(art.getObjectByName('mat')).toBeDefined();expect(JSON.stringify(loaded.scene.toJSON())).not.toContain('PRIVATE');disposeExportScene(loaded.scene);disposeExportScene(root);disposeExportScene(source);
  }
 }finally{vi.unstubAllGlobals();}
});
