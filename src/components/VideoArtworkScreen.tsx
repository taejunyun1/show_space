import {useEffect,useState,useSyncExternalStore} from 'react';
import {useThree} from '@react-three/fiber';
import {VideoTexture,SRGBColorSpace,type Texture} from 'three';
import {videoPlayback,videoSessionKey,type VideoSession} from '../lib/videoPlayback';
import {videoScreenLayout,type VideoArtwork} from '../domain/mediaArtwork';
import {useEditor} from '../state/editor';

function useVideoSurface(key:string,media:VideoArtwork){
 const {invalidate}=useThree(),wanted=useSyncExternalStore(f=>videoPlayback.subscribe(key,f),()=>videoPlayback.get(key));
 const session=wanted?.source===media.dataUrl?wanted:undefined;
 const ready=useSyncExternalStore(f=>session?.subscribe(f)??(()=>{}),()=>session?.snapshot.ready??false);
 const [shown,setShown]=useState<{session:VideoSession;texture:VideoTexture}>();
 useEffect(()=>{
  if(!session||session.closed)return;const release=videoPlayback.retain(session,'surface'),video=session.video,texture=new VideoTexture(video);texture.colorSpace=SRGBColorSpace;setShown({session,texture});let active=true,frame=0;
  const rvfc=typeof video.requestVideoFrameCallback==='function',next=()=>{if(!active)return;invalidate();frame=rvfc?video.requestVideoFrameCallback(next):requestAnimationFrame(()=>{if(!video.paused)next();});};
  const changed=()=>{if(video.readyState>=2)texture.needsUpdate=true;invalidate();},started=()=>{if(!rvfc&&!frame)next();},stopped=()=>{if(!rvfc&&frame){cancelAnimationFrame(frame);frame=0;}invalidate();};
  if(rvfc)frame=video.requestVideoFrameCallback(next);else if(!video.paused)next();
  const events:Array<[string,()=>void]>=[['loadeddata',changed],['seeked',changed],['error',changed],['play',started],['pause',stopped],['ended',stopped]];for(const [name,f] of events)video.addEventListener(name,f);changed();
  return ()=>{active=false;if(frame){if(rvfc)video.cancelVideoFrameCallback(frame);else cancelAnimationFrame(frame);}for(const [name,f] of events)video.removeEventListener(name,f);texture.dispose();release();invalidate();};
 },[session,invalidate]);
 useEffect(()=>{session?.updateLoop(media.loop);},[session,media.loop]);
 return ready&&shown?.session===session?shown?.texture:undefined;
}
export function VideoArtworkScreen({id,media,poster,widthMm,heightMm,z}:{id:string;media:VideoArtwork;poster?:Texture;widthMm:number;heightMm:number;z:number}){
 const projectId=useEditor(s=>s.project.id),texture=useVideoSurface(videoSessionKey(projectId,id),media),layout=videoScreenLayout(widthMm,heightMm,media.widthPx,media.heightPx,media.fit);
 // The fallback is a private texture clone: UV cropping must not alter shared image LODs.
 const [fallback,setFallback]=useState<{source:Texture;copy:Texture}>();useEffect(()=>{if(!poster)return;const copy=poster.clone();copy.needsUpdate=true;setFallback({source:poster,copy});return ()=>copy.dispose();},[poster]);const map=texture??(fallback?.source===poster?fallback?.copy:undefined);
 useEffect(()=>{if(map){map.repeat.set(...layout.repeat);map.offset.set(...layout.offset);map.needsUpdate=true;}},[map,layout.repeat[0],layout.repeat[1],layout.offset[0],layout.offset[1]]);
 return <><mesh name="video-screen-background" position={[0,0,z]}><planeGeometry args={[widthMm/1000,heightMm/1000]}/><meshBasicMaterial color="#000000" toneMapped={false}/></mesh><mesh name="video-display" position={[0,0,z+.0005]}><planeGeometry args={[layout.widthMm/1000,layout.heightMm/1000]}/><meshBasicMaterial color={map?'#ffffff':'#000000'} map={map??null} toneMapped={false} onUpdate={material=>{material.needsUpdate=true;}}/></mesh></>;
}
