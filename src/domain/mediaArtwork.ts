export const VIDEO_MAX_BYTES=16*1024*1024,VIDEO_MAX_EDGE=1920,VIDEO_MAX_PIXELS=1920*1080,VIDEO_MAX_SECONDS=3600;
export interface VideoArtwork {dataUrl:string;widthPx:number;heightPx:number;durationSeconds:number;loop:boolean;fit:'contain'|'cover'}
const validatedSources=new WeakMap<object,string>();
export function checkVideoSignature(bytes:Uint8Array,mime:string){
 const mp4=bytes.length>=12&&bytes[4]===102&&bytes[5]===116&&bytes[6]===121&&bytes[7]===112;
 const webm=bytes.length>=4&&[26,69,223,163].every((n,i)=>bytes[i]===n);
 if(!(mime==='video/mp4'?mp4:mime==='video/webm'?webm:false))throw new Error('영상 파일의 실제 MP4·WebM 형식이 일치하지 않습니다.');
}
export function videoPayload(value:unknown){
 if(typeof value!=='string'||value.length>Math.ceil(VIDEO_MAX_BYTES/3)*4+64)throw new Error('영상은 16MB 이하로 선택해주세요.');
 const match=/^data:(video\/(?:mp4|webm));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);if(!match)throw new Error('저장 영상에는 내장 MP4·WebM 파일만 사용할 수 있습니다.');
 let raw:string;try{raw=atob(match[2]);if(btoa(raw)!==match[2])throw new Error();}catch{throw new Error('영상 데이터가 손상됐습니다.');}
 if(!raw.length||raw.length>VIDEO_MAX_BYTES)throw new Error('영상은 16MB 이하로 선택해주세요.');
 const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));checkVideoSignature(bytes,match[1]);return {mime:match[1],bytes};
}
export function parseVideoArtwork(value:unknown):VideoArtwork{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('영상 작품 정보가 올바르지 않습니다.');const v=value as Record<string,unknown>;
 // Position/size edits keep the same immutable media object. Do not decode
 // a multi-megabyte clip on every pointer update; changed sources revalidate.
 const known=validatedSources.get(v);if(known===undefined||known!==v.dataUrl)videoPayload(v.dataUrl);
 validateVideoMetadata(v.widthPx,v.heightPx,v.durationSeconds);
 if(typeof v.loop!=='boolean'||!['contain','cover'].includes(v.fit as string))throw new Error('영상 반복·화면 비율 설정이 올바르지 않습니다.');
 validatedSources.set(v,v.dataUrl as string);
 return {dataUrl:v.dataUrl as string,widthPx:v.widthPx as number,heightPx:v.heightPx as number,durationSeconds:v.durationSeconds as number,loop:v.loop,fit:v.fit as VideoArtwork['fit']};
}
/** Check real container metadata before requesting a decoded frame. */
export function validateVideoMetadata(width:unknown,height:unknown,duration:unknown){
 if(!Number.isInteger(width)||!Number.isInteger(height)||(width as number)<1||(height as number)<1||Math.max(width as number,height as number)>VIDEO_MAX_EDGE||(width as number)*(height as number)>VIDEO_MAX_PIXELS)throw new Error('영상은 긴 변 1,920px·2,073,600픽셀 이하로 선택해주세요.');
 if(typeof duration!=='number'||!Number.isFinite(duration)||duration<=0||duration>VIDEO_MAX_SECONDS)throw new Error('영상 길이는 0초 초과·1시간 이하로 선택해주세요.');
}
/** Preserve pixels' aspect ratio; contain adds black bars, cover crops UVs centrally. */
export function videoScreenLayout(widthMm:number,heightMm:number,widthPx:number,heightPx:number,fit:VideoArtwork['fit']){
 const ratio=widthPx/heightPx,screen=widthMm/heightMm;
 if(fit==='contain')return {widthMm:screen>ratio?heightMm*ratio:widthMm,heightMm:screen>ratio?heightMm:widthMm/ratio,repeat:[1,1] as [number,number],offset:[0,0] as [number,number]};
 const x=screen<ratio?screen/ratio:1,y=screen>ratio?ratio/screen:1;
 return {widthMm,heightMm,repeat:[x,y] as [number,number],offset:[(1-x)/2,(1-y)/2] as [number,number]};
}
