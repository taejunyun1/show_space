import {checkVideoSignature,parseVideoArtwork,videoPayload,validateVideoMetadata,VIDEO_MAX_BYTES,type VideoArtwork} from '../domain/mediaArtwork';
import type {ArtworkTemplate} from '../domain/artworkLibrary';

function playableFrame(blob:Blob,expected?:VideoArtwork){
 const video=document.createElement('video'),url=URL.createObjectURL(blob);video.preload='metadata';video.muted=true;video.playsInline=true;
 const close=()=>{video.pause();video.removeAttribute('src');video.load();URL.revokeObjectURL(url);};
 return new Promise<{video:HTMLVideoElement;close:()=>void}>((resolve,reject)=>{
  let settled=false,metadataChecked=false,seekingFrame=false;
  const cleanup=()=>{clearTimeout(timer);video.onloadeddata=null;video.onloadedmetadata=null;video.onseeked=null;video.onerror=null;};
  const fail=(error?:unknown)=>{if(settled)return;settled=true;cleanup();close();reject(error instanceof Error?error:new Error('이 브라우저에서 영상을 읽지 못했습니다. MP4(H.264) 또는 지원되는 WebM으로 저장해주세요.'));};
  const metadata=()=>{try{validateVideoMetadata(video.videoWidth,video.videoHeight,video.duration);if(expected&&(video.videoWidth!==expected.widthPx||video.videoHeight!==expected.heightPx||Math.abs(video.duration-expected.durationSeconds)>.15))throw new Error('영상 원본과 저장된 크기·길이가 다릅니다.');metadataChecked=true;video.preload='auto';}catch(e){fail(e);}};
  const finish=()=>{if(settled)return;settled=true;cleanup();resolve({video,close});};
  // A first loadeddata notification can precede usable canvas pixels in WebKit/
  // embedded Chromium. Seek near the start and wait for the decoder's seeked
  // notification before generating a poster or accepting the source.
  const timer=setTimeout(fail,20000);video.onerror=fail;video.onloadedmetadata=metadata;video.onseeked=finish;video.onloadeddata=()=>{if(!metadataChecked)metadata();if(settled||seekingFrame)return;seekingFrame=true;video.currentTime=Math.min(.05,video.duration/2);};video.src=url;video.load();
 });
}
function dataUrl(bytes:Uint8Array,mime:string){let raw='';for(let i=0;i<bytes.length;i+=32768)raw+=String.fromCharCode(...bytes.subarray(i,i+32768));return `data:${mime};base64,${btoa(raw)}`;}
export async function readVideoArtworkFile(file:File):Promise<Extract<ArtworkTemplate,{kind:'image'}>>{
 if(file.size>VIDEO_MAX_BYTES||!file.size)throw new Error('영상은 16MB 이하로 선택해주세요.');
 const mime=/\.mp4$/i.test(file.name)?'video/mp4':/\.webm$/i.test(file.name)?'video/webm':undefined;
 if(!mime)throw new Error('MP4·WebM 영상 파일을 선택해주세요.');
 const bytes=new Uint8Array(await file.arrayBuffer());checkVideoSignature(bytes,mime);const frame=await playableFrame(new Blob([bytes.slice().buffer],{type:mime}));
 try{
  const v=frame.video,video=parseVideoArtwork({dataUrl:dataUrl(bytes,mime),widthPx:v.videoWidth,heightPx:v.videoHeight,durationSeconds:v.duration,loop:true,fit:'contain'});
  const scale=Math.min(1,1024/Math.max(v.videoWidth,v.videoHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(v.videoWidth*scale));canvas.height=Math.max(1,Math.round(v.videoHeight*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('영상 포스터를 만들지 못했습니다.');ctx.drawImage(v,0,0,canvas.width,canvas.height);const poster=canvas.toDataURL('image/jpeg',.9);canvas.width=canvas.height=0;
  return {kind:'image',artwork:{name:file.name.replace(/\.[^.]+$/,'').slice(0,200)||'영상 작품',artist:'',year:'',widthMm:1200,heightMm:1200*v.videoHeight/v.videoWidth,depthMm:30,frame:'none',imageUrl:poster,artworkType:'video',presentationType:'screen',video}};
 }finally{frame.close();}
}
export async function verifyVideoArtwork(input:VideoArtwork){
 const media=parseVideoArtwork(input),{mime,bytes}=videoPayload(media.dataUrl),frame=await playableFrame(new Blob([bytes.slice().buffer],{type:mime}),media);
 try{if(frame.video.videoWidth!==media.widthPx||frame.video.videoHeight!==media.heightPx||!Number.isFinite(frame.video.duration)||Math.abs(frame.video.duration-media.durationSeconds)>.15)throw new Error('영상 원본과 저장된 크기·길이가 다릅니다.');}finally{frame.close();}
}
