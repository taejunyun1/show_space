import {useEffect,useMemo,useState} from 'react';
import {Html} from '@react-three/drei';
import {TextureLoader,type Texture,type Side} from 'three';
import type {SurfaceMaterial} from '../domain/materials';
import type {SurfaceTexture} from '../domain/surfaceTexture';
import {physicalMaterialParameters} from '../lib/surfaceMaterial';
import {repeatingSurfaceTexture} from '../lib/surfaceUv';
function useSurfaceTexture(texture?:SurfaceTexture){
 const url=texture?.imageUrl;
 const [source,setSource]=useState<{url:string;map?:Texture;failed?:boolean}>();
 useEffect(()=>{
  if(!url)return;
  let active=true;
  const timer=setTimeout(()=>{if(active){active=false;setSource({url,failed:true});}},15000);
  const map=new TextureLoader().load(url,loaded=>{clearTimeout(timer);if(active)setSource({url,map:loaded});else loaded.dispose();},undefined,()=>{clearTimeout(timer);if(active)setSource({url,failed:true});});
  return()=>{active=false;clearTimeout(timer);map.dispose();};
 },[url]);
 const map=useMemo(()=>source?.url===url&&source?.map&&texture?repeatingSurfaceTexture(source.map,texture):undefined,[source,url,texture?.widthMm,texture?.heightMm]);
 useEffect(()=>()=>map?.dispose(),[map]);
 return {map,failed:!!url&&source?.url===url&&source.failed};
}
export function SurfaceFinish({color,material,roughness,map,side,texture}:{color:string;material?:SurfaceMaterial;roughness:number;map?:Texture;side?:Side;texture?:SurfaceTexture}){
 const loaded=useSurfaceTexture(texture),surfaceMap=loaded.map??map;
 return <>{material?<meshPhysicalMaterial {...physicalMaterialParameters(color,material)} map={surfaceMap} side={side} onUpdate={m=>{m.needsUpdate=true;}}/>:<meshStandardMaterial color={color} roughness={roughness} map={surfaceMap} side={side} onUpdate={m=>{m.needsUpdate=true;}}/>} {loaded.failed&&<Html center style={{pointerEvents:'none',whiteSpace:'nowrap'}}><span className="dimension-label">텍스처를 불러오지 못했습니다</span></Html>}</>;
}
