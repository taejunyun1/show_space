import {validateVideoMetadata,type VideoArtwork} from './mediaArtwork';
export const PUBLIC_VIDEO_ASSETS_MAX=20,PUBLIC_VIDEOS_MAX_BYTES=80*1024*1024;
export type PublicVideoArtwork=Omit<VideoArtwork,'dataUrl'>&{videoId:string};
export function parsePublicVideo(value:unknown):PublicVideoArtwork{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('공유 영상 정보가 올바르지 않습니다.');const v=value as Record<string,unknown>;
 if(typeof v.videoId!=='string'||!/^[0-9a-f]{64}$/.test(v.videoId))throw new Error('공유 영상 자산 ID가 올바르지 않습니다.');
 validateVideoMetadata(v.widthPx,v.heightPx,v.durationSeconds);if(typeof v.loop!=='boolean'||!['contain','cover'].includes(v.fit as string))throw new Error('공유 영상 반복·화면 비율이 올바르지 않습니다.');
 return {videoId:v.videoId,widthPx:v.widthPx as number,heightPx:v.heightPx as number,durationSeconds:v.durationSeconds as number,loop:v.loop,fit:v.fit as 'contain'|'cover'};
}
export const readonlyVideoSessionKey=(scope:string,artworkId:string)=>JSON.stringify(['readonly-video',scope,artworkId]);
export function publicVideoUrl(shareId:string,videoId:string){if(!/^[0-9a-f]{48}$/.test(shareId)||!/^[0-9a-f]{64}$/.test(videoId))throw new Error('공유 영상 주소가 올바르지 않습니다.');return `/api/public/${shareId}/videos/${videoId}`;}
