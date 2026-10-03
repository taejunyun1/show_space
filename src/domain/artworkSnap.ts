import {artworkGroupMembers} from './artworkGroups';
import {artworkFaceBounds} from './artworkPresentation';
export {artworkFaceBounds} from './artworkPresentation';
import {wallLength} from './model';
import type {Project} from './types';
import type {ArtworkFacePoint} from './artworkDrag3d';
export interface ArtworkSnapGuide {axis:'along'|'height';atMm:number;kind:'edge'|'center'|'wall';targetId?:string}
export interface ArtworkSnapOptions {toleranceMm:{alongMm:number;centerHeightMm:number};bypass?:boolean}
const EPS=1e-6;
/** Apply a rigid group translation, then acquire wall/artwork anchors within a screen-derived radius. */
export function snapArtworkPlacement(project:Project,id:string,wallId:string,wallSide:'front'|'back',point:ArtworkFacePoint,options:ArtworkSnapOptions={toleranceMm:{alongMm:0,centerHeightMm:0}}){
 const artwork=project.artworks.find(a=>a.id===id),wall=project.walls.find(w=>w.id===wallId);
 if(!artwork||!wall)throw new Error('작품이나 설치 벽을 찾을 수 없습니다.');
 if(project.planDraft&&!project.planReference?.calibrated)throw new Error('도면 축척을 먼저 보정해 주세요.');
 if(![point.alongMm,point.centerHeightMm,options.toleranceMm.alongMm,options.toleranceMm.centerHeightMm].every(Number.isFinite)||options.toleranceMm.alongMm<0||options.toleranceMm.centerHeightMm<0)throw new Error('작품 이동 좌표가 올바르지 않습니다.');
 const members=artworkGroupMembers(project,id);if(members.some(a=>a.locked))throw new Error('잠긴 작품은 이동할 수 없습니다.');
 const bounds=members.map(artworkFaceBounds),ids=new Set(members.map(a=>a.id));
 const limits={along:[-Math.min(...bounds.map(b=>b.left)),wallLength(wall)-Math.max(...bounds.map(b=>b.right))],height:[-Math.min(...bounds.map(b=>b.bottom)),wall.heightMm-Math.max(...bounds.map(b=>b.top))]};
 if(limits.along[0]>limits.along[1]||limits.height[0]>limits.height[1])throw new Error('작품 또는 그룹이 이 벽보다 큽니다.');
 const width=wallLength(wall),height=wall.heightMm,originX=artwork.alongMm,originY=artwork.centerHeightMm;
 const targets=project.artworks.filter(a=>!ids.has(a.id)&&a.visible&&a.wallId===wallId&&(a.wallSide??'front')===wallSide).sort((a,b)=>a.id.localeCompare(b.id));
 const guides:ArtworkSnapGuide[]=[];
 const clamp=(value:number,range:number[])=>Math.max(range[0],Math.min(range[1],value));
 function axisDelta(axis:'along'|'height',raw:number,tolerance:number){
  const range=limits[axis],delta=clamp(raw,range);
  if(options.bypass)return delta;
  const horizontal=axis==='along';
  const anchors=(b:ReturnType<typeof artworkFaceBounds>)=>horizontal?[{at:b.left,kind:'edge' as const},{at:b.cx,kind:'center' as const},{at:b.right,kind:'edge' as const}]:[{at:b.bottom,kind:'edge' as const},{at:b.cy,kind:'center' as const},{at:b.top,kind:'edge' as const}];
  const stationary=targets.flatMap(a=>anchors(artworkFaceBounds(a)).map(anchor=>({...anchor,targetId:a.id})));
  const wallSpan=horizontal?width:height;
  const destinations=[...stationary,...[{at:0,kind:'edge' as const},{at:wallSpan/2,kind:'center' as const},{at:wallSpan,kind:'edge' as const}].map(a=>({...a,targetId:undefined}))];
  let best:{delta:number;distance:number;guide:ArtworkSnapGuide}|undefined;
  for(const b of bounds)for(const moving of anchors(b))for(const target of destinations){
   if(moving.kind!==target.kind)continue;
   const next=target.at-moving.at,distance=Math.abs(next-delta);
   if(distance>tolerance+EPS||next<range[0]-EPS||next>range[1]+EPS)continue;
   if(!best||distance<best.distance-EPS)best={delta:clamp(next,range),distance,guide:{axis,atMm:target.at,kind:target.targetId?target.kind:'wall',...(target.targetId?{targetId:target.targetId}:{})}};
  }
  if(best){guides.push(best.guide);return best.delta;}
  const origin=horizontal?originX:originY;
  return clamp(Math.round((origin+delta)/10)*10-origin,range);
 }
 const dx=axisDelta('along',point.alongMm-artwork.alongMm,options.toleranceMm.alongMm),dy=axisDelta('height',point.centerHeightMm-artwork.centerHeightMm,options.toleranceMm.centerHeightMm);
 return {placement:{alongMm:artwork.alongMm+dx,centerHeightMm:artwork.centerHeightMm+dy},guides};
}
