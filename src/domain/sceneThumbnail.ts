import {textureHeaderSize} from '../lib/artworkModelPayload';
import type {SceneThumbnail} from './types';
export const SCENE_THUMBNAIL_EDGE=320,SCENE_THUMBNAIL_MAX_BYTES=64*1024;
/** Bound decoded pixels before allocating them; backups may contain untrusted previews. */
export function parseSceneThumbnail(value:unknown):SceneThumbnail{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Scene 미리보기 형식이 올바르지 않습니다.');
 const v=value as Record<string,unknown>;
 if(!['3d','plan','elevation'].includes(String(v.view)))throw new Error('Scene 미리보기 화면 종류가 올바르지 않습니다.');
 if(typeof v.imageUrl!=='string'||v.imageUrl.length>Math.ceil(SCENE_THUMBNAIL_MAX_BYTES/3)*4+64)throw new Error('Scene 미리보기는 64KiB 이하여야 합니다.');
 const match=/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(v.imageUrl);
 if(!match)throw new Error('Scene 미리보기는 내장 PNG·JPG만 지원합니다.');
 let bytes:Uint8Array;try{bytes=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0));}catch{throw new Error('Scene 미리보기 이미지가 손상됐습니다.');}
 if(!bytes.length||bytes.length>SCENE_THUMBNAIL_MAX_BYTES)throw new Error('Scene 미리보기는 64KiB 이하여야 합니다.');
 const [width,height]=textureHeaderSize(bytes,'image/'+match[1]);
 if(width<1||height<1||Math.max(width,height)>SCENE_THUMBNAIL_EDGE||width!==v.widthPx||height!==v.heightPx)throw new Error('Scene 미리보기 크기는 실제 이미지와 일치하고 긴 변 320px 이하여야 합니다.');
 return {imageUrl:v.imageUrl,widthPx:width,heightPx:height,view:v.view as SceneThumbnail['view']};
}
