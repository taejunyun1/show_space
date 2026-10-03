import {useMemo} from 'react';
import {Html,Line} from '@react-three/drei';
import type {ThreeEvent} from '@react-three/fiber';
import type {PublicReferenceModel} from '../domain/publicShare';
import {referenceModelCorners} from '../domain/referenceModel';
import {placeReferenceModel} from '../lib/modelArtworkGeometry';
import {usePublicModelScene} from './usePublicModelScene';
export function PublicReferenceModel3D({model,shareId,selected,onSelect,measuring,onMeasure}:{model:PublicReferenceModel;shareId:string;selected:boolean;onSelect:()=>void;measuring:boolean;onMeasure:(event:ThreeEvent<PointerEvent>)=>void}){
 const {source,error}=usePublicModelScene(shareId,model.modelId,model,true),object=useMemo(()=>source?placeReferenceModel(model,source):null,[model,source]),corners=referenceModelCorners(model),pairs=[[0,1],[0,2],[0,4],[1,3],[1,5],[2,3],[2,6],[3,7],[4,5],[4,6],[5,7],[6,7]];
 return <>{object&&<primitive object={object} dispose={null} onPointerDown={measuring?onMeasure:undefined} onClick={(event:ThreeEvent<MouseEvent>)=>{event.stopPropagation();if(!measuring)onSelect();}}/>}{selected&&pairs.map(([i,j],k)=><Line key={k} points={[corners[i],corners[j]].map(p=>[p.x/1000,p.y/1000,p.z/1000]) as [number,number,number][]} color="#365cf5" lineWidth={1.2}/>)}{error&&<Html position={model.positionMm.map(v=>v/1000) as [number,number,number]} center><span className="shared-image-error" role="alert">{error}</span></Html>}</>;
}
