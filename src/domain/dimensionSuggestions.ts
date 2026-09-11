import type {Project} from './types';
import type {PlanLabel} from './planLabels';
import {readPlanNumbers} from './planNumbers';
export interface WallSuggestion {wallId:string;distancePx:number;start:{x:number;y:number};end:{x:number;y:number}}
export function suggestDimensionWalls(project:Project,label:PlanLabel):{candidates:WallSuggestion[];message:string}{
 const r=project.planReference;
 if(!r?.calibrated||!project.planImageUrl)return {candidates:[],message:'두 점 축척 보정 후 위치 기반 추천을 사용할 수 있습니다.'};
 const numbers=readPlanNumbers(label.correctedText??label.text);
 if(label.kind!=='dimension'||label.status==='dismissed'||numbers.length!==1||numbers[0].values.length!==1||/\d\s*[x×]\s*\d/i.test(label.correctedText??label.text))return {candidates:[],message:'숫자 하나로 정정하면 주변 벽을 추천합니다.'};
 const point={x:label.box.x+label.box.width/2,y:label.box.y+label.box.height/2};
 const radius=Math.max(48,Math.min(160,Math.max(r.widthPx,r.heightPx)*0.06));
 const candidates=project.walls.flatMap(w=>{
  if(!w.visible)return [];
  const start={x:(w.start.x-r.origin.x)/r.mmPerPixel,y:(w.start.z-r.origin.z)/r.mmPerPixel};
  const end={x:(w.end.x-r.origin.x)/r.mmPerPixel,y:(w.end.z-r.origin.z)/r.mmPerPixel};
  if(![start,end].every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.y>=0&&p.x<=r.widthPx&&p.y<=r.heightPx))return [];
  const dx=end.x-start.x,dy=end.y-start.y,len2=dx*dx+dy*dy;
  if(len2<1)return [];
  const t=((point.x-start.x)*dx+(point.y-start.y)*dy)/len2;
  // Exclude annotations beyond a wall's ends: proximity to a corner alone is weak evidence.
  if(t<0||t>1)return [];
  const distancePx=Math.hypot(point.x-start.x-t*dx,point.y-start.y-t*dy);
  return distancePx<=radius?[{wallId:w.id,distancePx,start,end}]:[];
 }).sort((a,b)=>a.distancePx-b.distancePx||a.wallId.localeCompare(b.wallId)).slice(0,3);
 const ambiguous=candidates.length>1&&candidates[1].distancePx-candidates[0].distancePx<Math.max(10,candidates[0].distancePx*0.25);
 return {candidates,message:!candidates.length?'가까운 벽을 찾지 못했습니다. 벽과 도면의 위치 정렬을 확인하거나 직접 선택하세요.':ambiguous?'비슷한 거리에 벽이 여러 개 있습니다. 도면에서 대상 벽을 확인하세요.':'문자 위치와 가까운 벽 순서입니다. 치수선의 연결을 판독한 결과는 아닙니다.'};
}
