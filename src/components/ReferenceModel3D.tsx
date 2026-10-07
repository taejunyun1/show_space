import {captureModelBoundsKey,captureModelMatches,captureModelStatus,type LoadedCaptureModel} from '../lib/captureAssets';
import {useEffect,useState} from 'react';
import {type ThreeEvent} from '@react-three/fiber';
import {Html} from '@react-three/drei';
import {loadStaticModel} from '../lib/loadStaticModel';
import {Mesh,type Group} from 'three';
import {inspectStaticArtworkGlb} from '../lib/artworkModelPayload';
import {checkReferenceModelBounds} from '../lib/modelArtworkGeometry';
import {disposeModelAsset} from '../lib/modelAssetResources';
import type {ReferenceModel} from '../domain/types';
import {useEditor} from '../state/editor';
import {fixedAnchor} from '../domain/measurements';
export function ReferenceModel3D({model}:{model:ReferenceModel}){
 const [asset,setAsset]=useState<LoadedCaptureModel>({dataUrl:'',boundsKey:'',scene:null,error:''});
 const boundsKey=captureModelBoundsKey(model),matches=captureModelMatches(model,asset),scene=matches?asset.scene:null,error=matches?asset.error:'';
 useEffect(()=>{
  let cancelled=false,loaded:Group[]|null=null;const identity={dataUrl:model.dataUrl,boundsKey};setAsset({...identity,scene:null,error:''});
  if(!model.visible)return;
  const bytes=Uint8Array.from(atob(model.dataUrl.split(',')[1]),c=>c.charCodeAt(0));
  try{inspectStaticArtworkGlb(bytes.buffer);}catch(e){setAsset({...identity,scene:null,error:e instanceof Error?e.message:'모델을 읽지 못했습니다.'});return;}
  void loadStaticModel(bytes.buffer).then(gltf=>{loaded=gltf.scenes;if(cancelled){disposeModelAsset(loaded);loaded=null;return;}checkReferenceModelBounds(gltf.scene,model);gltf.scene.traverse(object=>{if(object instanceof Mesh){object.castShadow=true;object.receiveShadow=true;}});setAsset({...identity,scene:gltf.scene,error:''});}).catch(e=>{if(loaded){disposeModelAsset(loaded);loaded=null;}if(!cancelled)setAsset({...identity,scene:null,error:e instanceof Error?e.message:'모델을 표시하지 못했습니다. GLB를 다시 내보내세요.'});});
  return()=>{cancelled=true;if(loaded){disposeModelAsset(loaded);loaded=null;}};
 },[model.dataUrl,model.visible,boundsKey]);

 function pick(e:ThreeEvent<PointerEvent>){
  e.stopPropagation();const state=useEditor.getState();if(state.activeTool!=='measure')return;
  const p=e.point;
  state.pickMeasurement(fixedAnchor({x:Math.round(p.x*1000),y:Math.round(p.y*1000),z:Math.round(p.z*1000)}),'3d');
 }
 if(!model.visible)return null;
 return <group name="capture-reference-model" userData={{captureModel:captureModelStatus(model,asset)}} position={model.positionMm.map(v=>v/1000) as [number,number,number]} rotation={[0,model.rotationDeg*Math.PI/180,0]} scale={model.scale} onPointerDown={pick}>
 {scene&&<primitive object={scene} position={model.sourceOffsetM}/>}
 {error&&<Html><span className="dimension-label">{error}</span></Html>}
 </group>;
}
