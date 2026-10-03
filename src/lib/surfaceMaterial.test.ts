import {expect,it,vi} from 'vitest';
import {Mesh,MeshPhysicalMaterial,MeshStandardMaterial,Texture} from 'three';
import {materialPreset} from '../domain/materials';
import {createDemoProject} from '../domain/model';
import {physicalMaterialParameters,createSurfaceMaterial} from './surfaceMaterial';
import {buildExportScene,disposeExportScene} from './exportScene';
import {needsSurfaceEnvironment} from './surfaceEnvironment';
it('preserves legacy shading and converts only optical thickness from millimeters to meters',()=>{
 const legacy=createSurfaceMaterial('#ffffff',undefined,.92);expect(legacy).toBeInstanceOf(MeshStandardMaterial);expect(legacy).not.toBeInstanceOf(MeshPhysicalMaterial);expect((legacy as MeshStandardMaterial).roughness).toBe(.92);
 const glass=materialPreset('glass').material,parameters=physicalMaterialParameters('#ffffff',glass);expect(parameters.thickness).toBe(.01);expect(parameters.opacity).toBe(1);expect(parameters.transparent).toBe(false);
 const faded=physicalMaterialParameters('#ffffff',{...glass,transmission:0,opacity:.3});expect(faded.transparent).toBe(true);expect(faded.depthWrite).toBe(false);legacy.dispose();
});
it('uses physical finishes on export walls, floor and artwork without replacing their images',()=>{
 const p=createDemoProject();p.floorMaterial=materialPreset('epoxy-floor').material;p.walls[0].material=materialPreset('metal').material;p.artworks[0].material=materialPreset('glossy-photo-paper').material;
 const texture=new Texture(),scene=buildExportScene(p,new Map([[p.artworks[0].id,texture]]));
 for(const name of ['floor-1','wall-wall-a','image'])expect((scene.getObjectByName(name) as Mesh).material).toBeInstanceOf(MeshPhysicalMaterial);
 expect(((scene.getObjectByName('image') as Mesh).material as MeshPhysicalMaterial).map).toBe(texture);disposeExportScene(scene);
});
it('requires reflection lighting only after a visible surface is given a material',()=>{
 const p=createDemoProject();expect(needsSurfaceEnvironment(p)).toBe(false);p.walls[0].material=materialPreset('metal').material;expect(needsSurfaceEnvironment(p)).toBe(true);p.walls[0].visible=false;p.artworks[0].material=materialPreset('metal').material;expect(needsSurfaceEnvironment(p)).toBe(false);p.floorMaterial=materialPreset('epoxy-floor').material;expect(needsSurfaceEnvironment(p)).toBe(true);
});
it('roundtrips physical extensions through the real binary GLB exporter and loader',async()=>{
 vi.stubGlobal('FileReader',class {result:ArrayBuffer|null=null;onloadend:(()=>void)|null=null;readAsArrayBuffer(blob:Blob){void blob.arrayBuffer().then(b=>{this.result=b;this.onloadend?.();});}});
 try{
  const p=createDemoProject();p.artworks=[];p.walls[0].material=materialPreset('glass').material;p.walls[1].material=materialPreset('fabric').material;p.walls[2].material=materialPreset('metal').material;p.floorMaterial=materialPreset('epoxy-floor').material;
  const {exportProjectGlb}=await import('./modelExport'),{GLTFLoader}=await import('three/examples/jsm/loaders/GLTFLoader.js');const bytes=await(await exportProjectGlb(p)).arrayBuffer();const jsonLength=new DataView(bytes).getUint32(12,true),doc=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,jsonLength)));
  expect(doc.extensionsUsed).toEqual(expect.arrayContaining(['KHR_materials_transmission','KHR_materials_volume','KHR_materials_sheen','KHR_materials_clearcoat']));
  const loaded=(await new GLTFLoader().parseAsync(bytes,'')).scene;
  const glass=(loaded.getObjectByName('wall-wall-a') as Mesh).material as MeshPhysicalMaterial;expect(glass.transmission).toBe(1);expect(glass.thickness).toBeCloseTo(.01);expect(glass.roughness).toBeCloseTo(.06);expect(((loaded.getObjectByName('wall-wall-c') as Mesh).material as MeshPhysicalMaterial).metalness).toBe(1);expect(((loaded.getObjectByName('floor-1') as Mesh).material as MeshPhysicalMaterial).clearcoat).toBe(1);disposeExportScene(loaded);
 }finally{vi.unstubAllGlobals();}
});
