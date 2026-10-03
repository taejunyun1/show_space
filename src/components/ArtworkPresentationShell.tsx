import {BoxGeometry} from 'three';
import {useEffect,useMemo} from 'react';
import {artworkPresentation,type PresentedArtwork} from '../domain/artworkPresentation';
import {artworkFrameGeometry,artworkFrameMaterial,artworkCoverMaterial} from '../lib/artworkPresentationGeometry';
export function ArtworkPresentationShell({artwork:a}:{artwork:PresentedArtwork}){
 const p=artworkPresentation(a),geometry=useMemo(()=>artworkFrameGeometry(a),[p.widthMm,p.heightMm,p.depthMm,p.innerWidthMm,p.innerHeightMm,p.framed]);
 const material=useMemo(()=>artworkFrameMaterial(a),[a.frame,p.settings.material]);
 const cover=useMemo(()=>p.coverThicknessMm>0?artworkCoverMaterial(a):null,[p.settings.cover,p.coverThicknessMm]);
 const coverGeometry=useMemo(()=>p.coverThicknessMm>0?new BoxGeometry(p.innerWidthMm/1000,p.innerHeightMm/1000,p.coverThicknessMm/1000):null,[p.innerWidthMm,p.innerHeightMm,p.coverThicknessMm]);
 useEffect(()=>()=>coverGeometry?.dispose(),[coverGeometry]);useEffect(()=>()=>geometry.dispose(),[geometry]);useEffect(()=>()=>material.dispose(),[material]);useEffect(()=>()=>cover?.dispose(),[cover]);
 const iw=p.innerWidthMm/1000,ih=p.innerHeightMm/1000,d=p.depthMm/1000,back=Math.min(2,p.depthMm/2)/1000;
 return <><mesh name="frame" castShadow receiveShadow geometry={geometry} material={material} dispose={null}/>{p.framed&&<mesh name="backing" position={[0,0,-d/2+back/2]} receiveShadow><boxGeometry args={[iw,ih,back]}/><meshStandardMaterial color="#eee8dc" roughness={.95}/></mesh>}{p.framed&&p.settings.matWidthMm>0&&<mesh name="mat" position={[0,0,(p.imageZMm-.05)/1000]} receiveShadow><planeGeometry args={[iw,ih]}/><meshStandardMaterial color={p.settings.matColor} roughness={.95}/></mesh>}{cover&&coverGeometry&&<mesh name="front-cover" position={[0,0,d/2-p.coverThicknessMm/2000]} material={cover} geometry={coverGeometry} dispose={null}/>}</>;
}
