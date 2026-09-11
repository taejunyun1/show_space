import type {WallCandidate} from './wallCandidates';
/** Snap a nearby endpoint to a unique intersection inside another stroke. This
 * preserves both line directions; topology splitting happens in the next stage. */
export function alignRasterJunctions(input:WallCandidate[]):WallCandidate[]{
 return input.map((a,i)=>{
  const result={...a,start:{...a.start},end:{...a.end}};
  if(a.thicknessPx<3)return result;
  const ax=a.end.x-a.start.x,ay=a.end.y-a.start.y,al=Math.hypot(ax,ay);
  for(const endpoint of ['start','end'] as const){
   const matches:{x:number;y:number}[]=[];
   for(let j=0;j<input.length;j++){
    const b=input[j];if(i===j||b.thicknessPx<3)continue;
    const bx=b.end.x-b.start.x,by=b.end.y-b.start.y,bl=Math.hypot(bx,by),den=ax*by-ay*bx;
    if(!den||Math.abs(den)<.2*al*bl)continue;
    const dx=b.start.x-a.start.x,dy=b.start.y-a.start.y,t=(dx*by-dy*bx)/den,u=(dx*ay-dy*ax)/den;
    if(u*bl<=4||(1-u)*bl<=4)continue;
    const point={x:a.start.x+t*ax,y:a.start.y+t*ay};
    if(Math.hypot(point.x-a[endpoint].x,point.y-a[endpoint].y)>Math.min(12,Math.max(4,b.thicknessPx/2+2)))continue;
    if(!matches.some(p=>Math.hypot(p.x-point.x,p.y-point.y)<.01))matches.push(point);
   }
   if(matches.length===1)result[endpoint]=matches[0];
  }
  return Math.hypot(result.end.x-result.start.x,result.end.y-result.start.y)<1?{...a,start:{...a.start},end:{...a.end}}:result;
 });
}
