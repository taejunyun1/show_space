import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act,create} from '@react-three/test-renderer';
import {renderToStaticMarkup} from 'react-dom/server';
import type {ReactNode} from 'react';
import {StrictMode} from 'react';
import {createCanvas,loadImage,type Image,type Canvas} from '@napi-rs/canvas';
import {Scene,SpotLight,Texture} from 'three';
import {Lighting3D} from './Lighting3D';
import {ReadonlyAssetsContext} from './ReadonlyAssets';
import {projectorTestFixture} from '../lib/projectorTestFixture';
import {captureAssetsReady,waitForCaptureAssets} from '../lib/captureAssets';
import {lightingProfileReady} from '../lib/sceneLighting';
import {renderProfile} from '../lib/renderQuality';

// DOM label portal transport only: the real R3F reconciler, Three lights,
// texture pool, TextureLoader and native raster operations all execute.
// Test renderer's WebGL context is mocked; these are not GPU pixel tests.
vi.mock('@react-three/drei',()=>({Html:({children}:{children:ReactNode})=><group userData={{label:renderToStaticMarkup(children)}}/>}));
let renderer:Awaited<ReturnType<typeof create>>,loads:Array<()=>Promise<void>>,failCanvas:boolean;
class ImageElement {
 native?:Image;width=0;height=0;complete=false;crossOrigin='';listeners=new Map<string,Set<(this:ImageElement,event?:unknown)=>void>>();
 addEventListener(name:string,fn:(this:ImageElement,event?:unknown)=>void){const list=this.listeners.get(name)??new Set();list.add(fn);this.listeners.set(name,list);}
 removeEventListener(name:string,fn:(this:ImageElement,event?:unknown)=>void){this.listeners.get(name)?.delete(fn);}
 set src(value:string){loads.push(async()=>{try{this.native=await loadImage(value);this.width=this.native.width;this.height=this.native.height;this.complete=true;for(const fn of [...this.listeners.get('load')??[]])fn.call(this);}catch(error){for(const fn of [...this.listeners.get('error')??[]])fn.call(this,error);}});}
}
beforeEach(async()=>{
 (globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
 loads=[];failCanvas=false;renderer=await create(<group/>);
 vi.stubGlobal('document',{createElementNS:()=>new ImageElement(),createElement:()=>{
  const canvas=createCanvas(1,1),getContext=canvas.getContext.bind(canvas);
  Object.assign(canvas,{getContext:(kind:'2d')=>{
   if(failCanvas)return null;const context=getContext(kind),draw=context.drawImage.bind(context);
   context.drawImage=((image:ImageElement|Image|Canvas,...args:unknown[])=>Reflect.apply(draw,context,[image instanceof ImageElement?image.native!:image,...args])) as typeof context.drawImage;
   return context;
  }});return canvas;
 }});
});
afterEach(async()=>{await renderer.unmount();vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();});
const scene=()=>renderer.scene.instance as Scene;
const lamp=(id:string)=>scene().getObjectByName(`light-${id}`)?.getObjectByName('emitter') as SpotLight;
async function decode(index=0){expect(loads[index]).toBeDefined();await act(async()=>loads[index]());}
const source=()=>{const p=projectorTestFixture();p.artworks=[];p.scenes=[];return p;};

it('commits real decoded projector maps, waits for replacement settings and disposes owned maps on removal',async()=>{
 const p=source(),l=p.lights![0],dispose=vi.spyOn(Texture.prototype,'dispose');await renderer.update(<Lighting3D source={p}/>);
 expect(lamp(l.id).intensity).toBe(0);expect(captureAssetsReady(scene(),p)).toBe(false);const waiting=waitForCaptureAssets(scene(),p,()=>{});await decode();await expect(waiting).resolves.toBeUndefined();
 expect(lamp(l.id).map?.image.width).toBe(1024);expect(lightingProfileReady(scene(),p,renderProfile('preview'))).toBe(true);expect(captureAssetsReady(scene(),p)).toBe(true);
 const old=lamp(l.id).map!,next={...p,lights:[{...l,projection:{...l.projection!,fit:'cover' as const}}]};expect(captureAssetsReady(scene(),next)).toBe(false);await renderer.update(<Lighting3D source={next}/>);expect(lamp(l.id).map).not.toBe(old);expect(dispose.mock.contexts).toContain(old);expect(captureAssetsReady(scene(),next)).toBe(true);
 const map=lamp(l.id).map!;await renderer.update(<Lighting3D source={{...next,lights:[]}}/>);expect(scene().getObjectByName(`light-${l.id}`)).toBeUndefined();expect(dispose.mock.contexts).toContain(map);
});

it('reports a corrupt projector image to capture immediately and isolates an old failure from a replacement',async()=>{
 const p=source(),l=p.lights![0],canvas=createCanvas(2,2),png=canvas.toBuffer('image/png');l.projection!.imageUrl='data:image/png;base64,'+png.subarray(0,33).toString('base64');
 await renderer.update(<Lighting3D source={p}/>);await decode();expect(lamp(l.id).intensity).toBe(0);expect(()=>captureAssetsReady(scene(),p)).toThrow('프로젝터');
 const invalidate=vi.fn();await expect(waitForCaptureAssets(scene(),p,invalidate)).rejects.toThrow('프로젝터');expect(invalidate).not.toHaveBeenCalled();
 const next=source();next.lights![0].id=l.id;expect(captureAssetsReady(scene(),next)).toBe(false);await renderer.update(<Lighting3D source={next}/>);expect(()=>captureAssetsReady(scene(),next)).not.toThrow();await decode(1);expect(captureAssetsReady(scene(),next)).toBe(true);
});

it('keeps a failed framing operation inside its projector instead of crashing the 3D scene',async()=>{
 const p=source(),l=p.lights![0];await renderer.update(<Lighting3D source={p}/>);await decode();
 // Source derivative is already decoded; only the next projector fitting canvas fails.
 failCanvas=true;const next={...p,lights:[{...l,projection:{...l.projection!,fit:'cover' as const}}]};await renderer.update(<Lighting3D source={next}/>);expect(scene().getObjectByName('base-lighting')).toBeDefined();expect(lamp(l.id).intensity).toBe(0);expect(lamp(l.id).map).toBeNull();expect(()=>captureAssetsReady(scene(),next)).toThrow('프로젝터');
});

it('retains a failed light marker for missing local presentation assets and makes no public fallback request',async()=>{
 const p=source(),l=p.lights![0],publicLight={...l,projection:{...l.projection!,imageUrl:undefined,imageId:'0'}};
 await renderer.update(<ReadonlyAssetsContext.Provider value={{images:new Map(),models:new Map()}}><Lighting3D source={{...p,lights:[publicLight]}} shareId={'a'.repeat(48)}/></ReadonlyAssetsContext.Provider>);
 expect(loads).toHaveLength(0);expect(lamp(l.id)).toBeDefined();expect(lamp(l.id).intensity).toBe(0);expect(()=>lightingProfileReady(scene(),{...p,lights:[publicLight]},renderProfile('preview'))).toThrow('프로젝터');
});

it('rejects a later failed projector even when another is pending, and ignores hidden failures',async()=>{
 const p=source(),l=p.lights![0],png=createCanvas(2,2).toBuffer('image/png');p.lights!.push({...l,id:'failed-projector',projection:{...l.projection!,imageUrl:'data:image/png;base64,'+png.subarray(0,33).toString('base64')}});
 await renderer.update(<Lighting3D source={p}/>);await decode(1);expect(()=>captureAssetsReady(scene(),p)).toThrow('프로젝터');expect(()=>lightingProfileReady(scene(),p,renderProfile('preview'))).toThrow('프로젝터');
 p.lights![1]={...p.lights![1],visible:false};await renderer.update(<Lighting3D source={{...p}}/>);expect(()=>captureAssetsReady(scene(),p)).not.toThrow();expect(captureAssetsReady(scene(),p)).toBe(false);await decode(0);expect(captureAssetsReady(scene(),p)).toBe(true);
});

it('does not attach a late old texture while a new projector source is decoding',async()=>{
 const p=source(),l=p.lights![0];await renderer.update(<Lighting3D source={p}/>);
 const pixels=createCanvas(16,9);pixels.getContext('2d').fillStyle='#ff0000';pixels.getContext('2d').fillRect(0,0,16,9);
 const next={...p,lights:[{...l,projection:{...l.projection!,imageUrl:'data:image/png;base64,'+pixels.toBuffer('image/png').toString('base64')}}]};await renderer.update(<Lighting3D source={next}/>);await decode(0);expect(lamp(l.id).map).toBeNull();expect(lamp(l.id).intensity).toBe(0);expect(captureAssetsReady(scene(),next)).toBe(false);
 await decode(1);const map=lamp(l.id).map!;expect([...map.image.getContext('2d').getImageData(512,288,1,1).data]).toEqual([255,0,0,255]);expect(captureAssetsReady(scene(),next)).toBe(true);expect(captureAssetsReady(scene(),p)).toBe(false);
});

it('survives StrictMode cleanup/restart and releases the attached owned map on unmount',async()=>{
 const p=source(),dispose=vi.spyOn(Texture.prototype,'dispose');await renderer.update(<StrictMode><Lighting3D source={p}/></StrictMode>);
 for(let i=0;i<loads.length;i++)await decode(i);
 const map=lamp(p.lights![0].id).map!;expect(map).toBeDefined();expect(captureAssetsReady(scene(),p)).toBe(true);expect(dispose.mock.contexts).not.toContain(map);await renderer.unmount();expect(dispose.mock.contexts.filter(t=>t===map)).toHaveLength(1);
});
