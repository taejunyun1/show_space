import {useMemo} from 'react';
import type {ThreeElements} from '@react-three/fiber';
import type {Object3D} from 'three';
import type {ModelArtwork} from '../domain/types';
import type {ReferenceModelPlacement} from '../domain/referenceModel';
import {modelArtworkPlacement} from '../lib/modelArtworkGeometry';

type Events=Pick<ThreeElements['group'],'onPointerDown'|'onPointerMove'|'onPointerOut'|'onClick'>;
/** Clone node transforms once per source, retaining the loader owner's shared
 * geometry/material/texture resources. Placement changes never clone the tree. */
export function StaticModelInstance3D({source}:{source:Object3D}){
 const instance=useMemo(()=>source.clone(true),[source]);
 return <primitive object={instance} dispose={null}/>;
}
export function ArtworkModelInstance3D({artwork,source,...events}:{artwork:ModelArtwork;source:Object3D}&Events){
 const pose=modelArtworkPlacement(artwork);
 return <group name={pose.name} position={pose.position} rotation={pose.rotation} userData={pose.userData} dispose={null} {...events}><group scale={pose.scale}><group position={pose.offset}><StaticModelInstance3D source={source}/></group></group></group>;
}
export function ReferenceModelInstance3D({model,source,...events}:{model:ReferenceModelPlacement;source:Object3D}&Events){
 return <group position={model.positionMm.map(v=>v/1000) as [number,number,number]} rotation={[0,model.rotationDeg*Math.PI/180,0]} scale={model.scale} dispose={null} {...events}><group position={model.sourceOffsetM}><StaticModelInstance3D source={source}/></group></group>;
}
