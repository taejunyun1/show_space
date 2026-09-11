import type {WallCandidate} from './wallCandidates';
import type {Project,Wall,Opening,OpeningAnchor} from './types';
import type {PlanLabel} from './planLabels';
import type {StairRegion} from './stairRegions';
import type {createDimensionMap} from './dimensionMap';

type DimensionMap=NonNullable<ReturnType<typeof createDimensionMap>>;
/** Prepare all layers in one coordinate system. The original page stays with the caller.
 * No transformed image URL is attached until its raster has actually been rendered. */
export function prepareMappedVenue(map:DimensionMap,input:{walls:Wall[];openings:Opening[];labels:PlanLabel[];stairs:StairRegion[];lines:WallCandidate[]}){
 const mappedWalls:Wall[]=[],wallEnds=new Map<string,{start:string;end:string}>();
 for(const wall of input.walls){
  const path=map.segmentToWorld(wall.start,wall.end);if(!path||path.length<2)return undefined;
  const parts=path.slice(1).map((end,i)=>({...wall,id:path.length===2?wall.id:`${wall.id}:mapped-${i+1}`,start:path[i],end}));
  mappedWalls.push(...parts);wallEnds.set(wall.id,{start:parts[0].id,end:parts.at(-1)!.id});
 }
 if(mappedWalls.length>200||new Set(mappedWalls.map(w=>w.id)).size!==mappedWalls.length)return undefined;
 const openings:Opening[]=[];
 for(const opening of input.openings){
  const transform=(ref:OpeningAnchor):OpeningAnchor|undefined=>{
   if(ref.point){const point=map.toWorld(ref.point);return point?{point}:undefined;}
   const ends=wallEnds.get(ref.wallId);return ends?{wallId:ends[ref.endpoint],endpoint:ref.endpoint}:undefined;
  };
  const start=transform(opening.start),end=transform(opening.end);if(!start||!end)return undefined;
  openings.push({...opening,start,end});
 }
 const xs=map.axes.x,zs=map.axes.z;
 const origin={x:xs[0].mm,z:zs[0].mm},worldWidth=xs.at(-1)!.mm-origin.x,worldHeight=zs.at(-1)!.mm-origin.z;
 const mmPerPixel=Math.max(worldWidth,worldHeight)/2400;
 const reference={origin,mmPerPixel,widthPx:Math.ceil(worldWidth/mmPerPixel),heightPx:Math.ceil(worldHeight/mmPerPixel),calibrated:true};
 const box=(b:{x:number;y:number;width:number;height:number})=>{
  const mapped=map.boxToWorld(b);return mapped?{x:(mapped.x-origin.x)/mmPerPixel,y:(mapped.z-origin.z)/mmPerPixel,width:mapped.width/mmPerPixel,height:mapped.depth/mmPerPixel}:undefined;
 };
 const labels:PlanLabel[]=[],outsideLabels:PlanLabel[]=[];
 for(const label of input.labels){const mapped=box(label.box);if(mapped)labels.push({...label,box:mapped});else outsideLabels.push(structuredClone(label));}
 const lines:WallCandidate[]=[],lineIds=new Map<string,string[]>(),outsideLines:WallCandidate[]=[];
 const strokeScale=Math.max(...[xs,zs].flatMap(knots=>knots.slice(1).map((k,i)=>(k.mm-knots[i].mm)/(k.pixel-knots[i].pixel))))/mmPerPixel;
 for(const line of input.lines){
  const path=map.segmentToWorld({x:line.start.x,z:line.start.y},{x:line.end.x,z:line.end.y});
  if(!path){outsideLines.push(structuredClone(line));continue;}
  const point=(p:{x:number;z:number})=>({x:(p.x-origin.x)/mmPerPixel,y:(p.z-origin.z)/mmPerPixel});
  const parts=path.slice(1).map((p,i)=>({id:path.length===2?line.id:`${line.id}:mapped-${i+1}`,start:point(path[i]),end:point(p),thicknessPx:line.thicknessPx*strokeScale}));
  lines.push(...parts);lineIds.set(line.id,parts.map(p=>p.id));
 }
 if(lines.length>500||new Set(lines.map(l=>l.id)).size!==lines.length)return undefined;
 const stairs:StairRegion[]=[];
 for(const region of input.stairs){
  const mapped=box(region.box);
  // Installation exclusions must never silently disappear or lose their identifying label.
  if(!mapped||(region.evidence!=='shape'&&!labels.some(l=>l.id===region.labelId)))return undefined;
  if(region.lineIds.some(id=>!lineIds.has(id)))return undefined;
  const ids=region.lineIds.flatMap(id=>lineIds.get(id)!);if(ids.length<3||ids.length>30)return undefined;
  if(region.railIds?.some(id=>!lineIds.has(id)))return undefined;
  stairs.push({...region,box:mapped,lineIds:ids,...(region.railIds?{railIds:region.railIds.flatMap(id=>lineIds.get(id)!)}:{})});
 }
 const cells=xs.slice(1).flatMap((x,i)=>zs.slice(1).map((z,j)=>({
  source:{x:xs[i].pixel,y:zs[j].pixel,width:x.pixel-xs[i].pixel,height:z.pixel-zs[j].pixel},
  target:{x:(xs[i].mm-origin.x)/mmPerPixel,y:(zs[j].mm-origin.z)/mmPerPixel,width:(x.mm-xs[i].mm)/mmPerPixel,height:(z.mm-zs[j].mm)/mmPerPixel},
 })));
 const layers:Pick<Project,'walls'|'openings'|'planLabels'|'planReference'>={walls:mappedWalls,openings,planLabels:labels,planReference:reference};
 return {layers,stairs,lines,outsideLabels,outsideLines,cells};
}
