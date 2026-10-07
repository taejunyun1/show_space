import {afterEach,expect,it,vi} from 'vitest';
import {BoxGeometry,Group,Mesh,MeshPhysicalMaterial,Texture,NoColorSpace} from 'three';
import {createCanvas,loadImage,type Image} from '@napi-rs/canvas';
import {captureSurfaceIdentity,captureSurfaceStatus,captureSurfaceReady} from './captureSurface';
import {captureAssetsReady,waitForCaptureAssets} from './captureAssets';
import {normalMapTexture} from './modelExport';
import {createDemoProject} from '../domain/model';
import {materialPreset} from '../domain/materials';
import {floorWithOpenings} from '../domain/openings';

const color={imageUrl:'stored-color',widthMm:400,heightMm:600},normal={imageUrl:'stored-normal',widthMm:250,heightMm:300,strength:.75};
function mesh(name:string,texture:typeof color|undefined,normalMap:typeof normal|undefined,ready=true){
 const material=new MeshPhysicalMaterial();material.map=texture&&ready?new Texture():null;material.normalMap=normalMap&&ready?new Texture():null;material.userData.captureSurface=captureSurfaceStatus(texture,normalMap,{map:material.map??undefined},{map:material.normalMap??undefined});const object=new Mesh(new BoxGeometry(),material);object.name=name;return object;
}
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it('treats only configured color and normal maps as required and propagates known failures',()=>{
 expect(captureSurfaceStatus(undefined,undefined,{failed:true},{failed:true}).phase).toBe('ready');expect(captureSurfaceReady(undefined)).toBe(true);
 expect(captureSurfaceStatus(color,normal,{map:new Texture()},{}).phase).toBe('pending');expect(captureSurfaceStatus(color,normal,{map:new Texture()},{map:new Texture()}).phase).toBe('ready');
 expect(captureSurfaceStatus(color,normal,{map:new Texture()},{failed:true})).toMatchObject({phase:'failed',error:expect.stringContaining('노멀 맵')});expect(captureSurfaceStatus(color,undefined,{failed:true},{})).toMatchObject({phase:'failed',error:expect.stringContaining('표면 텍스처')});
});
it('requires actual material maps in addition to a matching ready status',()=>{
 const object=mesh('surface',color,normal);expect(captureSurfaceReady(object,color,normal)).toBe(true);object.material.normalMap=null;expect(captureSurfaceReady(object,color,normal)).toBe(false);object.material.normalMap=new Texture();object.material.map=null;expect(captureSurfaceReady(object,color,normal)).toBe(false);expect(captureSurfaceReady(new Group(),color,normal)).toBe(false);
});
it('ignores stale successes and failures from changed source, repeat sizes and normal strength',()=>{
 const object=mesh('surface',color,normal);expect(captureSurfaceReady(object,{...color,imageUrl:'replacement'},normal)).toBe(false);expect(captureSurfaceReady(object,{...color,widthMm:500},normal)).toBe(false);expect(captureSurfaceReady(object,color,{...normal,strength:1})).toBe(false);
 object.material.userData.captureSurface={...captureSurfaceIdentity(color,normal),phase:'failed',error:'previous failure'};expect(captureSurfaceReady(object,{...color,imageUrl:'replacement'},normal)).toBe(false);expect(()=>captureSurfaceReady(object,color,normal)).toThrow('previous failure');
});
it('waits for wall, floor and artwork normal maps without mutating project data',()=>{
 const project=createDemoProject();project.artworks=[project.artworks[0]];project.walls[0].material={...materialPreset('wood').material,texture:color,normal};project.floorMaterial={...materialPreset('wood').material,texture:color};project.artworks[0].material={...materialPreset('canvas').material,normal};const before=JSON.stringify(project),scene=new Group(),wall=mesh(`capture-wall-${project.walls[0].id}`,color,normal);scene.add(wall);
 const artwork=new Group();artwork.name=`artwork-${project.artworks[0].id}`;artwork.userData.artworkImageReady=true;artwork.add(mesh('image',undefined,normal));scene.add(artwork);expect(captureAssetsReady(scene,project)).toBe(false);
 floorWithOpenings(project).surfaces.forEach((_,i)=>scene.add(mesh(`capture-floor-${i}`,color,undefined)));expect(captureAssetsReady(scene,project)).toBe(true);wall.material.normalMap=null;expect(captureAssetsReady(scene,project)).toBe(false);expect(JSON.stringify(project)).toBe(before);
});
it('checks every disconnected floor surface but ignores a configured floor when no floor exists',()=>{
 const project=createDemoProject();project.walls=[];project.artworks=[];project.floorMaterial={...materialPreset('wood').material,texture:color};project.importedFloor=[[{x:0,z:0},{x:1000,z:0},{x:1000,z:1000},{x:0,z:1000}],[{x:2000,z:0},{x:3000,z:0},{x:3000,z:1000},{x:2000,z:1000}]];expect(floorWithOpenings(project).surfaces).toHaveLength(2);const scene=new Group();scene.add(mesh('capture-floor-0',color,undefined));expect(captureAssetsReady(scene,project)).toBe(false);scene.add(mesh('capture-floor-1',color,undefined));expect(captureAssetsReady(scene,project)).toBe(true);project.importedFloor=[];expect(captureAssetsReady(new Group(),project)).toBe(true);
});
it('ignores finish requirements on hidden walls and bypasses artwork normal maps on video materials',()=>{
 const project=createDemoProject();project.artworks=[project.artworks[0]];project.floorMaterial=undefined;project.walls.forEach(w=>{w.visible=false;w.material={...materialPreset('wood').material,texture:color,normal};});project.artworks[0].material={...materialPreset('canvas').material,normal};expect(captureAssetsReady(new Group(),project)).toBe(true);
 project.walls.forEach(w=>{w.visible=true;w.material=undefined;});project.artworks[0].video={dataUrl:'video',widthPx:100,heightPx:100,durationSeconds:1,loop:true,fit:'contain'};const scene=new Group(),art=new Group();art.name=`artwork-${project.artworks[0].id}`;art.userData.artworkImageReady=true;scene.add(art);expect(captureAssetsReady(scene,project)).toBe(true);
});
it('resolves only when a pending finish gains maps and stops immediately on a known finish failure',async()=>{
 vi.useFakeTimers();const project=createDemoProject();project.artworks=[];project.floorMaterial=undefined;project.walls[0].material={...materialPreset('wood').material,texture:color};const scene=new Group(),object=mesh(`capture-wall-${project.walls[0].id}`,color,undefined,false);scene.add(object);const promise=waitForCaptureAssets(scene,project,()=>{});object.material.map=new Texture();object.material.userData.captureSurface=captureSurfaceStatus(color,undefined,{map:object.material.map},{});await vi.advanceTimersByTimeAsync(60);await expect(promise).resolves.toBeUndefined();expect(vi.getTimerCount()).toBe(0);
 object.material.userData.captureSurface=captureSurfaceStatus(color,undefined,{failed:true},{});await expect(waitForCaptureAssets(scene,project,()=>{})).rejects.toThrow('표면 텍스처');expect(vi.getTimerCount()).toBe(0);
});

