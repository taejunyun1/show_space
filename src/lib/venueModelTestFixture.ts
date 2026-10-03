import {artworkTestGltf} from './modelArtworkTestFixture';
import {packEmbeddedGltf,modelDataUrl} from './artworkModelPayload';
import type {ReferenceModel} from '../domain/types';
/** Synthetic full venue: a real courtyard hole, entrance gap, partition, four steps and equipment. */
export function venueTestGlb(){
 const {doc}=artworkTestGltf();
 const nodes:Array<{mesh?:number;translation:number[];scale?:number[];children?:number[]}>=[];
 function box(mesh:number,translation:number[],scale:number[]){nodes.push({mesh,translation,scale});}
 // Four floor tiles leave the central 2m x 2m courtyard open; no bounding floor proxy.
 box(1,[-3.5,.05,0],[5,.1,8]);box(1,[3.5,.05,0],[5,.1,8]);box(1,[0,.05,-2.5],[2,.1,3]);box(1,[0,.05,2.5],[2,.1,3]);
 box(0,[0,1.5,-3.9],[12,3,.2]);box(0,[-5.9,1.5,0],[.2,3,8]);box(0,[5.9,1.5,0],[.2,3,8]);
 // Split front boundary leaves a 2m entrance.
 box(0,[-3.5,1.5,3.9],[5,3,.2]);box(0,[3.5,1.5,3.9],[5,3,.2]);box(0,[-3.4,1.5,-1.4],[4,3,.15]);
 for(let i=0;i<4;i++)box(2,[3,(i+1)*.15/2,-.9+i*.9],[1.2,(i+1)*.15,.9]);
 box(3,[-5.6,2.4,1.5],[.4,.5,1]);
 const root=nodes.length;nodes.push({translation:[10,2,5],children:Array.from({length:root},(_,i)=>i)});
 const materials=[{pbrMetallicRoughness:{baseColorFactor:[.88,.89,.9,1],metallicFactor:0,roughnessFactor:.85}},{pbrMetallicRoughness:{baseColorFactor:[.54,.42,.3,1],metallicFactor:0,roughnessFactor:.9}},{pbrMetallicRoughness:{baseColorFactor:[.05,.32,.25,1],metallicFactor:.1,roughnessFactor:.6}},{pbrMetallicRoughness:{baseColorFactor:[.9,.25,.06,1],metallicFactor:.1,roughnessFactor:.5}}];
 const meshes=materials.map((_,material)=>({primitives:doc.meshes[0].primitives.map(p=>({...p,material}))}));
 return packEmbeddedGltf({...doc,nodes,meshes,materials,scenes:[{nodes:[root]}]});
}
export function testVenueModel():ReferenceModel{return {name:'synthetic-whole-venue.glb',dataUrl:modelDataUrl(venueTestGlb()),sizeMm:[12000,3000,8000],sourceOffsetM:[-10,-2,-5],positionMm:[0,0,0],rotationDeg:0,scale:1,visible:true};}
