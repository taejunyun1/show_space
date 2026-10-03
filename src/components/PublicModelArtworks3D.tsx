import {useMemo} from 'react';
import {Html,Line} from '@react-three/drei';
import type {ThreeEvent} from '@react-three/fiber';
import type {PublicModelArtwork} from '../domain/publicShare';
import {publicModelArtworkPose} from '../domain/publicModelArtwork';
import {modelArtworkCorners} from '../domain/modelArtworks';
import {placeModelArtwork} from '../lib/modelArtworkGeometry';
import {usePublicModelScene} from './usePublicModelScene';
function PublicModel({artwork:a,shareId,selected,onSelect,measuring,onMeasure}:{artwork:PublicModelArtwork;shareId:string;selected:boolean;onSelect:(id:string)=>void;measuring:boolean;onMeasure:(event:ThreeEvent<PointerEvent>)=>void}){
 const pose=useMemo(()=>publicModelArtworkPose(a),[a]),{source,error}=usePublicModelScene(shareId,a.modelId,a);
 const object=useMemo(()=>source?placeModelArtwork(pose,source):null,[pose,source]),corners=modelArtworkCorners(a),pairs=[[0,1],[0,2],[0,4],[1,3],[1,5],[2,3],[2,6],[3,7],[4,5],[4,6],[5,7],[6,7]];
 return <>{object&&<primitive object={object} dispose={null} onPointerDown={measuring?onMeasure:undefined} onClick={(event:ThreeEvent<MouseEvent>)=>{event.stopPropagation();if(!measuring)onSelect(a.id);}}/>} {selected&&pairs.map(([i,j],k)=><Line key={k} points={[corners[i],corners[j]].map(p=>[p.x/1000,p.y/1000,p.z/1000]) as [number,number,number][]} color="#365cf5" lineWidth={1.2}/>)}{error&&<Html position={[a.position.x/1000,a.position.y/1000,a.position.z/1000]} center><span className="shared-image-error" role="alert">{error}</span></Html>}</>;
}
export function PublicModelArtworks3D({artworks,shareId,selectedId,onSelect,measuring,onMeasure}:{artworks:PublicModelArtwork[];shareId:string;selectedId:string|null;onSelect:(id:string)=>void;measuring:boolean;onMeasure:(event:ThreeEvent<PointerEvent>)=>void}){return <>{artworks.map(a=><PublicModel key={a.id} artwork={a} shareId={shareId} selected={selectedId===a.id} onSelect={onSelect} measuring={measuring} onMeasure={onMeasure}/>)}</>;}
