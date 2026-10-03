import {readImage} from './art';
import {parseSurfaceTexture,type SurfaceTexture} from '../domain/surfaceTexture';
export async function readSurfaceTexture(file:File):Promise<SurfaceTexture>{
 const imageUrl=await readImage(file);
 const img=new Image();const dimensions=await new Promise<{width:number;height:number}>((resolve,reject)=>{
  const timer=setTimeout(()=>{img.src='';reject(new Error('텍스처 이미지를 확인하지 못했습니다.'));},15000);
  img.onload=()=>{clearTimeout(timer);resolve({width:img.naturalWidth,height:img.naturalHeight});};img.onerror=()=>{clearTimeout(timer);reject(new Error('텍스처 이미지를 확인하지 못했습니다.'));};img.src=imageUrl;
 });
 return parseSurfaceTexture({imageUrl,widthMm:500,heightMm:Math.max(1,Math.min(1_000_000,500*dimensions.height/dimensions.width))});
}
/** A visibly artificial scale reference, not a generated wood/fabric material. */
export async function checkerSurfaceTexture(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('격자 이미지를 만들지 못했습니다.');
 ctx.fillStyle='#e5e7eb';ctx.fillRect(0,0,128,128);ctx.fillStyle='#67758a';ctx.fillRect(0,0,64,64);ctx.fillRect(64,64,64,64);
 const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('격자 이미지를 만들지 못했습니다.')),'image/png'));
 return readSurfaceTexture(new File([blob],'scale-check.png',{type:'image/png'}));
}
