import {artworkFaceBounds} from './artworkSnap';
import {wallLength} from './model';
import type {Project} from './types';
export interface ArtworkElevationDimension {key:string;axis:'horizontal'|'vertical';kind:'gap'|'floor'|'left'|'right';distanceMm:number;start:{x:number;y:number};end:{x:number;y:number}}
/** Axis gaps between rotated outer bounds; never claim a shortest distance between diagonal artworks. */
export function artworkElevationDimensions(project:Project,wallId:string,side:'front'|'back',selectedIds:readonly string[]):ArtworkElevationDimension[]{
 const wall=project.walls.find(w=>w.id===wallId);if(!wall||project.planDraft&&!project.planReference?.calibrated)return [];
 const selected=new Set(selectedIds),arts=project.artworks.filter(a=>a.visible&&a.wallId===wallId&&(a.wallSide??'front')===side).map(a=>({id:a.id,...artworkFaceBounds(a)})),chosen=arts.filter(a=>selected.has(a.id)),result=new Map<string,ArtworkElevationDimension>();
 for(const a of chosen)for(const direction of ['left','right','bottom','top'] as const){
  const horizontal=direction==='left'||direction==='right',forward=direction==='right'||direction==='top';
  let nearest:{b:typeof a;gap:number;low:number;high:number}|undefined;
  for(const b of arts){if(a.id===b.id)continue;const low=horizontal?Math.max(a.bottom,b.bottom):Math.max(a.left,b.left),high=horizontal?Math.min(a.top,b.top):Math.min(a.right,b.right);if(high<=low)continue;
   const gap=horizontal?(forward?b.left-a.right:a.left-b.right):(forward?b.bottom-a.top:a.bottom-b.top);if(gap<0)continue;
   if(!nearest||gap<nearest.gap)nearest={b,gap,low,high};
  }
  if(nearest){const {b,gap,low,high}=nearest,key=[a.id,b.id].sort().join(':')+':'+(horizontal?'h':'v'),cross=(low+high)/2;
   const start=horizontal?{x:forward?a.right:b.right,y:cross}:{x:cross,y:forward?a.top:b.top};
   const end=horizontal?{x:forward?b.left:a.left,y:cross}:{x:cross,y:forward?b.bottom:a.bottom};
   result.set(key,{key,axis:horizontal?'horizontal':'vertical',kind:'gap',distanceMm:gap,start,end});
  }
 }
 if(chosen.length===1){const a=chosen[0],width=wallLength(wall);
  if(a.bottom>=0)result.set('floor',{key:'floor',axis:'vertical',kind:'floor',distanceMm:a.bottom,start:{x:a.cx,y:0},end:{x:a.cx,y:a.bottom}});
  const edges=side==='back'?[{kind:'left' as const,from:a.right,to:width},{kind:'right' as const,from:0,to:a.left}]:[{kind:'left' as const,from:0,to:a.left},{kind:'right' as const,from:a.right,to:width}];
  for(const e of edges)if(e.to>=e.from)result.set(e.kind,{key:e.kind,axis:'horizontal',kind:e.kind,distanceMm:e.to-e.from,start:{x:e.from,y:0},end:{x:e.to,y:0}});
 }
 return [...result.values()];
}
