import {useEffect,useLayoutEffect,useMemo,useState} from 'react';
import {useThree} from '@react-three/fiber';
import {createBaseLighting,createOutdoorLighting,sceneSpotShadowIds,createLightObject,updateLightObject,disposeLighting,type LightingSource,type RenderLight} from '../lib/sceneLighting';
import {renderProfile} from '../lib/renderQuality';
import {applyProjectorMap,installProjectorShader,framedProjectorTexture} from '../lib/projectorLighting';
import {useArtworkTexture} from './useArtworkTexture';
import {readonlyImageUrl,useReadonlyAssets} from './ReadonlyAssets';
import {Html} from '@react-three/drei';
import type {Texture} from 'three';
installProjectorShader();
function Emitter({data,shadow,shadowSize}:{data:RenderLight;shadow:boolean;shadowSize:number}){const {invalidate}=useThree(),object=useMemo(()=>createLightObject(data.kind),[data.kind]);useLayoutEffect(()=>{updateLightObject(object,data,shadow,shadowSize);invalidate();},[object,data,shadow,shadowSize,invalidate]);useEffect(()=>()=>disposeLighting(object),[object]);return <primitive object={object}/>;}
function ProjectorEmitter({data,shadow,shadowSize,shareId}:{data:RenderLight;shadow:boolean;shadowSize:number;shareId:string}){
 const assets=useReadonlyAssets(),url=data.projection?.imageUrl??(data.projection?.imageId?readonlyImageUrl(shareId,data.projection.imageId,assets):undefined);
 // Missing local presentation assets must not fall through to an unrelated publication.
 return url?<LoadedProjector data={data} url={url} shadow={shadow} shadowSize={shadowSize}/>:<ProjectorRig data={data} shadow={shadow} shadowSize={shadowSize} error="프로젝터 이미지가 없습니다"/>;
}
function LoadedProjector({data,url,shadow,shadowSize}:{data:RenderLight;url:string;shadow:boolean;shadowSize:number}){
 const {texture,ready,failed}=useArtworkTexture(url,null,1024),{aspectRatio,fit}=data.projection!;
 const [framed,setFramed]=useState<{source:Texture;aspectRatio:number;fit:typeof fit;map?:Texture;error:string}>();
 // Own fitted maps in an effect so cancelled/StrictMode renders cannot leak them.
 useEffect(()=>{
  if(!ready||!texture)return;
  let map:Texture|undefined,error='';try{map=framedProjectorTexture(texture,{aspectRatio,fit});}catch{error='프로젝터 이미지를 준비하지 못했습니다. 이미지를 다시 가져오세요.';}
  setFramed({source:texture,aspectRatio,fit,map,error});return()=>map?.dispose();
 },[texture,ready,aspectRatio,fit]);
 const current=ready&&framed&&framed.source===texture&&framed.aspectRatio===aspectRatio&&framed.fit===fit?framed:undefined;
 return <ProjectorRig data={data} shadow={shadow} shadowSize={shadowSize} map={current?.map} error={failed?'프로젝터 이미지를 읽지 못했습니다. 이미지를 다시 가져오세요.':current?.error??''}/>;
}
function ProjectorRig({data,map,error='',shadow,shadowSize}:{data:RenderLight;map?:Texture;error?:string;shadow:boolean;shadowSize:number}){
 const {invalidate}=useThree(),object=useMemo(()=>createLightObject('spot'),[]);
 useLayoutEffect(()=>{updateLightObject(object,data,shadow,shadowSize);applyProjectorMap(object,data,map,error);invalidate();},[object,data,map,error,shadow,shadowSize,invalidate]);
 useEffect(()=>()=>disposeLighting(object),[object]);
 return <><primitive object={object}/>{error&&<Html position={[data.position.x/1000,data.position.y/1000,data.position.z/1000]}><span className="dimension-label">{error}</span></Html>}</>;
}
export function Lighting3D({source,profile=renderProfile('preview'),shareId=''}: {source:LightingSource;profile?:ReturnType<typeof renderProfile>;shareId?:string}){
 const {invalidate}=useThree(),lights=source.lights??[],base=useMemo(()=>source.outdoor?.mode==='outdoor'?createOutdoorLighting(source,true,profile.baseShadowSize):createBaseLighting(source.lighting,!lights.some(l=>l.visible),profile.baseShadowSize),[source.outdoor,source.artworks,source.walls,source.importedFloor,source.referenceModel,source.modelArtworks,source.lighting,lights.some(l=>l.visible),profile.baseShadowSize]),shadows=new Set(sceneSpotShadowIds(source,profile.shadowBudget));
 useEffect(()=>{invalidate();return()=>disposeLighting(base);},[base,invalidate]);
 return <><primitive object={base}/>{lights.filter(l=>l.visible).map(l=>l.projection?<ProjectorEmitter key={l.id} data={l} shareId={shareId} shadow={shadows.has(l.id)} shadowSize={profile.spotShadowSize}/>:<Emitter key={l.id} data={l} shadow={shadows.has(l.id)} shadowSize={profile.spotShadowSize}/>)}</>;
}
