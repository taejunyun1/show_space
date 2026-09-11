import {detectStairAccess} from './stairAccess';
import type {StairRegion} from './stairRegions';
import {detectCornerDoors} from './cornerDoors';
import type {Wall} from './types';
import type {PlanLabel} from './planLabels';
import {detectFramedWindows} from './framedWindows';
import {detectOpeningGaps} from './detectOpenings';
/** Different raster passes may retain a frame or expose a gap. Both representations
 * must resolve to the same anchored opening before automatic venue adoption. */
export function resolvePlanOpenings(walls:Wall[],labels:PlanLabel[],maxGap:number,stairs:StairRegion[]=[]){
 const accesses=detectStairAccess(walls,stairs,maxGap),excluded=new Set(accesses.flatMap(a=>a.excludedWallIds));
 walls=walls.filter(w=>!excluded.has(w.id));
 const framed=detectFramedWindows(walls,labels,maxGap),frameIds=new Set(framed.flatMap(f=>f.frameIds)),frameLabels=new Set(framed.map(f=>f.labelId));
 const structure=walls.filter(w=>!frameIds.has(w.id));
 const corner=detectCornerDoors(structure.map(w=>({id:w.id,start:{x:w.start.x,y:w.start.z},end:{x:w.end.x,y:w.end.z},thicknessPx:3})),labels).filter(d=>Math.hypot(d.end.x-d.start.x,d.end.y-d.start.y)<=maxGap);
 const cornerLabels=new Set(corner.map(d=>d.labelId));
 const gaps=[...accesses,...framed,...corner.map(d=>({kind:'door' as const,labelId:d.labelId,wall:{...structure.find(w=>w.id===d.aId)!,id:`opening-gap:${d.labelId}`,name:'출입구',start:{x:d.start.x,z:d.start.y},end:{x:d.end.x,z:d.end.y},note:'출입구 표기와 모서리 벽 끝점으로 검출. 높이·문짝 형태는 미확인.'}})),...detectOpeningGaps(structure,labels.filter(l=>!frameLabels.has(l.id)&&!cornerLabels.has(l.id)),maxGap)];
 return {structure,gaps};
}
