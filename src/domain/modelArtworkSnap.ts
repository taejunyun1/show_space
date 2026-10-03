import {modelArtworkBounds,modelArtworkCorners,transformModelArtworks} from './modelArtworks';
import type {Project,WorldPoint} from './types';
export type ModelSnapAxis='x'|'y'|'z';
export interface ModelArtworkSnapGuide {kind:'edge'|'center'|'wall'|'floor';targetId?:string;normal:WorldPoint;constantMm:number;point:WorldPoint}
export interface ModelArtworkSnapOptions {toleranceMm:WorldPoint;axes?:readonly ModelSnapAxis[];direction?:WorldPoint;directionToleranceMm?:number;bypass?:boolean}
const axes=['x','y','z'] as const,EPS=1e-6,unit=(axis:ModelSnapAxis):WorldPoint=>({x:axis==='x'?1:0,y:axis==='y'?1:0,z:axis==='z'?1:0});
const dot=(a:WorldPoint,b:WorldPoint)=>a.x*b.x+a.y*b.y+a.z*b.z;
const plus=(a:WorldPoint,b:WorldPoint):WorldPoint=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const multiply=(p:WorldPoint,s:number):WorldPoint=>({x:p.x*s,y:p.y*s,z:p.z*s});
const center=(a:ReturnType<typeof modelArtworkBounds>):WorldPoint=>({x:(a.minX+a.maxX)/2,y:(a.minY+a.maxY)/2,z:(a.minZ+a.maxZ)/2});
function anchors(a:ReturnType<typeof modelArtworkBounds>,axis:ModelSnapAxis){const low=a[`min${axis.toUpperCase() as 'X'|'Y'|'Z'}`],high=a[`max${axis.toUpperCase() as 'X'|'Y'|'Z'}`];return [{at:low,kind:'edge' as const},{at:(low+high)/2,kind:'center' as const},{at:high,kind:'edge' as const}];}
/** Translate rotated model bounds; wall contacts use the actual eight corners and finite wall faces. */
export function snapModelArtworkTransform(base:Project,ids:readonly string[],id:string,position:WorldPoint,rotation:WorldPoint,options:ModelArtworkSnapOptions){
 if(base.planDraft&&!base.planReference?.calibrated)throw new Error('3D 작품을 배치하려면 도면 축척을 먼저 보정하세요.');
 if(!axes.every(a=>Number.isFinite(options.toleranceMm[a])&&options.toleranceMm[a]>=0))throw new Error('3D 작품 스냅 범위가 올바르지 않습니다.');
 const selected=new Set(ids),raw=transformModelArtworks(base,[...selected],id,position,rotation),moving=raw.modelArtworks!.filter(a=>selected.has(a.id));
 if(moving.length!==selected.size)throw new Error('이동할 3D 작품을 찾을 수 없습니다.');
 if(options.bypass)return {project:raw,guides:[] as ModelArtworkSnapGuide[]};
 const allowed=options.axes??axes;if(allowed.some(a=>!axes.includes(a)))throw new Error('3D 이동 축이 올바르지 않습니다.');
 let direction:WorldPoint|undefined;
 if(options.direction){const length=Math.hypot(options.direction.x,options.direction.y,options.direction.z);if(!Number.isFinite(length)||length<EPS||!Number.isFinite(options.directionToleranceMm)||(options.directionToleranceMm??-1)<0)throw new Error('3D 이동 방향이 올바르지 않습니다.');direction=multiply(options.direction,1/length);}
 const bounds=moving.map(a=>({a,b:modelArtworkBounds(a),corners:modelArtworkCorners(a)}));
 const stationary=(base.modelArtworks??[]).filter(a=>a.visible&&!selected.has(a.id)).sort((a,b)=>a.id.localeCompare(b.id)).map(a=>({a,b:modelArtworkBounds(a)}));
 type Candidate={delta:WorldPoint;score:number;guide:ModelArtworkSnapGuide};
 const independent=new Map<ModelSnapAxis,Candidate>();let directional:Candidate|undefined,wallChoice:Candidate|undefined;
 function candidate(normal:WorldPoint,constantMm:number,source:WorldPoint,kind:ModelArtworkSnapGuide['kind'],targetId?:string){
  const difference=constantMm-dot(normal,source);
  const guide={normal,constantMm,point:source,kind,...(targetId?{targetId}:{})};
  if(direction){const denominator=dot(normal,direction);if(Math.abs(denominator)<EPS)return;const distance=difference/denominator,tolerance=options.directionToleranceMm!;if(Math.abs(distance)>tolerance+EPS)return;const delta=multiply(direction,distance),score=tolerance?Math.abs(distance)/tolerance:0;if(!directional||score<directional.score-EPS)directional={delta,score,guide};return;}
  const usable=allowed.filter(a=>Math.abs(normal[a])>EPS&&options.toleranceMm[a]>0),denominator=usable.reduce((s,a)=>s+normal[a]**2,0);if(denominator<EPS)return;
  const delta={x:0,y:0,z:0};for(const a of usable)delta[a]=normal[a]*difference/denominator;
  const score=Math.hypot(...usable.map(a=>delta[a]/options.toleranceMm[a]));if(score>1+EPS)return;
  const next={delta,score,guide};
  if(usable.length===1){const axis=usable[0],before=independent.get(axis);if(!before||score<before.score-EPS)independent.set(axis,next);}
  else if(!wallChoice||score<wallChoice.score-EPS)wallChoice=next;
 }
 for(const {b} of bounds)for(const axis of allowed){
  const normal=unit(axis),origin=center(b);
  for(const source of anchors(b,axis))for(const {a:target,b:box} of stationary)for(const targetAnchor of anchors(box,axis))if(source.kind===targetAnchor.kind)candidate(normal,targetAnchor.at,{...origin,[axis]:source.at},source.kind,target.id);
 }
 if(allowed.includes('y')||direction&&Math.abs(direction.y)>EPS){const low=bounds.reduce((best,item)=>item.b.minY<best.b.minY?item:best),p=center(low.b);candidate(unit('y'),0,{...p,y:low.b.minY},'floor');}
 for(const wall of base.walls.filter(w=>w.visible).sort((a,b)=>a.id.localeCompare(b.id))){
  const dx=wall.end.x-wall.start.x,dz=wall.end.z-wall.start.z,length=Math.hypot(dx,dz);if(length<EPS)continue;
  const tangent={x:dx/length,y:0,z:dz/length},normal={x:-dz/length,y:0,z:dx/length},origin={...wall.start,y:0},constant=dot(origin,normal);
  for(const item of bounds){
   const along=item.corners.map(p=>dot({x:p.x-origin.x,y:0,z:p.z-origin.z},tangent));
   if(Math.max(...along)<0||Math.min(...along)>length||item.b.maxY<0||item.b.minY>wall.heightMm)continue;
   const sorted=[...item.corners].sort((a,b)=>dot(a,normal)-dot(b,normal));
   for(const source of [sorted[0],sorted.at(-1)!])for(const face of [-1,1])candidate(normal,constant+face*wall.thicknessMm/2,source,'wall',wall.id);
  }
 }
 let correction:WorldPoint={x:0,y:0,z:0},guides:ModelArtworkSnapGuide[]=[];
 if(direction){
  if(directional){correction=directional.delta;guides=[directional.guide];}
  else {const pivot=base.modelArtworks!.find(a=>a.id===id)!,delta={x:position.x-pivot.position.x,y:position.y-pivot.position.y,z:position.z-pivot.position.z},distance=dot(delta,direction);correction=multiply(direction,Math.round(distance/10)*10-distance);}
 }else{
  for(const axis of allowed){const found=independent.get(axis);correction[axis]=found?.delta[axis]??Math.round(position[axis]/10)*10-position[axis];if(found)guides.push(found.guide);}
  if(wallChoice){const affected=allowed.filter(a=>Math.abs(wallChoice!.guide.normal[a])>EPS),comparison=Math.max(...affected.map(a=>independent.get(a)?.score??1));if(wallChoice.score<comparison-EPS){for(const a of affected)correction[a]=wallChoice.delta[a];guides=guides.filter(g=>!affected.some(a=>Math.abs(g.normal[a])>EPS));guides.push(wallChoice.guide);}}
 }
 const project={...raw,modelArtworks:raw.modelArtworks!.map(a=>selected.has(a.id)?{...a,position:plus(a.position,correction)}:a)};
 // Update guide anchor positions for additional independent-axis corrections.
 guides=guides.map(g=>{const normalLength=dot(g.normal,g.normal),p=plus(g.point,correction),offset=(g.constantMm-dot(g.normal,p))/normalLength;return {...g,point:plus(p,multiply(g.normal,offset))};});
 return {project,guides};
}
