import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {createCanvas,loadImage,Image as NativeImage} from '@napi-rs/canvas';
import {BufferGeometry,Material,Mesh,MeshStandardMaterial,LoadingManager,type Texture} from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {loadStaticModel} from './loadStaticModel';
import {artworkTestGltf,testArtworkModel} from './modelArtworkTestFixture';
import {packEmbeddedGltf,modelDataUrl} from './artworkModelPayload';
import {disposeModelAsset} from './modelAssetResources';
import {readModelArtworkFiles} from './modelArtworkImport';
import {readModelFile,readModelWalls} from './modelImport';
import {exportProjectGlb,exportProjectGltf} from './modelExport';
import {publicModelBytes} from './publicModelAsset';
import {createDemoProject} from '../domain/model';
import {addModelArtwork} from '../domain/modelArtworks';

const canvas=createCanvas(2,2),ctx=canvas.getContext('2d');ctx.fillStyle='#d93412';ctx.fillRect(0,0,2,2);
const png=canvas.toBuffer('image/png'),broken=png.subarray(0,33);
const bitmapCloses:ReturnType<typeof vi.fn>[]=[];
const decode=vi.fn(async(blob:Blob)=>{
 // Browser ImageBitmap transport is adapted to a real native PNG decoder.
 // This proves decoding and texture assignment, not a GPU upload or browser pixels.
 const image=await loadImage(Buffer.from(await blob.arrayBuffer())),close=vi.fn();bitmapCloses.push(close);return Object.assign(image,{close});
});
beforeEach(()=>{bitmapCloses.length=0;decode.mockClear();vi.stubGlobal('self',{URL});vi.stubGlobal('ImageBitmap',NativeImage);vi.stubGlobal('createImageBitmap',decode);vi.spyOn(console,'error').mockImplementation(()=>{});});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
function source(damaged=false){
 const doc=artworkTestGltf().doc;
 const result=Object.assign(doc,{images:[{uri:'data:image/png;base64,'+(damaged?broken:png).toString('base64')}],textures:[{source:0}]});
 Object.assign(doc.materials[0].pbrMetallicRoughness,{baseColorTexture:{index:0}});return result;
}
function maps(scene:import('three').Object3D){const result:Texture[]=[];scene.traverse(o=>{if(o instanceof Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof MeshStandardMaterial&&m.map)result.push(m.map);});return result;}

