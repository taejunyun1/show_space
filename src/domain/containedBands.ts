import type {WallCandidate} from './wallCandidates';
/** Drop a contained parallel fragment only when its complete intervening raster
 * band is solid. Preserve the longer observed stroke and its measured thickness. */
export function removeContainedSolidBands(lines:WallCandidate[],dark:Uint8Array,width:number,height:number):WallCandidate[]{
 const redundant=new Set<number>(),support=new Map<number,number>();
 const length=(l:WallCandidate)=>Math.hypot(l.end.x-l.start.x,l.end.y-l.start.y);
 const order=lines.map((_,i)=>i).sort((a,b)=>length(lines[b])-length(lines[a]));
 for(const i of order){
  if(redundant.has(i))continue;
  const long=lines[i],horizontal=long.start.y===long.end.y;
  if(!horizontal&&long.start.x!==long.end.x)continue;
  const along=(p:{x:number;y:number})=>horizontal?p.x:p.y,across=(p:{x:number;y:number})=>horizontal?p.y:p.x;
  const from=Math.min(along(long.start),along(long.end)),to=Math.max(along(long.start),along(long.end));
  for(const j of order){
   if(i===j||redundant.has(j))continue;
   const short=lines[j];if(Math.abs(across(long.start)-across(short.start))<=Math.max(long.thicknessPx,short.thicknessPx)/2)continue;
   if(Math.abs(across(short.start)-across(short.end))>.01)continue;
   const a=Math.min(along(short.start),along(short.end)),b=Math.max(along(short.start),along(short.end));
   if(b-a<30||b-a>=to-from-2||a<from||b>to)continue;
   const low=Math.min(across(long.start)-long.thicknessPx/2,across(short.start)-short.thicknessPx/2),high=Math.max(across(long.start)+long.thicknessPx/2,across(short.start)+short.thicknessPx/2);
   if(high-low>16)continue;
   let count=0,filled=0;
   for(let t=Math.ceil(a);t<Math.floor(b);t++)for(let c=Math.floor(low);c<Math.ceil(high);c++){
    const x=horizontal?t:c,y=horizontal?c:t;
    if(x<0||y<0||x>=width||y>=height)continue;
    count++;filled+=dark[y*width+x];
   }
   if(count&&filled/count>=.97){redundant.add(j);support.set(i,Math.max(support.get(i)??long.thicknessPx,short.solidSupportThicknessPx??short.thicknessPx));}
  }
 }
 return lines.flatMap((line,i)=>redundant.has(i)?[]:[support.has(i)?{...line,solidSupportThicknessPx:support.get(i)}:line]);
}
