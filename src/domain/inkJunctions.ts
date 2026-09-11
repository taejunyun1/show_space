import type {WallCandidate} from './wallCandidates';
/** Recover small axis junctions only when every intervening center pixel is ink.
 * A nearby endpoint alone is never evidence for bridging an opening. */
export function recoverInkJunctions(lines:WallCandidate[],dark:Uint8Array,width:number,height:number):WallCandidate[]{
 return lines.map(line=>{
  const horizontal=line.start.y===line.end.y,vertical=line.start.x===line.end.x;
  if(!horizontal&&!vertical)return line;
  const axis=horizontal?'x':'y',cross=horizontal?'y':'x';
  const result=structuredClone(line);
  for(const endpoint of ['start','end'] as const){
   const p=line[endpoint],opposite=line[endpoint==='start'?'end':'start'];
   const direction=Math.sign(p[axis]-opposite[axis]);
   const candidates=lines.flatMap(other=>{
    if(other.id===line.id||other.start[axis]!==other.end[axis]||Math.abs(other.end[cross]-other.start[cross])<30)return [];
    const target=other.start[axis],distance=(target-p[axis])*direction;
    if(distance<=.01||distance>6||p[cross]<Math.min(other.start[cross],other.end[cross])||p[cross]>Math.max(other.start[cross],other.end[cross]))return [];
    // Include the source endpoint and the target stripe center. One light pixel
    // vetoes the extension, including a narrow real doorway or broken stroke.
    const steps=Math.ceil(distance*4);
    for(let step=0;step<=steps;step++){
     const t=p[axis]+(target-p[axis])*step/steps;
     const x=Math.floor(horizontal?t:p.x),y=Math.floor(horizontal?p.y:t);
     if(x<0||y<0||x>=width||y>=height||dark[y*width+x]!==1)return [];
    }
    return [target];
   });
   const targets=[...new Set(candidates)];
   if(targets.length===1)result[endpoint][axis]=targets[0];
  }
  return result;
 });
}
