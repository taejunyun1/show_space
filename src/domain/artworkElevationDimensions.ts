import {artworkFaceBounds} from './artworkPresentation';
import {wallLength} from './wallGeometry';
import type {Project,Wall} from './types';
import type {PresentedArtwork} from './artworkPresentation';
export type InstallationArtwork=PresentedArtwork&{id:string;wallId:string;wallSide?:'front'|'back';alongMm:number;centerHeightMm:number;visible?:boolean};
export interface InstallationDrawing {displayUnit?:Project['displayUnit'];walls:readonly Pick<Wall,'id'|'start'|'end'|'heightMm'>[];artworks:readonly InstallationArtwork[];planDraft?:Project['planDraft'];planReference?:Project['planReference']}
export const installationDimensionLabel=(d:ArtworkElevationDimension)=>d.kind==='gap'?`외곽 ${d.axis==='horizontal'?'가로':'세로'} 간격`:d.kind==='floor'?'바닥':d.kind==='left'?'벽 왼쪽':'벽 오른쪽';
export interface ArtworkElevationDimension {key:string;axis:'horizontal'|'vertical';kind:'gap'|'floor'|'left'|'right';distanceMm:number;start:{x:number;y:number};end:{x:number;y:number};artworkIds:string[]}
/** Axis gaps between rotated outer bounds; never claim a shortest distance between diagonal artworks. */
export function artworkElevationDimensions(project:InstallationDrawing,wallId:string,side:'front'|'back',selectedIds:readonly string[]):ArtworkElevationDimension[]{
 const wall=project.walls.find(w=>w.id===wallId);if(!wall||project.planDraft&&!project.planReference?.calibrated)return [];
 const selected=new Set(selectedIds),arts=project.artworks.filter(a=>a.visible!==false&&a.wallId===wallId&&(a.wallSide??'front')===side).map(a=>({id:a.id,...artworkFaceBounds(a)})),chosen=arts.filter(a=>selected.has(a.id)),result=new Map<string,ArtworkElevationDimension>();
 for(const a of chosen)for(const direction of ['left','right','bottom','top'] as const){
  const horizontal=direction==='left'||direction==='right',forward=direction==='right'||direction==='top';
  let nearest:{b:typeof a;gap:number;low:number;high:number}|undefined;
  for(const b of arts){if(a.id===b.id)continue;const low=horizontal?Math.max(a.bottom,b.bottom):Math.max(a.left,b.left),high=horizontal?Math.min(a.top,b.top):Math.min(a.right,b.right);if(high<=low)continue;
   const gap=horizontal?(forward?b.left-a.right:a.left-b.right):(forward?b.bottom-a.top:a.bottom-b.top);if(gap<0)continue;
   if(!nearest||gap<nearest.gap)nearest={b,gap,low,high};
  }
  if(nearest){const {b,gap,low,high}=nearest,key=JSON.stringify([[a.id,b.id].sort(),horizontal?'h':'v']),cross=(low+high)/2;
   const start=horizontal?{x:forward?a.right:b.right,y:cross}:{x:cross,y:forward?a.top:b.top};
   const end=horizontal?{x:forward?b.left:a.left,y:cross}:{x:cross,y:forward?b.bottom:a.bottom};
   result.set(key,{key,axis:horizontal?'horizontal':'vertical',kind:'gap',distanceMm:gap,start,end,artworkIds:[a.id,b.id].sort()});
  }
 }
 if(chosen.length===1){const a=chosen[0],width=wallLength(wall);
  if(a.bottom>=0)result.set('floor',{key:'floor',axis:'vertical',kind:'floor',distanceMm:a.bottom,start:{x:a.cx,y:0},end:{x:a.cx,y:a.bottom},artworkIds:[a.id]});
  const edges=side==='back'?[{kind:'left' as const,from:a.right,to:width},{kind:'right' as const,from:0,to:a.left}]:[{kind:'left' as const,from:0,to:a.left},{kind:'right' as const,from:a.right,to:width}];
  for(const e of edges)if(e.to>=e.from)result.set(e.kind,{key:e.kind,axis:'horizontal',kind:e.kind,distanceMm:e.to-e.from,start:{x:e.from,y:0},end:{x:e.to,y:0},artworkIds:[a.id]});
 }
 return [...result.values()];
}
