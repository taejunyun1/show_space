import type {WallCandidate} from './wallCandidates';
/** Geometry locates small text-search crops; it does not classify the object. */
export function shapeLabelRegions(lines:WallCandidate[],width:number,height:number){
 const v=lines.filter(l=>Math.abs(l.start.x-l.end.x)<1),h=lines.filter(l=>Math.abs(l.start.y-l.end.y)<1);
 const regions:{x:number;y:number;width:number;height:number;rotations:(0|90|180|270)[]}[]=[];
 for(const a of v)for(const b of v){
  const x=a.start.x,x2=b.start.x,y=Math.min(a.start.y,a.end.y),y2=Math.max(a.start.y,a.end.y),w=x2-x,d=y2-y;
  if(w<20||d<20||Math.max(w,d)<60||Math.max(w,d)/Math.min(w,d)<2.5||Math.max(w,d)>Math.max(width,height)*.4||x<0||y<0||x2>width||y2>height)continue;
  if(Math.abs(Math.min(b.start.y,b.end.y)-y)>4||Math.abs(Math.max(b.start.y,b.end.y)-y2)>4)continue;
  const side=(at:number)=>h.filter(l=>Math.abs(l.start.y-at)<=4&&Math.min(l.start.x,l.end.x)<=x+4&&Math.max(l.start.x,l.end.x)>=x2-4);
  const top=side(y),bottom=side(y2);if(top.length!==1||bottom.length!==1||top[0].id===bottom[0].id)continue;
  const ix=Math.max(6,Math.max(a.thicknessPx,b.thicknessPx)/2+3),iy=Math.max(6,Math.max(top[0].thicknessPx,bottom[0].thicknessPx)/2+3);
  if(w-2*ix<12||d-2*iy<12)continue;
  const crop={x:x+ix,y:y+iy,width:w-2*ix,height:d-2*iy,rotations:(d>w?[90,270]:[0,180]) as (0|90|180|270)[]};
  if(!regions.some(r=>Math.abs(r.x-crop.x)<4&&Math.abs(r.y-crop.y)<4&&Math.abs(r.width-crop.width)<4&&Math.abs(r.height-crop.height)<4))regions.push(crop);
 }
 return regions.sort((a,b)=>b.width*b.height-a.width*a.height).slice(0,6);
}