it('reproduces swallowed decoder failure with real GLTFLoader and rejects the same partial model',async()=>{
 const bytes=packEmbeddedGltf(source(true)),urls=new Set<string>(),manager=new LoadingManager();manager.setURLModifier(url=>{if(url.startsWith('blob:'))urls.add(url);return url;});
 const partial=await new GLTFLoader(manager).parseAsync(bytes,'');try{expect(maps(partial.scene)).toHaveLength(0);expect(partial.scene.children).toHaveLength(3);}finally{disposeModelAsset(partial.scenes);urls.forEach(url=>URL.revokeObjectURL(url));}
 await expect(loadStaticModel(bytes)).rejects.toThrow('텍스처');expect(decode).toHaveBeenCalledTimes(2);
});
it('decodes real PNG pixels, preserves transformed maps and shares one decoded source across duplicates and slots',async()=>{
 const doc=source();Object.assign(doc,{extensionsUsed:['KHR_texture_transform']});Object.assign(doc.materials[0].pbrMetallicRoughness,{baseColorTexture:{index:0,extensions:{KHR_texture_transform:{offset:[.2,.3],scale:[.5,.7]}}},metallicRoughnessTexture:{index:0}});
 const gltf=await loadStaticModel(packEmbeddedGltf(doc));try{
  const result=maps(gltf.scene);expect(result).toHaveLength(2);expect(result[0].offset.toArray()).toEqual([.2,.3]);expect(result[0].repeat.toArray()).toEqual([.5,.7]);expect(decode).toHaveBeenCalledTimes(1);
  const image=result[0].image as NativeImage,check=createCanvas(2,2);check.getContext('2d').drawImage(image,0,0);expect([...check.getContext('2d').getImageData(0,0,1,1).data]).toEqual([217,52,18,255]);
 }finally{disposeModelAsset(gltf.scenes);}expect(bitmapCloses[0]).toHaveBeenCalledTimes(1);
});
it('checks texture requests from supported physical material extensions as well as base color',async()=>{
 const doc=source(true);Object.assign(doc.materials[0].pbrMetallicRoughness,{baseColorTexture:undefined});Object.assign(doc,{extensionsUsed:['KHR_materials_clearcoat']});Object.assign(doc.materials[0],{extensions:{KHR_materials_clearcoat:{clearcoatFactor:1,clearcoatTexture:{index:0}}}});
 await expect(loadStaticModel(packEmbeddedGltf(doc))).rejects.toThrow('텍스처');expect(decode).toHaveBeenCalledTimes(1);
});
it('allows plain models, unused corrupt images and a texture slot that unlit deliberately ignores',async()=>{
 const doc=source(true);Object.assign(doc.materials[0].pbrMetallicRoughness,{baseColorTexture:undefined});Object.assign(doc,{extensionsUsed:['KHR_materials_unlit']});Object.assign(doc.materials[0],{extensions:{KHR_materials_unlit:{}},normalTexture:{index:0}});
 const gltf=await loadStaticModel(packEmbeddedGltf(doc));try{expect(gltf.scene.children).toHaveLength(3);expect(decode).not.toHaveBeenCalled();}finally{disposeModelAsset(gltf.scenes);}
});
it('disposes successful textures and full scenes and revokes embedded URLs when another required image fails',async()=>{
 const doc=source();Object.assign(doc,{images:[{uri:'data:image/png;base64,'+png.toString('base64')},{uri:'data:image/png;base64,'+broken.toString('base64')}],textures:[{source:0},{source:1}]});Object.assign(doc.materials[1].pbrMetallicRoughness,{baseColorTexture:{index:1}});
 const geometry=vi.spyOn(BufferGeometry.prototype,'dispose'),material=vi.spyOn(Material.prototype,'dispose'),revoke=vi.spyOn(URL,'revokeObjectURL'),create=vi.spyOn(URL,'createObjectURL');
 await expect(loadStaticModel(packEmbeddedGltf(doc))).rejects.toThrow('텍스처');expect(geometry).toHaveBeenCalled();expect(material).toHaveBeenCalled();expect(bitmapCloses[0]).toHaveBeenCalledTimes(1);
 const revoked=new Set(revoke.mock.calls.map(([url])=>url));expect(create.mock.results.every(r=>revoked.has(r.value))).toBe(true);
});
it('fails both import routes and recovered wall extraction before returning a damaged textured model',async()=>{
 const bytes=packEmbeddedGltf(source(true)),file=new File([bytes],'PRIVATE-model.glb'),model={...testArtworkModel(),dataUrl:modelDataUrl(bytes)};
 await expect(readModelArtworkFiles([file])).rejects.toThrow('텍스처');await expect(readModelFile(file)).rejects.toThrow('텍스처');await expect(readModelWalls(model)).rejects.toThrow('텍스처');expect(model.dataUrl).toBe(modelDataUrl(bytes));
});
it('fails both model exports without changing a recoverable project and ignores a hidden damaged model',async()=>{
 const model={...testArtworkModel(),dataUrl:modelDataUrl(packEmbeddedGltf(source(true)))},p=createDemoProject();p.artworks=[];const project=addModelArtwork(p,model).project,before=JSON.stringify(project);
 await expect(exportProjectGlb(project)).rejects.toThrow('텍스처');await expect(exportProjectGltf(project)).rejects.toThrow('텍스처');expect(JSON.stringify(project)).toBe(before);
 project.modelArtworks![0].visible=false;vi.stubGlobal('FileReader',class{result:unknown;onloadend?:()=>void;readAsArrayBuffer(blob:Blob){void blob.arrayBuffer().then(bytes=>{this.result=bytes;this.onloadend?.();});}});expect((await exportProjectGlb(project)).size).toBeGreaterThan(0);
});
it('still detects corrupt texture bytes after public metadata sanitization without leaking source names in the error',async()=>{
 const doc=source(true);Object.assign(doc.images?.[0]??{},{name:'PRIVATE_FILE_NAME'});const bytes=publicModelBytes(packEmbeddedGltf(doc));
 try{await loadStaticModel(bytes);throw new Error('Expected decode failure');}catch(error){expect((error as Error).message).toContain('텍스처');expect((error as Error).message).not.toContain('PRIVATE');}
});
