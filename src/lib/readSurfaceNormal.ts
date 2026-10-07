import {parseSurfaceNormal,type SurfaceNormal} from '../domain/surfaceNormal';

export type NormalConvention='opengl'|'directx';
/** Convert DirectX -Y once, so preview and glTF use the same +Y data and scalar strength. */
export function normalPixels(pixels:Uint8ClampedArray,convention:NormalConvention){
 const result=new Uint8ClampedArray(pixels);
 for(let i=0;i<result.length;i+=4){
  if(result[i+3]!==255)throw new Error('노멀 맵은 투명 영역이 없는 이미지로 선택하세요.');
  if(convention==='directx')result[i+1]=255-result[i+1];
 }
 return result;
}
export async function readSurfaceNormal(file:File,convention:NormalConvention='opengl'):Promise<SurfaceNormal>{
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>20*1024*1024)throw new Error('노멀 맵은 PNG·JPG·WebP 이미지 20MB 이하로 선택하세요. PNG를 권장합니다.');
 const bitmap=await createImageBitmap(file,{colorSpaceConversion:'none',premultiplyAlpha:'none'});
 try{
  if(bitmap.width*bitmap.height>60_000_000)throw new Error('노멀 맵은 6천만 픽셀 이하여야 합니다.');
  const scale=Math.min(1,1024/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const context=canvas.getContext('2d');if(!context)throw new Error('노멀 맵을 읽지 못했습니다.');
  context.drawImage(bitmap,0,0,canvas.width,canvas.height);
  const image=context.getImageData(0,0,canvas.width,canvas.height);image.data.set(normalPixels(image.data,convention));context.putImageData(image,0,0);
  return parseSurfaceNormal({imageUrl:canvas.toDataURL('image/png'),widthMm:500,heightMm:500*canvas.height/canvas.width,strength:1});
 }finally{bitmap.close();}
}
