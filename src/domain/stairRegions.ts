import type {PlanLabel} from './planLabels';
import type {WallCandidate} from './wallCandidates';
export interface StairRegion {id:string;kind:'stairs';box:{x:number;y:number;width:number;height:number};labelId:string;lineIds:string[]}
/** Footprint bounds come from repeated treads, never the annotation rectangle. */
export function detectStairRegions(labels:PlanLabel[],lines:WallCandidate[]):StairRegion[]{
 const result:StairRegion[]=[];
 for(const label of labels){
  if(label.kind!=='stairs'||label.status==='dismissed'||(label.source==='ocr'&&(label.confidence??0)<90))continue;
  const proposals:StairRegion[]=[];
  for(const seed of lines){
   const horizontal=Math.abs(seed.start.y-seed.end.y)<1,along=(p:{x:number;y:number})=>horizontal?p.x:p.y,across=(p:{x:number;y:number})=>horizontal?p.y:p.x;
   if(!horizontal&&Math.abs(seed.start.x-seed.end.x)>=1)continue;
   const from=Math.min(along(seed.start),along(seed.end)),to=Math.max(along(seed.start),along(seed.end)),length=to-from;
   if(length<30)continue;
   const tolerance=Math.max(4,length*.08);
   const family=lines.filter(l=>Math.abs(across(l.start)-across(l.end))<1&&Math.abs(Math.min(along(l.start),along(l.end))-from)<=tolerance&&Math.abs(Math.max(along(l.start),along(l.end))-to)<=tolerance).sort((a,b)=>across(a.start)-across(b.start)).filter((l,i,all)=>!i||across(l.start)-across(all[i-1].start)>3);
   if(family.length<3||family.length>30)continue;
   const spaces=family.slice(1).map((l,i)=>across(l.start)-across(family[i].start)),mean=spaces.reduce((a,b)=>a+b,0)/spaces.length;
   if(mean<6||mean>50||spaces.some(s=>Math.abs(s/mean-1)>.25))continue;
   const low=across(family[0].start),high=across(family.at(-1)!.start),box=horizontal?{x:from,y:low,width:length,height:high-low}:{x:low,y:from,width:high-low,height:length};
   const cx=label.box.x+label.box.width/2,cy=label.box.y+label.box.height/2;
   if(cx<box.x-mean*2||cx>box.x+box.width+mean*2||cy<box.y-mean*2||cy>box.y+box.height+mean*2)continue;
   if(!proposals.some(p=>Math.abs(p.box.x-box.x)<4&&Math.abs(p.box.y-box.y)<4&&Math.abs(p.box.width-box.width)<4&&Math.abs(p.box.height-box.height)<4))proposals.push({id:`stairs:${label.id}`,kind:'stairs',box,labelId:label.id,lineIds:family.map(l=>l.id)});
  }
  proposals.sort((a,b)=>b.lineIds.length-a.lineIds.length);
  if(proposals.length&&(!proposals[1]||proposals[0].lineIds.length>proposals[1].lineIds.length))result.push(proposals[0]);
 }
 return result;
}
export function stairRegionsAgree(a:StairRegion,b:StairRegion){return a.labelId===b.labelId&&(['x','y','width','height'] as const).every(k=>Math.abs(a.box[k]-b.box[k])<=Math.max(4,Math.min(a.box.width,a.box.height)*.08));}

/** Two agreeing passes are required; a contradictory detection vetoes adoption. */
export function stableStairRegions(passes:StairRegion[][],selectedIndex:number):StairRegion[]{
 return (passes[selectedIndex]??[]).filter(region=>{
  const others=passes.flatMap((pass,i)=>i===selectedIndex?[]:pass.filter(other=>other.labelId===region.labelId));
  return others.length>0&&others.every(other=>stairRegionsAgree(region,other));
 });
}
