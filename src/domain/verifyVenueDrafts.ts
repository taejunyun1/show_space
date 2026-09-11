import {installationZones} from './installationZones';
import {openingSegments} from './openings';
import type {Project} from './types';
/** Independent raster passes must agree on topology, geometry and real-world scale. */
export function venueDraftsAgree(a:Project,b:Project):boolean{
 const ar=a.planReference,br=b.planReference;
 if(!ar||!br||a.walls.length!==b.walls.length||Math.abs(ar.mmPerPixel/br.mmPerPixel-1)>.02)return false;
 const remaining=new Set(b.walls.map((_,i)=>i));
 const tolerance=4*Math.max(ar.mmPerPixel,br.mmPerPixel);
 const near=(p:{x:number;z:number},q:{x:number;z:number})=>Math.hypot(p.x-q.x,p.z-q.z)<=tolerance;
 for(const wall of a.walls){
  const match=[...remaining].find(i=>{const other=b.walls[i];return wall.role===other.role&&Math.abs(wall.heightMm-other.heightMm)<1&&Math.abs(wall.thicknessMm-other.thicknessMm)<1&&((near(wall.start,other.start)&&near(wall.end,other.end))||(near(wall.start,other.end)&&near(wall.end,other.start)));});
  if(match===undefined)return false;remaining.delete(match);
 }
 const ao=openingSegments(a),bo=openingSegments(b);
 if(ao.length!==bo.length)return false;
 const unused=new Set(bo.map((_,i)=>i));
 for(const o of ao){const match=[...unused].find(i=>o.kind===bo[i].kind&&o.role===bo[i].role&&((near(o.start,bo[i].start)&&near(o.end,bo[i].end))||(near(o.start,bo[i].end)&&near(o.end,bo[i].start))));if(match===undefined)return false;unused.delete(match);}
 const az=installationZones(a),bz=installationZones(b);if(az.length!==bz.length)return false;
 const unpaired=new Set(bz.map((_,i)=>i));
 for(const zone of az){const i=[...unpaired].find(i=>near(zone,bz[i])&&Math.abs(zone.width-bz[i].width)<=tolerance&&Math.abs(zone.depth-bz[i].depth)<=tolerance);if(i===undefined)return false;unpaired.delete(i);}
 return true;
}
