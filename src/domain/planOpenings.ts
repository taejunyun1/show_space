import type {Wall} from './types';
import type {PlanLabel} from './planLabels';
import {detectFramedWindows} from './framedWindows';
import {detectOpeningGaps} from './detectOpenings';
/** Different raster passes may retain a frame or expose a gap. Both representations
 * must resolve to the same anchored opening before automatic venue adoption. */
export function resolvePlanOpenings(walls:Wall[],labels:PlanLabel[],maxGap:number){
 const framed=detectFramedWindows(walls,labels,maxGap),frameIds=new Set(framed.flatMap(f=>f.frameIds)),frameLabels=new Set(framed.map(f=>f.labelId));
 const structure=walls.filter(w=>!frameIds.has(w.id));
 const gaps=[...framed,...detectOpeningGaps(structure,labels.filter(l=>!frameLabels.has(l.id)),maxGap)];
 return {structure,gaps};
}
