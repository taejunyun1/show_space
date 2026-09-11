import type {Wall} from './types';
import type {PlanLabel} from './planLabels';
import {wallAnnotationScale} from './wallAnnotationScale';
/** A width label must uniquely target an already detected gap, competing with nearby walls. */
export function readOpeningDimensions(walls:Wall[],gaps:{wall:Wall;kind:string}[],labels:PlanLabel[]){
 const eligible=gaps.filter(g=>g.kind==='door'||g.kind==='window');
 const ids=new Set(eligible.map(g=>g.wall.id));
 return wallAnnotationScale([...walls,...eligible.map(g=>g.wall)],labels).allMatches.filter(m=>ids.has(m.wallId));
}
