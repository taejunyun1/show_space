import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {readonlyVideoSessionKey,type PublicVideoArtwork} from '../domain/publicVideo';
import {videoPlayback,type VideoSession,type VideoStatus} from '../lib/videoPlayback';
import {readonlyImageUrl,readonlyVideoSource,useReadonlyAssets} from './ReadonlyAssets';
const idle:VideoStatus={playing:false,ready:false,timeSeconds:0,durationSeconds:0,muted:true};
const time=(seconds:number)=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
/** Playback is transient. A viewer cannot change geometry, looping or the screen fit. */
export function ReadonlyVideoControls({artwork,shareId,scope}:{artwork:{id:string;imageId:string;video:PublicVideoArtwork};shareId:string;scope:string}){
 const assets=useReadonlyAssets(),source=readonlyVideoSource(shareId,artwork.video.videoId,assets),poster=readonlyImageUrl(shareId,artwork.imageId,assets),key=readonlyVideoSessionKey(scope,artwork.id),host=useRef<HTMLDivElement>(null);
 const [session,setSession]=useState<VideoSession>(),[error,setError]=useState('');
 useEffect(()=>{let lease:ReturnType<typeof videoPlayback.open>|undefined;setError('');try{if(!source)throw new Error('영상 원본을 찾지 못했습니다.');lease=assets?videoPlayback.open(key,{...artwork.video,dataUrl:source}):videoPlayback.openPublic(key,shareId,artwork.video);setSession(lease.session);}catch(e){setSession(undefined);setError(e instanceof Error?e.message:'영상 화면을 열지 못했습니다.');}return ()=>lease?.release();},[key,source,shareId,!!assets,artwork.video.loop]);
 useEffect(()=>{if(!session||!host.current)return;session.video.poster=poster??'';session.video.className='video-preview-native';host.current.appendChild(session.video);return ()=>session.video.remove();},[session,poster]);
 const status=useSyncExternalStore(f=>session?.subscribe(f)??(()=>{}),()=>session?.snapshot??idle);
 return <section className="video-artwork-controls" aria-label="공유 영상 재생"><h3>영상 스크린</h3><div ref={host}/><div className="rotation-buttons"><button className="button secondary" disabled={!session||!status.ready} onClick={()=>{if(status.playing)session!.pause();else void session!.play().catch(()=>{});}}>{status.playing?'영상 일시정지':'영상 재생'}</button><button className="button secondary" disabled={!session||!status.ready} onClick={()=>{session!.pause();session!.seek(0);}}>영상 처음으로</button></div><output aria-label="공유 영상 재생 위치">{time(status.timeSeconds)} / {time(artwork.video.durationSeconds)}</output><label>재생 위치<input type="range" aria-label="공유 영상 재생 위치 조절" min={0} max={artwork.video.durationSeconds} step={.1} value={status.timeSeconds} disabled={!session||!status.ready} onChange={e=>session!.seek(Number(e.target.value))}/></label><p>기본 음소거 · 미리보기의 소리 버튼으로 켤 수 있습니다. 재생 위치와 소리는 저장되지 않습니다.</p>{(error||status.error)&&<p role="alert">{error||status.error}</p>}{session&&!status.ready&&!status.error&&<p role="status">영상을 읽는 중…</p>}</section>;
}