it('uses real TextureLoader and a native PNG decoder to preserve normal pixels or reject a corrupt image',async()=>{
 // Only the browser Image element event transport is adapted; Three's loader
 // and the PNG decoder are real. No GPU success is claimed by this test.
 class ImageElement {
  native?:Image;width=0;height=0;complete=false;crossOrigin='';listeners=new Map<string,Set<(this:ImageElement,event?:unknown)=>void>>();
  addEventListener(name:string,fn:(this:ImageElement,event?:unknown)=>void){const list=this.listeners.get(name)??new Set();list.add(fn);this.listeners.set(name,list);}
  removeEventListener(name:string,fn:(this:ImageElement,event?:unknown)=>void){this.listeners.get(name)?.delete(fn);}
  set src(value:string){void loadImage(value).then(image=>{this.native=image;this.width=image.width;this.height=image.height;this.complete=true;for(const fn of [...this.listeners.get('load')??[]])fn.call(this);},error=>{for(const fn of [...this.listeners.get('error')??[]])fn.call(this,error);});}
 }
 vi.stubGlobal('document',{createElementNS:()=>new ImageElement()});const canvas=createCanvas(2,2),ctx=canvas.getContext('2d');ctx.fillStyle='rgb(128,128,255)';ctx.fillRect(0,0,2,2);const png=canvas.toBuffer('image/png'),url='data:image/png;base64,'+png.toString('base64'),map=await normalMapTexture(url);
 try{expect(map.colorSpace).toBe(NoColorSpace);const image=map.image as ImageElement,decoded=createCanvas(2,2);decoded.getContext('2d').drawImage(image.native!,0,0);expect([...decoded.getContext('2d').getImageData(0,0,1,1).data]).toEqual([128,128,255,255]);const config={...normal,imageUrl:url},object=mesh('normal',undefined,config);object.material.normalMap=map;expect(captureSurfaceReady(object,undefined,config)).toBe(true);}finally{map.dispose();}
 await expect(normalMapTexture('data:image/png;base64,'+png.subarray(0,33).toString('base64'))).rejects.toThrow('노멀 맵');
});
