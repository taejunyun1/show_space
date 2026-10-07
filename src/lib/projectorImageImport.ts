import {readImage} from './art';
import {parseSurfaceTexture} from '../domain/surfaceTexture';

/** Keep small source files unchanged; larger files use the existing 20MiB image pipeline. */
export async function readProjectorImage(file:File,signal?:AbortSignal):Promise<{imageUrl:string;optimized:boolean}>{
 signal?.throwIfAborted();
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||!file.size||file.size>20*1024*1024)throw new Error('투사 이미지는 JPG·PNG·WebP 파일 20MB 이하로 선택해주세요.');
 const header=new Uint8Array(await file.slice(0,12).arrayBuffer()),starts=(values:number[])=>values.every((n,i)=>header[i]===n);
 const valid=file.type==='image/png'?starts([137,80,78,71,13,10,26,10]):file.type==='image/jpeg'?starts([255,216,255]):starts([82,73,70,70])&&new TextDecoder().decode(header.slice(8,12))==='WEBP';
 if(!valid)throw new Error('투사 이미지는 실제 JPG·PNG·WebP 파일을 선택해주세요.');
 signal?.throwIfAborted();
 if(file.size>5_000_000){const imageUrl=await readImage(file);signal?.throwIfAborted();parseSurfaceTexture({imageUrl,widthMm:1,heightMm:1});return {imageUrl,optimized:true};}
 let bitmap:ImageBitmap;
 try{bitmap=await createImageBitmap(file);}catch{signal?.throwIfAborted();throw new Error('투사 이미지를 읽지 못했습니다. 파일을 확인해주세요.');}
 try{
  signal?.throwIfAborted();
  if(!bitmap.width||!bitmap.height||bitmap.width*bitmap.height>60_000_000)throw new Error('투사 이미지는 1~6천만 픽셀이어야 합니다.');
 }finally{bitmap.close();}
 const bytes=new Uint8Array(await file.arrayBuffer());signal?.throwIfAborted();
 let raw='';for(let i=0;i<bytes.length;i+=32768)raw+=String.fromCharCode(...bytes.subarray(i,i+32768));
 const imageUrl=`data:${file.type};base64,${btoa(raw)}`;parseSurfaceTexture({imageUrl,widthMm:1,heightMm:1});
 return {imageUrl,optimized:false};
}
