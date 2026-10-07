import {parseVideoArtwork,videoPayload,type VideoArtwork} from '../domain/mediaArtwork';
export interface VideoStatus {playing:boolean;ready:boolean;timeSeconds:number;durationSeconds:number;muted:boolean;error?:string}
export interface VideoSession {
 key:string;source:string;video:HTMLVideoElement;snapshot:VideoStatus;closed:boolean;controls:number;surfaces:number;started:number;
 subscribe:(listener:()=>void)=>()=>void;play:()=>Promise<void>;pause:()=>void;seek:(seconds:number)=>void;updateLoop:(loop:boolean)=>void;
}
type Options={createVideo?:()=>HTMLVideoElement;createUrl?:(media:VideoArtwork)=>string;revokeUrl?:(url:string)=>void;maxSessions?:number;maxPlaying?:number};
export function createVideoPlaybackRuntime(options:Options={}){
 const sessions=new Map<string,VideoSession>(),listeners=new Map<string,Set<()=>void>>(),destroyers=new WeakMap<VideoSession,()=>void>();let sequence=0,observing=false;
 const maxSessions=options.maxSessions??8,maxPlaying=options.maxPlaying??4;
 const createVideo=options.createVideo??(()=>document.createElement('video'));
 const createUrl=options.createUrl??((media:VideoArtwork)=>{const {mime,bytes}=videoPayload(media.dataUrl);return URL.createObjectURL(new Blob([bytes.slice().buffer],{type:mime}));});
 const revoke=options.revokeUrl??(url=>URL.revokeObjectURL(url));
 const notify=(key:string)=>{for(const f of listeners.get(key)??[])f();};
 const hidden=()=>{if(document.visibilityState==='hidden')for(const s of sessions.values())s.pause();};
 function retire(session:VideoSession){if(session.closed)return;session.closed=true;destroyers.get(session)?.();if(sessions.get(session.key)===session){sessions.delete(session.key);notify(session.key);}if(!sessions.size&&observing){document.removeEventListener('visibilitychange',hidden);observing=false;}}
 function retain(session:VideoSession,owner:'controls'|'surface'){
  if(session.closed)return ()=>{};const field=owner==='controls'?'controls':'surfaces';session[field]++;let released=false;
  return ()=>{if(released)return;released=true;session[field]--;if(!session.closed&&!session.controls&&!session.surfaces)retire(session);};
 }
 function open(key:string,input:VideoArtwork){
  let session=sessions.get(key);if(session&&session.source!==input.dataUrl){retire(session);session=undefined;}
  if(!session){
   const media=parseVideoArtwork(input);
   if(sessions.size>=maxSessions){const idle=[...sessions.values()].find(s=>!s.controls&&s.video.paused);if(idle)retire(idle);else throw new Error('재생 중인 영상을 잠시 멈춘 뒤 새 영상을 선택해주세요.');}
   const video=createVideo(),url=createUrl(media),subscribers=new Set<()=>void>();let error:string|undefined;
   video.preload='auto';video.muted=true;video.playsInline=true;video.controls=true;video.loop=media.loop;video.setAttribute('aria-label','선택한 영상 미리보기');
   const current:VideoSession={key,source:media.dataUrl,video,closed:false,controls:0,surfaces:0,started:0,snapshot:{playing:false,ready:false,timeSeconds:0,durationSeconds:media.durationSeconds,muted:true},
    subscribe(f){subscribers.add(f);return ()=>subscribers.delete(f);},
    async play(){if(current.closed)throw new Error('영상이 닫혔습니다.');try{await video.play();}catch(failure){error='브라우저에서 재생하지 못했습니다. 영상 재생을 다시 눌러주세요.';publish();throw failure;}},
    pause(){if(!current.closed)video.pause();},seek(seconds){if(current.closed||!Number.isFinite(seconds)||video.readyState<1)return;video.currentTime=Math.max(0,Math.min(media.durationSeconds,seconds));publish();},updateLoop(loop){if(!current.closed)video.loop=loop;},
   };
   const publish=()=>{if(current.closed)return;current.snapshot={playing:!video.paused,ready:!error&&video.readyState>=2,timeSeconds:Number.isFinite(video.currentTime)?video.currentTime:0,durationSeconds:media.durationSeconds,muted:video.muted,...(error?{error}:{})};for(const f of subscribers)f();};
   const metadata=()=>{if(video.videoWidth!==media.widthPx||video.videoHeight!==media.heightPx||!Number.isFinite(video.duration)||Math.abs(video.duration-media.durationSeconds)>.15){error='영상 원본과 저장된 크기·길이가 다릅니다.';video.pause();video.removeAttribute('src');video.load();}publish();};
   const started=()=>{error=undefined;current.started=++sequence;const others=[...sessions.values()].filter(s=>s!==current&&!s.video.paused).sort((a,b)=>a.started-b.started);while(others.length>=maxPlaying)others.shift()!.pause();publish();};
   const failed=()=>{error='영상 파일을 재생할 수 없습니다. 지원되는 MP4·WebM 파일인지 확인해주세요.';publish();};
   const events:Array<[string,()=>void]>=[['loadedmetadata',metadata],['loadeddata',publish],['play',started],['pause',publish],['ended',publish],['timeupdate',publish],['seeked',publish],['volumechange',publish],['error',failed]];
   for(const [name,f] of events)video.addEventListener(name,f);
   destroyers.set(current,()=>{for(const [name,f] of events)video.removeEventListener(name,f);video.pause();video.removeAttribute('src');video.load();revoke(url);subscribers.clear();});
   sessions.set(key,current);session=current;video.src=url;video.load();notify(key);
   if(!observing&&typeof document!=='undefined'){document.addEventListener('visibilitychange',hidden);observing=true;}
  }
  session.updateLoop(input.loop);return {session,release:retain(session,'controls')};
 }
 return {open,retain,get:(key:string)=>sessions.get(key),subscribe(key:string,f:()=>void){let list=listeners.get(key);if(!list){list=new Set();listeners.set(key,list);}list.add(f);return ()=>{list!.delete(f);if(!list!.size)listeners.delete(key);};},closeAll(){for(const s of [...sessions.values()])retire(s);}};
}
export const videoPlayback=createVideoPlaybackRuntime();
export const videoSessionKey=(projectId:string,artworkId:string)=>JSON.stringify([projectId,artworkId]);
