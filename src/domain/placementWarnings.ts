import {Euler,Matrix3,Matrix4,Vector3} from 'three';
import {OBB} from 'three/addons/math/OBB.js';
import {artworkPosition,wallLength} from './model';
import {artworkPresentation} from './artworkPresentation';
import {modelArtworkBounds,modelArtworkMatrix} from './modelArtworks';
import type {EntitySelection,ModelArtwork,Project} from './types';
export interface PlacementWarning {code:'below-floor'|'wall-overlap'|'artwork-overlap'|'scale';message:string;targetIds?:string[]}
type Bound={id:string;name:string;type:EntitySelection['type'];box:OBB;minY:number;model?:ModelArtwork};
const toleranceMm=1;
function box(center:Vector3,size:Vector3,rotation:Matrix4){
 // Inset each box by half the contact tolerance. Touching surfaces are not penetration.
 const half=size.multiplyScalar(.5).subScalar(toleranceMm/2000).max(new Vector3());
 return new OBB(center,half,new Matrix3().setFromMatrix4(rotation));
}
function targets(items:Bound[]){return items.slice(0,3).map(a=>a.name).join(' · ')+(items.length>3?` 외 ${items.length-3}개`:'');}
/** Physical rotated bounds, without a physics engine or restrictive edit validation. */
export function placementWarningIndex(project:Project){
 if(project.planDraft&&!project.planReference?.calibrated)return {query:(_selection:EntitySelection):PlacementWarning[]=>[]};
 const walls:Bound[]=project.walls.filter(w=>w.visible).map(w=>({id:w.id,name:w.name,type:'wall',minY:0,box:box(new Vector3((w.start.x+w.end.x)/2000,w.heightMm/2000,(w.start.z+w.end.z)/2000),new Vector3(wallLength(w)/1000,w.heightMm/1000,w.thicknessMm/1000),new Matrix4().makeRotationY(-Math.atan2(w.end.z-w.start.z,w.end.x-w.start.x)))}));
 const artworks:Bound[]=[];
 for(const a of project.artworks){const wall=project.walls.find(w=>w.id===a.wallId&&w.visible);if(!a.visible||!wall)continue;const p=artworkPosition(a,wall),s=artworkPresentation(a),rotation=new Matrix4().makeRotationFromEuler(new Euler(0,p.rotationY,(a.rotationDeg??0)*Math.PI/180,'XYZ')),halfHeight=Math.abs(rotation.elements[1])*s.widthMm/2+Math.abs(rotation.elements[5])*s.heightMm/2+Math.abs(rotation.elements[9])*s.depthMm/2;artworks.push({id:a.id,name:a.name,type:'artwork',minY:p.y-halfHeight,box:box(new Vector3(p.x/1000,p.y/1000,p.z/1000),new Vector3(s.widthMm/1000,s.heightMm/1000,s.depthMm/1000),rotation)});}
 for(const a of project.modelArtworks??[]){if(!a.visible)continue;const matrix=modelArtworkMatrix(a),center=new Vector3(0,a.heightMm/2000,0).applyMatrix4(matrix),rotation=new Matrix4().extractRotation(matrix);artworks.push({id:a.id,name:a.name,type:'modelArtwork',model:a,minY:modelArtworkBounds(a).minY,box:box(center,new Vector3(a.widthMm/1000,a.heightMm/1000,a.depthMm/1000),rotation)});}
 const query=(selection:EntitySelection):PlacementWarning[]=>{
  const a=artworks.find(a=>a.type===selection.type&&a.id===selection.id);if(!a)return [];
  const warnings:PlacementWarning[]=[];
  if(a.minY < -toleranceMm)warnings.push({code:'below-floor',message:'작품이 기준 바닥(0mm) 아래로 내려갑니다.'});
  const wallHits=walls.filter(w=>a.box.intersectsOBB(w.box));if(wallHits.length)warnings.push({code:'wall-overlap',message:`작품 외곽 범위가 벽과 겹칩니다: ${targets(wallHits)}.`,targetIds:wallHits.map(w=>w.id)});
  const artHits=artworks.filter(b=>!(a.type===b.type&&a.id===b.id)&&a.box.intersectsOBB(b.box));if(artHits.length)warnings.push({code:'artwork-overlap',message:`작품 외곽 범위가 다른 작품과 겹칩니다: ${targets(artHits)}.`,targetIds:artHits.map(b=>b.id)});
  if(a.model){const m=a.model,ratios=[m.widthMm,m.heightMm,m.depthMm].map((n,i)=>n/m.model.sizeMm[i]);if(ratios.some(n=>n<.01||n>100)||Math.max(...ratios)/Math.min(...ratios)>100)warnings.push({code:'scale',message:'원본 크기 대비 변형이 큽니다. 단위와 W·H·D를 확인하세요.'});}
  return warnings;
 };
 return {query};
}
