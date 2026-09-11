import type {WallCandidate} from './wallCandidates';
/** Trim small cap overruns to an actual crossing. Never extend a line or choose
 * among competing crossings. Original recognition evidence remains untouched. */
export function trimThinOverruns(input:WallCandidate[],longLength=Infinity):WallCandidate[]{
 return input.map(line=>{
  const result={...line,start:{...line.start},end:{...line.end}};
  const dx=line.end.x-line.start.x,dy=line.end.y-line.start.y,length=Math.hypot(dx,dy);
  if(length<30||(line.thicknessPx>=3&&length>=longLength))return result;
  const intersections:number[]=[];
  for(const other of input){
   if(other.id===line.id||other.thicknessPx<3)continue;
   const ox=other.end.x-other.start.x,oy=other.end.y-other.start.y,otherLength=Math.hypot(ox,oy),den=dx*oy-dy*ox;
   if(line.thicknessPx>=3&&otherLength<longLength)continue;
   if(!den||Math.abs(den)<.3*length*otherLength)continue;
   const px=other.start.x-line.start.x,py=other.start.y-line.start.y,t=(px*oy-py*ox)/den,u=(px*dy-py*dx)/den;
   if(t<0||t>1||u<0||u>1)continue;
   if(line.thicknessPx>=3&&Math.min(t,1-t)*length>Math.min(12,other.thicknessPx/2+3))continue;
   if(!intersections.some(existing=>Math.abs(existing-t)*length<.1))intersections.push(t);
  }
  const start=intersections.filter(t=>t*length<=12),end=intersections.filter(t=>(1-t)*length<=12);
  const point=(t:number)=>({x:line.start.x+dx*t,y:line.start.y+dy*t});
  if(start.length===1)result.start=point(start[0]);
  if(end.length===1)result.end=point(end[0]);
  return result;
 });
}
