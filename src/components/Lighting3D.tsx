import {useEffect,useLayoutEffect,useMemo} from 'react';
import {useThree} from '@react-three/fiber';
import {createBaseLighting,createOutdoorLighting,sceneSpotShadowIds,createLightObject,updateLightObject,disposeLighting,type LightingSource,type RenderLight} from '../lib/sceneLighting';
import {renderProfile} from '../lib/renderQuality';
import {applyProjectorMap,installProjectorShader,framedProjectorTexture} from '../lib/projectorLighting';
import {useArtworkTexture} from './useArtworkTexture';
import {readonlyImageUrl,useReadonlyAssets} from './ReadonlyAssets';
import {Html} from '@react-three/drei';
installProjectorShader();
function Emitter({data,shadow,shadowSize}:{data:RenderLight;shadow:boolean;shadowSize:number}){const {invalidate}=useThree(),object=useMemo(()=>createLightObject(data.kind),[data.kind]);useLayoutEffect(()=>{updateLightObject(object,data,shadow,shadowSize);invalidate();},[object,data,shadow,shadowSize,invalidate]);useEffect(()=>()=>disposeLighting(object),[object]);return <primitive object={object}/>;}
function ProjectorEmitter({data,shadow,shadowSize,shareId}:{data:RenderLight;shadow:boolean;shadowSize:number;shareId:string}){
 const assets=useReadonlyAssets(),url=data.projection?.imageUrl??(data.projection?.imageId?readonlyImageUrl(shareId,data.projection.imageId,assets):undefined);
 // Missing local presentation assets must not fall through to an unrelated publication.
 return url?<LoadedProjector data={data} url={url} shadow={shadow} shadowSize={shadowSize}/>:<Html position={[data.position.x/1000,data.position.y/1000,data.position.z/1000]}><span className="dimension-label">프로젝터 이미지가 없습니다</span></Html>;
}
function LoadedProjector({data,url,shadow,shadowSize}:{data:RenderLight;url:string;shadow:boolean;shadowSize:number}){
 const {invalidate}=useThree(),{texture,ready,failed}=useArtworkTexture(url,null,1024),object=useMemo(()=>createLightObject('spot'),[]);
 const map=useMemo(()=>ready&&texture?framedProjectorTexture(texture,data.projection!):undefined,[texture,ready,data.projection!.aspectRatio,data.projection!.fit]);
 useEffect(()=>()=>map?.dispose(),[map]);
 useLayoutEffect(()=>{updateLightObject(object,data,shadow,shadowSize);applyProjectorMap(object,data,map);invalidate();},[object,data,map,shadow,shadowSize,invalidate]);
 useEffect(()=>()=>disposeLighting(object),[object]);
 return <><primitive object={object}/>{failed&&<Html position={[data.position.x/1000,data.position.y/1000,data.position.z/1000]}><span className="dimension-label">프로젝터 이미지를 읽지 못했습니다</span></Html>}</>;
}
export function Lighting3D({source,profile=renderProfile('preview'),shareId=''}: {source:LightingSource;profile?:ReturnType<typeof renderProfile>;shareId?:string}){
 const {invalidate}=useThree(),lights=source.lights??[],base=useMemo(()=>source.outdoor?.mode==='outdoor'?createOutdoorLighting(source,true,profile.baseShadowSize):createBaseLighting(source.lighting,!lights.some(l=>l.visible),profile.baseShadowSize),[source.outdoor,source.artworks,source.walls,source.importedFloor,source.referenceModel,source.modelArtworks,source.lighting,lights.some(l=>l.visible),profile.baseShadowSize]),shadows=new Set(sceneSpotShadowIds(source,profile.shadowBudget));
 useEffect(()=>{invalidate();return()=>disposeLighting(base);},[base,invalidate]);
 return <><primitive object={base}/>{lights.filter(l=>l.visible).map(l=>l.projection?<ProjectorEmitter key={l.id} data={l} shareId={shareId} shadow={shadows.has(l.id)} shadowSize={profile.spotShadowSize}/>:<Emitter key={l.id} data={l} shadow={shadows.has(l.id)} shadowSize={profile.spotShadowSize}/>)}</>;
}
