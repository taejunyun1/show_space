import {CanvasTexture,SRGBColorSpace,type Object3D,type Texture} from 'three';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {buildExportScene,disposeExportScene} from './exportScene';
import {artPanel} from './art';
import type {Project} from '../domain/types';

/** Embed the displayed artwork panel; a missing image fails export instead of making a blank model. */
async function artworkTexture(url:string):Promise<Texture>{
 const image=await new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.crossOrigin='anonymous';const fail=()=>{clearTimeout(timeout);img.onload=null;img.onerror=null;img.src='';reject(new Error('작품 이미지를 읽지 못했습니다. 잠시 후 다시 내보내세요.'));};const timeout=setTimeout(fail,15000);img.onload=()=>{clearTimeout(timeout);resolve(img);};img.onerror=fail;img.src=url;});
 const panel=artPanel(url),width=panel===null?image.naturalWidth:image.naturalWidth/5,height=image.naturalHeight;
 const scale=Math.min(1,1024/Math.max(width,height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('작품 이미지를 처리할 수 없습니다.');
 ctx.drawImage(image,(panel??0)*width,0,width,height,0,0,canvas.width,canvas.height);
 const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;return texture;
}

export async function exportProjectGlb(project:Project,onProgress:(message:string)=>void=()=>{}):Promise<Blob>{
 if(project.planReference&&!project.planReference.calibrated)throw new Error('도면 축척을 설정한 뒤 3D 모델을 내보내세요.');
 const textures=new Map<string,Texture>(),cache=new Map<string,Texture>();let referenceScene:Object3D|undefined,scene:Object3D|undefined;
 try{
  const artworks=project.artworks.filter(a=>a.visible&&a.imageUrl&&project.walls.some(w=>w.id===a.wallId&&w.visible));
  for(const [index,artwork] of artworks.entries()){
   onProgress(`작품 이미지 준비 중 · ${index+1}/${artworks.length}`);
   let texture=cache.get(artwork.imageUrl);if(!texture){texture=await artworkTexture(artwork.imageUrl);cache.set(artwork.imageUrl,texture);}textures.set(artwork.id,texture);
  }
  if(project.referenceModel?.visible){
   onProgress('불러온 3D 모델 준비 중');
   const bytes=Uint8Array.from(atob(project.referenceModel.dataUrl.split(',')[1]),c=>c.charCodeAt(0));referenceScene=(await new GLTFLoader().parseAsync(bytes.buffer,'')).scene;
  }
  scene=buildExportScene(project,textures,referenceScene);
  if(!scene.children.length)throw new Error('내보낼 벽·바닥·작품 또는 3D 모델이 없습니다.');
  onProgress('3D 모델 파일 만드는 중');
  const bytes=await new GLTFExporter().parseAsync(scene,{binary:true,onlyVisible:true,maxTextureSize:1024});
  if(!(bytes instanceof ArrayBuffer))throw new Error('3D 모델 파일을 만들지 못했습니다.');
  // A generic binary download also works in embedded WebKit browsers.
  return new Blob([bytes],{type:'application/octet-stream'});
 }finally{
  if(scene)disposeExportScene(scene);else{if(referenceScene)disposeExportScene(referenceScene);new Set(textures.values()).forEach(texture=>texture.dispose());}
 }
}
