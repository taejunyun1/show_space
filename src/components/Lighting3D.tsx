import {useEffect,useLayoutEffect,useMemo} from 'react';
import {useThree} from '@react-three/fiber';
import {createBaseLighting,createOutdoorLighting,sceneSpotShadowIds,createLightObject,updateLightObject,disposeLighting,type LightingSource,type RenderLight} from '../lib/sceneLighting';
function Emitter({data,shadow}:{data:RenderLight;shadow:boolean}){const {invalidate}=useThree(),object=useMemo(()=>createLightObject(data.kind),[data.kind]);useLayoutEffect(()=>{updateLightObject(object,data,shadow);invalidate();},[object,data,shadow,invalidate]);useEffect(()=>()=>disposeLighting(object),[object]);return <primitive object={object}/>;}
export function Lighting3D({source}: {source:LightingSource}){
 const {invalidate}=useThree(),lights=source.lights??[],base=useMemo(()=>source.outdoor?.mode==='outdoor'?createOutdoorLighting(source):createBaseLighting(source.lighting,!lights.some(l=>l.visible)),[source.outdoor,source.artworks,source.walls,source.importedFloor,source.referenceModel,source.lighting,lights.some(l=>l.visible)]),shadows=new Set(sceneSpotShadowIds(source));
 useEffect(()=>{invalidate();return()=>disposeLighting(base);},[base,invalidate]);
 return <><primitive object={base}/>{lights.filter(l=>l.visible).map(l=><Emitter key={l.id} data={l} shadow={shadows.has(l.id)}/>)}</>;
}
