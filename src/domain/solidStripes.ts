import type {WallCandidate} from './wallCandidates';
/** Merge fragmented runs only when the raster proves the band between them is solid. */
export function mergeSolidStripes(input:WallCandidate[],dark:Uint8Array,width:number,height:number):WallCandidate[]{
 const result=input.map(l=>({...l,start:{...l.start},end:{...l.end}}));
 for(let i=0;i<result.length;i++){
  const a=result[i],horizontal=a.start.y===a.end.y;
  const along=(p:{x:number;y:number})=>horizontal?p.x:p.y,across=(p:{x:number;y:number})=>horizontal?p.y:p.x;
  for(let j=i+1;j<result.length;j++){
   const b=result[j];if((b.start.y===b.end.y)!==horizontal)continue;
   const low=Math.min(across(a.start)-a.thicknessPx/2,across(b.start)-b.thicknessPx/2),high=Math.max(across(a.start)+a.thicknessPx/2,across(b.start)+b.thicknessPx/2);
   if(high-low>16||Math.abs(across(a.start)-across(b.start))<.1)continue;
   const a0=along(a.start),a1=along(a.end),b0=along(b.start),b1=along(b.end),from=Math.max(a0,b0),to=Math.min(a1,b1);
   if(to-from<.9*Math.max(a1-a0,b1-b0)||Math.abs(a0-b0)>high-low+2||Math.abs(a1-b1)>high-low+2)continue;
   let count=0,filled=0;
   const step=Math.max(1,Math.floor((to-from)/80));
   for(let x=Math.ceil(from);x<Math.floor(to);x+=step)for(let y=Math.floor(low);y<Math.ceil(high);y++){
    const px=horizontal?x:y,py=horizontal?y:x;if(px<0||py<0||px>=width||py>=height)continue;
    count++;filled+=dark[py*width+px];
   }
   if(!count||filled/count<.97)continue;
   const point=(n:number)=>horizontal?{x:n,y:(low+high)/2}:{x:(low+high)/2,y:n};
   a.start=point(Math.min(a0,b0));a.end=point(Math.max(a1,b1));a.thicknessPx=high-low;
   a.id=`solid:${horizontal?'h':'v'}:${a.start.x.toFixed(2)}:${a.start.y.toFixed(2)}:${a.end.x.toFixed(2)}:${a.end.y.toFixed(2)}`;
   result.splice(j--,1);
  }
 }
 return result;
}
