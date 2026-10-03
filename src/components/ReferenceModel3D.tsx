import {useEffect,useState} from 'react';
import {type ThreeEvent} from '@react-three/fiber';
import {Html} from '@react-three/drei';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {Mesh,Texture,type Group} from 'three';
import type {ReferenceModel} from '../domain/types';
import {useEditor} from '../state/editor';
import {fixedAnchor} from '../domain/measurements';
export function ReferenceModel3D({model}:{model:ReferenceModel}){
 const [scene,setScene]=useState<Group|null>(null),[error,setError]=useState('');
 useEffect(()=>{
  let cancelled=false,loaded:Group|null=null;setScene(null);setError('');
  const bytes=Uint8Array.from(atob(model.dataUrl.split(',')[1]),c=>c.charCodeAt(0));
  function dispose(group:Group){group.traverse(object=>{if(object instanceof Mesh){object.geometry.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];for(const material of materials){for(const value of Object.values(material))if(value instanceof Texture)value.dispose();material.dispose();}}});}
  void new GLTFLoader().parseAsync(bytes.buffer,'').then(gltf=>{loaded=gltf.scene;if(cancelled){dispose(loaded);return;}loaded.traverse(object=>{if(object instanceof Mesh){object.castShadow=true;object.receiveShadow=true;}});setScene(loaded);}).catch(()=>{if(!cancelled)setError('모델을 표시하지 못했습니다. GLB를 다시 내보내세요.');});
  return()=>{cancelled=true;if(loaded)dispose(loaded);};
 },[model.dataUrl]);
 function pick(e:ThreeEvent<PointerEvent>){
  e.stopPropagation();const state=useEditor.getState();if(state.activeTool!=='measure')return;
  const p=e.point;
  state.pickMeasurement(fixedAnchor({x:Math.round(p.x*1000),y:Math.round(p.y*1000),z:Math.round(p.z*1000)}),'3d');
 }
 if(!model.visible)return null;
 return <group position={model.positionMm.map(v=>v/1000) as [number,number,number]} rotation={[0,model.rotationDeg*Math.PI/180,0]} scale={model.scale} onPointerDown={pick}>
 {scene&&<primitive object={scene} position={model.sourceOffsetM}/>}
 {error&&<Html><span className="dimension-label">{error}</span></Html>}
 </group>;
}
