import {CanvasTexture,SRGBColorSpace,Mesh,TextureLoader,NoColorSpace,type Object3D,type Texture} from 'three';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
import {loadStaticModel} from './loadStaticModel';
import {buildExportScene,disposeExportScene} from './exportScene';
import {artPanel} from './art';
import type {Project} from '../domain/types';

/** Embed the displayed artwork panel; a missing image fails export instead of making a blank model. */
export async function artworkTexture(url:string):Promise<Texture>{
 const image=await new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.crossOrigin='anonymous';const fail=()=>{clearTimeout(timeout);img.onload=null;img.onerror=null;img.src='';reject(new Error('작품 이미지를 읽지 못했습니다. 잠시 후 다시 내보내세요.'));};const timeout=setTimeout(fail,15000);img.onload=()=>{clearTimeout(timeout);resolve(img);};img.onerror=fail;img.src=url;});
 const panel=artPanel(url),width=panel===null?image.naturalWidth:image.naturalWidth/5,height=image.naturalHeight;
 const scale=Math.min(1,1024/Math.max(width,height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('작품 이미지를 처리할 수 없습니다.');
 ctx.drawImage(image,(panel??0)*width,0,width,height,0,0,canvas.width,canvas.height);
 const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;return texture;
}
/** No lossy photo encoder or sRGB transfer function for tangent normal vectors. */
export async function normalMapTexture(url:string):Promise<Texture>{
 return new Promise((resolve,reject)=>{let active=true;const timer=setTimeout(()=>{active=false;reject(new Error('노멀 맵을 읽지 못했습니다.'));},15000);
  new TextureLoader().load(url,map=>{clearTimeout(timer);if(!active){map.dispose();return;}map.colorSpace=NoColorSpace;resolve(map);},undefined,()=>{clearTimeout(timer);active=false;reject(new Error('노멀 맵을 읽지 못했습니다.'));});
 });
}

export async function prepareExportScene(project:Project,onProgress:(message:string)=>void=()=>{}){
 if(project.planReference&&!project.planReference.calibrated)throw new Error('도면 축척을 설정한 뒤 3D 모델을 내보내세요.');
 const textures=new Map<string,Texture>(),cache=new Map<string,Texture>(),materialTextures=new Map<string,Texture>();const artworkModels=new Map<string,Object3D>(),modelCache=new Map<string,Object3D>();let referenceScene:Object3D|undefined,scene:Object3D|undefined;
 try{
  const artworks=project.artworks.filter(a=>a.visible&&a.imageUrl&&project.walls.some(w=>w.id===a.wallId&&w.visible));
  for(const [index,artwork] of artworks.entries()){
   onProgress(`작품 이미지 준비 중 · ${index+1}/${artworks.length}`);
   let texture=cache.get(artwork.imageUrl);if(!texture){texture=await artworkTexture(artwork.imageUrl);cache.set(artwork.imageUrl,texture);}textures.set(artwork.id,texture);
  }
  const materialUrls=new Set([project.floorMaterial?.texture?.imageUrl,...project.walls.filter(w=>w.visible).map(w=>w.material?.texture?.imageUrl)].filter((url):url is string=>!!url));
  for(const [index,url] of [...materialUrls].entries()){onProgress(`표면 텍스처 준비 중 · ${index+1}/${materialUrls.size}`);materialTextures.set(url,await artworkTexture(url));}
  const normalUrls=new Set([project.floorMaterial,...project.walls.filter(w=>w.visible).map(w=>w.material),...artworks.map(a=>a.material)].map(m=>m?.normal?.imageUrl).filter((url):url is string=>!!url));
  for(const [index,url] of [...normalUrls].entries()){onProgress(`노멀 맵 준비 중 · ${index+1}/${normalUrls.size}`);if(!materialTextures.has(url))materialTextures.set(url,await normalMapTexture(url));}
  if(project.referenceModel?.visible){
   onProgress('불러온 3D 모델 준비 중');
   const bytes=Uint8Array.from(atob(project.referenceModel.dataUrl.split(',')[1]),c=>c.charCodeAt(0));referenceScene=(await loadStaticModel(bytes.buffer)).scene;
  }
  for(const a of project.modelArtworks??[])if(a.visible){onProgress('3D 작품 모델 준비 중');let source=modelCache.get(a.model.dataUrl);if(!source){const bytes=Uint8Array.from(atob(a.model.dataUrl.split(',')[1]),c=>c.charCodeAt(0));source=(await loadStaticModel(bytes.buffer)).scene;modelCache.set(a.model.dataUrl,source);}artworkModels.set(a.id,source);}
  scene=buildExportScene(project,textures,referenceScene,materialTextures,artworkModels);
  let hasGeometry=false;scene.traverseVisible(o=>{if(o instanceof Mesh&&o.geometry.getAttribute('position')?.count>=3)hasGeometry=true;});if(!hasGeometry)throw new Error('내보낼 벽·바닥·작품 또는 3D 모델이 없습니다.');
  return scene;
 }catch(error){
  if(scene)disposeExportScene(scene);else{if(referenceScene)disposeExportScene(referenceScene);modelCache.forEach(m=>disposeExportScene(m));new Set(textures.values()).forEach(texture=>texture.dispose());}
  throw error;
 }finally{materialTextures.forEach(texture=>texture.dispose());}
}
export async function exportProjectGlb(project:Project,onProgress:(message:string)=>void=()=>{}):Promise<Blob>{
 const scene=await prepareExportScene(project,onProgress);
 try{
  onProgress('3D 모델 파일 만드는 중');
  const bytes=await new GLTFExporter().parseAsync(scene,{binary:true,onlyVisible:true,maxTextureSize:1024});
  if(!(bytes instanceof ArrayBuffer))throw new Error('3D 모델 파일을 만들지 못했습니다.');
  // A generic binary download also works in embedded WebKit browsers.
  return new Blob([bytes],{type:'application/octet-stream'});
 }finally{disposeExportScene(scene);}
}

export async function exportProjectGltf(project:Project,onProgress:(message:string)=>void=()=>{}):Promise<Blob>{
 const scene=await prepareExportScene(project,onProgress);
 try{
  onProgress('glTF 형상과 이미지 만드는 중');
  const document=await new GLTFExporter().parseAsync(scene,{binary:false,onlyVisible:true,maxTextureSize:1024});
  if(document instanceof ArrayBuffer||!document||typeof document!=='object')throw new Error('glTF 파일을 만들지 못했습니다.');
  const {createGltfFiles,zipGltfFiles}=await import('./gltfPackage');
  return await zipGltfFiles(createGltfFiles(document,project),onProgress);
 }finally{disposeExportScene(scene);}
}
