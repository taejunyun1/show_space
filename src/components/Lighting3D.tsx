import {useEffect,useLayoutEffect,useMemo} from 'react';
import {useThree} from '@react-three/fiber';
import {createBaseLighting,createOutdoorLighting,sceneSpotShadowIds,createLightObject,updateLightObject,disposeLighting,type LightingSource,type RenderLight} from '../lib/sceneLighting';
import {renderProfile} from '../lib/renderQuality';
function Emitter({data,shadow,shadowSize}:{data:RenderLight;shadow:boolean;shadowSize:number}){const {invalidate}=useThree(),object=useMemo(()=>createLightObject(data.kind),[data.kind]);useLayoutEffect(()=>{updateLightObject(object,data,shadow,shadowSize);invalidate();},[object,data,shadow,shadowSize,invalidate]);useEffect(()=>()=>disposeLighting(object),[object]);return <primitive object={object}/>;}
export function Lighting3D({source,profile=renderProfile('preview')}: {source:LightingSource;profile?:ReturnType<typeof renderProfile>}){
 const {invalidate}=useThree(),lights=source.lights??[],base=useMemo(()=>source.outdoor?.mode==='outdoor'?createOutdoorLighting(source,true,profile.baseShadowSize):createBaseLighting(source.lighting,!lights.some(l=>l.visible),profile.baseShadowSize),[source.outdoor,source.artworks,source.walls,source.importedFloor,source.referenceModel,source.modelArtworks,source.lighting,lights.some(l=>l.visible),profile.baseShadowSize]),shadows=new Set(sceneSpotShadowIds(source,profile.shadowBudget));
 useEffect(()=>{invalidate();return()=>disposeLighting(base);},[base,invalidate]);
 return <><primitive object={base}/>{lights.filter(l=>l.visible).map(l=><Emitter key={l.id} data={l} shadow={shadows.has(l.id)} shadowSize={profile.spotShadowSize}/>)}</>;
}
