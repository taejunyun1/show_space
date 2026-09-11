import type {WallCandidate} from './wallCandidates';
export interface TextRegion{x:number;y:number;width:number;height:number}
/** Remove thin strokes wholly inside reliable text boxes; never cut a wall
 * merely because it passes through a text box or is as thick as the lettering. */
export function withoutTextStrokes(lines:WallCandidate[],regions:TextRegion[]=[]){
 const valid=regions.filter(b=>[b.x,b.y,b.width,b.height].every(Number.isFinite)&&b.width>0&&b.height>0);
 return lines.filter(l=>!valid.some(b=>Math.max(l.thicknessPx,l.solidSupportThicknessPx??0)<=Math.min(b.width,b.height)*.3&&[l.start,l.end].every(p=>p.x>=b.x-1&&p.x<=b.x+b.width+1&&p.y>=b.y-1&&p.y<=b.y+b.height+1)));
}
