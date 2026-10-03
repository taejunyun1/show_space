export interface SurfaceTexture {imageUrl:string;widthMm:number;heightMm:number}
export function textureSize(input:unknown):{widthMm:number;heightMm:number}{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('텍스처 형식이 올바르지 않습니다.');
 const t=input as SurfaceTexture;
 for(const n of [t.widthMm,t.heightMm])if(typeof n!=='number'||!Number.isFinite(n)||n<1||n>1_000_000)throw new Error('텍스처의 실제 크기는 1~1,000,000mm여야 합니다.');
 return {widthMm:t.widthMm,heightMm:t.heightMm};
}
export function parseSurfaceTexture(input:unknown):SurfaceTexture{
 const size=textureSize(input),t=input as SurfaceTexture;
 if(typeof t.imageUrl!=='string'||t.imageUrl.length>7_000_000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(t.imageUrl))throw new Error('텍스처는 저장된 PNG·JPG·WebP 이미지여야 합니다.');
 return {...size,imageUrl:t.imageUrl};
}
