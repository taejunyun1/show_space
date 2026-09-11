import {venueDimensions} from './venueDimensions';
import type {PlanPage} from '../lib/planImport';
import type {Opening,Project} from './types';
import {extractStructuralWalls} from './automaticVenue';
import {resolvePlanOpenings} from './planOpenings';
import {classifyAutomaticWalls} from './automaticWallTopology';
import {detectStairRegions} from './stairRegions';
import {createDimensionMap} from './dimensionMap';
import {prepareMappedVenue} from './mappedVenue';
import {floorWithOpenings,openingSegments} from './openings';
import {parseProject} from './model';
/** Geometry-only preparation; raster rendering and cross-pass adoption happen in analyzePlan. */
export function prepareConstrainedVenue(page:PlanPage){
 if(page.analysis?.textState!=='complete'||page.analysis.lineState!=='complete')return undefined;
 const labels=page.labels??[],lines=page.analysis.lines,candidates=extractStructuralWalls(page),stairs=page.analysis.stairRegions??detectStairRegions(labels,lines);
 const {structure,gaps}=resolvePlanOpenings(candidates,labels,Math.max(page.widthPx,page.heightPx)*.2,stairs);
 const classified=classifyAutomaticWalls([...structure,...gaps.map(g=>g.wall)]);if(!classified)return undefined;
 const gapIds=new Set(gaps.map(g=>g.wall.id)),walls=classified.filter(w=>!gapIds.has(w.id));
 const openings:Opening[]=[];
 for(const gap of gaps){
  if(classified.filter(w=>w.id===gap.wall.id).length!==1)return undefined;
  const anchor=(p:typeof gap.wall.start)=>walls.flatMap(w=>(['start','end'] as const).filter(e=>Math.hypot(w[e].x-p.x,w[e].z-p.z)<.001).map(endpoint=>({wallId:w.id,endpoint})))[0];
  const start=anchor(gap.wall.start),end=anchor(gap.wall.end);if(!start||!end)return undefined;
  openings.push({id:gap.wall.id,kind:gap.kind,role:classified.find(w=>w.id===gap.wall.id)!.role??'boundary',start,end,note:gap.wall.note});
 }
 const base:Project={schemaVersion:1,id:'automatic-venue',name:'자동 공간 초안',venue:'도면에서 생성',walls:candidates,artworks:[],scenes:[],floorColor:'#f1f1ed',planReference:{origin:{x:0,z:0},mmPerPixel:1,widthPx:page.widthPx,heightPx:page.heightPx,calibrated:true}};
 const {solution}=venueDimensions(page,candidates,structure,gaps);
 const map=createDimensionMap(solution);if(!map)return undefined;
 const prepared=prepareMappedVenue(map,{walls,openings,labels,lines,stairs});if(!prepared)return undefined;
 // Facility annotations outside the transform must not disappear from the editor.
 if(prepared.outsideLabels.some(l=>!['dimension','unit'].includes(l.kind)&&l.status!=='dismissed'))return undefined;
 const project:Project={...base,...prepared.layers,planImageUrl:page.imageUrl,
  sourcePlan:{imageUrl:page.imageUrl,widthPx:page.widthPx,heightPx:page.heightPx,labels:structuredClone(labels)},
  planAnalysis:{lines:prepared.lines,stairRegions:prepared.stairs,issues:['개별 표기 치수로 도면 좌표를 변환했습니다. 원본은 프로젝트에 함께 보존됩니다.'],numericCount:prepared.layers.planLabels!.filter(l=>l.kind==='dimension').length,textState:'complete',lineState:'complete'}};
 const floor=floorWithOpenings(project);if(floor.invalidComponents||!floor.surfaces.length)return undefined;
 for(const opening of openingSegments(project)){
  const width=Math.hypot(opening.end.x-opening.start.x,opening.end.z-opening.start.z);
  if(width<(opening.kind==='door'?400:100)||width>(opening.kind==='door'?4000:10000))return undefined;
 }
 try{parseProject(project);}catch{return undefined;}
 return {prepared,project};
}
