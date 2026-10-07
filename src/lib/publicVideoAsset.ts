import {parseVideoArtwork,videoPayload,checkVideoSignature,VIDEO_MAX_BYTES} from '../domain/mediaArtwork';
import type {Project} from '../domain/types';
export interface PublicVideoAsset {bytes:ArrayBuffer;mime:string}
export type PublicVideoCache=Map<string,{hash:string;asset:PublicVideoAsset}>;
export async function publicVideoHash(bytes:ArrayBuffer){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export function publicVideoBytes(bytes:ArrayBuffer,mime:string){if(!bytes.byteLength||bytes.byteLength>VIDEO_MAX_BYTES)throw new Error('공유 영상은 16MiB 이하여야 합니다.');checkVideoSignature(new Uint8Array(bytes),mime);return bytes;}
/** Keep source bytes; publish only explicit visible screens, under content hashes. */
export async function preparePublicVideos(project:Project,cache:PublicVideoCache=new Map()){
 const walls=new Set(project.walls.filter(w=>w.visible).map(w=>w.id)),ids=new Map<string,string>(),uploads=new Map<string,PublicVideoAsset>();
 for(const a of project.artworks)if(a.visible&&walls.has(a.wallId)&&a.video){
  const media=parseVideoArtwork(a.video);let found=cache.get(media.dataUrl);
  if(!found){const payload=videoPayload(media.dataUrl),asset={bytes:payload.bytes.slice().buffer,mime:payload.mime},hash=await publicVideoHash(asset.bytes);found={hash,asset};cache.set(media.dataUrl,found);}
  ids.set(a.id,found.hash);uploads.set(found.hash,found.asset);
 }
 return {ids,uploads};
}
