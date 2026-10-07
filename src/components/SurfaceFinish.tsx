import {captureSurfaceStatus} from '../lib/captureSurface';
import {useEffect,useMemo,useState} from 'react';
import {Html} from '@react-three/drei';
import {TextureLoader,type Texture,type Side} from 'three';
import type {SurfaceMaterial} from '../domain/materials';
import type {SurfaceTexture} from '../domain/surfaceTexture';
import {physicalMaterialParameters} from '../lib/surfaceMaterial';
import {repeatingSurfaceTexture,repeatingNormalTexture} from '../lib/surfaceUv';
function useSurfaceTexture(texture?:SurfaceTexture,normal=false,extentM?:readonly [number,number]){
 const url=texture?.imageUrl;
 const [source,setSource]=useState<{url:string;map?:Texture;failed?:boolean}>();
 useEffect(()=>{
  if(!url)return;
  let active=true;
  const timer=setTimeout(()=>{if(active){active=false;setSource({url,failed:true});}},15000);
  const map=new TextureLoader().load(url,loaded=>{clearTimeout(timer);if(active)setSource({url,map:loaded});else loaded.dispose();},undefined,()=>{clearTimeout(timer);if(active)setSource({url,failed:true});});
  return()=>{active=false;clearTimeout(timer);map.dispose();};
 },[url]);
 const map=useMemo(()=>source?.url===url&&source?.map&&texture?(normal?repeatingNormalTexture(source.map,texture,extentM):repeatingSurfaceTexture(source.map,texture)):undefined,[source,url,texture?.widthMm,texture?.heightMm,normal,extentM?.[0],extentM?.[1]]);
 useEffect(()=>()=>map?.dispose(),[map]);
 return {map,failed:!!url&&source?.url===url&&source.failed};
}
export function SurfaceFinish({color,material,roughness,map,side,texture,normalExtentM}:{color:string;material?:SurfaceMaterial;roughness:number;map?:Texture;side?:Side;texture?:SurfaceTexture;normalExtentM?:readonly [number,number]}){
 const loaded=useSurfaceTexture(texture),normal=useSurfaceTexture(material?.normal,true,normalExtentM),surfaceMap=loaded.map??map,captureSurface=captureSurfaceStatus(texture,material?.normal,loaded,normal);
 return <>{material?<meshPhysicalMaterial userData={{captureSurface}} {...physicalMaterialParameters(color,material)} map={surfaceMap??null} normalMap={normal.map??null} side={side} onUpdate={m=>{m.needsUpdate=true;}}/>:<meshStandardMaterial userData={{captureSurface}} color={color} roughness={roughness} map={surfaceMap??null} side={side} onUpdate={m=>{m.needsUpdate=true;}}/>} {(loaded.failed||normal.failed)&&<Html center style={{pointerEvents:'none',whiteSpace:'nowrap'}}><span className="dimension-label">{normal.failed?'노멀 맵':'텍스처'}를 불러오지 못했습니다</span></Html>}</>;
}
