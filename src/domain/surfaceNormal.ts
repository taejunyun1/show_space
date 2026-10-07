import {parseSurfaceTexture,type SurfaceTexture} from './surfaceTexture';

/** Tangent-space OpenGL (+Y) normal data. Separate from the surface's color image. */
export interface SurfaceNormal extends SurfaceTexture {strength:number}
export function normalStrength(value:unknown):number{
 if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>5)throw new Error('노멀 강도는 0~500% 사이여야 합니다.');
 return value;
}
export function parseSurfaceNormal(input:unknown):SurfaceNormal{
 const texture=parseSurfaceTexture(input);
 if(!texture.imageUrl.startsWith('data:image/png;base64,')||texture.imageUrl.length>'data:image/png;base64,'.length+Math.ceil(5_000_000/3)*4)throw new Error('저장 노멀 맵은 PNG 5MB 이하여야 합니다.');
 const head=Uint8Array.from(atob(texture.imageUrl.split(',')[1].slice(0,128)),c=>c.charCodeAt(0));
 if(head.length<24||![137,80,78,71,13,10,26,10].every((n,i)=>head[i]===n)||new TextDecoder().decode(head.slice(12,16))!=='IHDR')throw new Error('노멀 맵 PNG 형식이 올바르지 않습니다.');
 const view=new DataView(head.buffer),width=view.getUint32(16),height=view.getUint32(20);if(width<1||height<1||Math.max(width,height)>1024)throw new Error('저장 노멀 맵은 긴 변 1,024px 이하여야 합니다.');
 return {...texture,strength:normalStrength((input as SurfaceNormal).strength)};
}
