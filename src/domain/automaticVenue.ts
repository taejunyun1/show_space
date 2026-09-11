import {pageUnit} from './planUnits';
import {pairWallEdges} from './pairWallEdges';
import {detectOpeningGaps} from './detectOpenings';
import {selectStructuralLines} from './structuralLines';
import type {PlanPage} from '../lib/planImport';
import type {Project, Wall} from './types';
import {classifyAutomaticWalls} from './automaticWallTopology';
import {matchDimensionLines} from './dimensionLineEvidence';
import {readPlanNumbers} from './planNumbers';

export interface AutomaticVenue {project?:Project; reasons:string[]; wallCount:number}
/** A conservative closed-outline draft, never a claim of complete venue recognition. */
export function buildAutomaticVenue(page:PlanPage):AutomaticVenue {
 const blocked=(reason:string,wallCount=0):AutomaticVenue=>({reasons:[reason],wallCount});
 if(!page.analysis)return blocked('도면 분석이 끝나면 공간 초안을 자동 생성합니다.');
 if(page.analysis.selfCheck?.status==='withheld')return blocked('자체 검증에서 공간 구조를 확정하지 못했습니다. 원본과 분석 결과를 보존했으며 자동 적용은 보류했습니다.');
 if(page.analysis.lineState!=='complete'||page.analysis.textState!=='complete')return blocked('문자와 선 분석을 모두 완료해야 공간 초안을 만들 수 있습니다.');
 const minLength=Math.max(30,Math.min(page.widthPx,page.heightPx)*.08);
 // Witness lines can split a thick raster stripe into adjacent bands.
 const bands=page.analysis.lines.map(l=>structuredClone(l));
 for(let i=0;i<bands.length;i++)for(let j=i+1;j<bands.length;j++){
  const a=bands[i],b=bands[j],horizontal=Math.abs(a.start.y-a.end.y)<1;
  const along=(p:{x:number;y:number})=>horizontal?p.x:p.y;
  const across=(p:{x:number;y:number})=>horizontal?p.y:p.x;
  if(Math.abs(across(b.start)-across(b.end))>=1||Math.abs(along(a.start)-along(b.start))>1||Math.abs(along(a.end)-along(b.end))>1)continue;
  const distance=Math.abs(across(a.start)-across(b.start));
  if(distance>(a.thicknessPx+b.thicknessPx)/2+1||distance<.1)continue;
  const low=Math.min(across(a.start)-a.thicknessPx/2,across(b.start)-b.thicknessPx/2),high=Math.max(across(a.start)+a.thicknessPx/2,across(b.start)+b.thicknessPx/2);
  if(high-low>12)continue;
  if(horizontal){a.start.y=a.end.y=(low+high)/2;}else{a.start.x=a.end.x=(low+high)/2;}
  a.thicknessPx=high-low;bands.splice(j--,1);
 }
 const lines=selectStructuralLines(pairWallEdges(bands),minLength,page.labels??[]);
 // Only merge tiny raster endpoint discrepancies; never bridge doorway-sized gaps.
 const points:{x:number;z:number}[]=[];
 const snap=(p:{x:number;y:number})=>{
  const existing=points.find(q=>Math.hypot(q.x-p.x,q.z-p.y)<=4);
  if(existing)return {...existing};
  const next={x:p.x,z:p.y};points.push(next);return {...next};
 };
 const candidates:Wall[]=lines.map((l,i)=>({id:`auto-wall-${i+1}`,name:`자동 벽 ${i+1}`,role:'boundary',start:snap(l.start),end:snap(l.end),heightMm:3000,thicknessMm:150,color:'#ffffff',visible:true,locked:false,note:'자동 구조 초안. 높이 3000 mm·두께 150 mm는 임시값이며 도면에서 측정한 값이 아닙니다.'}));
 const gaps=detectOpeningGaps(candidates,page.labels??[],Math.max(page.widthPx,page.heightPx)*.2);
 const classified=classifyAutomaticWalls([...candidates,...gaps.map(g=>g.wall)]);
 const gapIds=new Set(gaps.map(g=>g.wall.id));
 const walls=classified?.filter(w=>!gapIds.has(w.id));
 if(classified&&gaps.some(g=>classified.filter(w=>w.id===g.wall.id).length!==1))return blocked('개구부와 다른 구조선이 교차해 자동 연결을 보류했습니다.');
 if(!walls)return blocked('닫힌 벽 경계를 확정하지 못했습니다. 끊긴 벽·이중선·가구 선이 있는 도면은 아직 자동 생성 대상이 아닙니다.',candidates.length);
 const base:Project={schemaVersion:1,id:'automatic-venue',name:'자동 공간 초안',venue:'도면에서 생성',walls,artworks:[],scenes:[],floorColor:'#f1f1ed',planImageUrl:page.imageUrl,planOpacity:.55,planLabels:page.labels??[],planAnalysis:page.analysis,planReference:{widthPx:page.widthPx,heightPx:page.heightPx,origin:{x:0,z:0},mmPerPixel:1,calibrated:true}};
 const declared=pageUnit(page.labels??[]);
 if(declared.conflict)return blocked('페이지 전체 단위 선언이 서로 충돌해 축척 적용을 보류했습니다.');
 const votes:{ratio:number;wallId:string}[]=[];
 for(const label of page.labels??[]){
  if(label.status==='dismissed'||(label.source==='ocr'&&(label.confidence??0)<90))continue;
  const numbers=readPlanNumbers(label.correctedText??label.text);
  if(numbers.length!==1||numbers[0].values.length!==1||!(numbers[0].unit??declared.unit))continue;
  // Dimensions refer to original spans, not the fragments created at room junctions.
  const n=numbers[0],matches=matchDimensionLines({...base,walls:candidates},label,page.analysis.lines);
  if(matches.length!==1)continue;
  const m=matches[0],mm=n.values[0]*({mm:1,cm:10,m:1000}[n.unit??declared.unit!]);
  if(mm<=0||mm>200000)continue;
  votes.push({ratio:mm/Math.hypot(m.end.x-m.start.x,m.end.y-m.start.y),wallId:m.wallId});
 }
 if(new Set(votes.map(v=>v.wallId)).size<2)return blocked('단위와 치수선이 명확한 서로 다른 벽 치수 2개가 필요합니다. 축척을 추측하지 않고 도면 배치를 유지합니다.',walls.length);
 const ratios=votes.map(v=>v.ratio).sort((a,b)=>a-b),scale=ratios[Math.floor(ratios.length/2)];
 if(ratios.some(r=>Math.abs(r/scale-1)>.02))return blocked('치수에서 계산한 축척이 서로 다릅니다. 자동 적용을 보류했습니다.',walls.length);
 for(const g of gaps){
  const length=Math.hypot(g.wall.start.x-g.wall.end.x,g.wall.start.z-g.wall.end.z)*scale;
  if(length<(g.kind==='door'?400:100)||length>(g.kind==='door'?4000:10000))return blocked('개구부의 실제 폭이 검증 범위를 벗어나 적용을 보류했습니다.');
 }
 const anchor=(p:{x:number;z:number})=>walls.flatMap(w=>(['start','end'] as const).map(endpoint=>({wallId:w.id,endpoint,point:w[endpoint]}))).find(a=>Math.hypot(a.point.x-p.x,a.point.z-p.z)<.001);
 base.openings=[];
 for(const g of gaps){
  const start=anchor(g.wall.start),end=anchor(g.wall.end);
  if(!start||!end)return blocked('개구부의 벽 연결을 확정하지 못했습니다.');
  base.openings.push({id:g.wall.id,kind:g.kind,role:classified!.find(w=>w.id===g.wall.id)!.role??'boundary',start:{wallId:start.wallId,endpoint:start.endpoint},end:{wallId:end.wallId,endpoint:end.endpoint},note:g.wall.note});
 }
 base.planReference!.mmPerPixel=scale;
 base.walls=walls.map(w=>({...w,start:{x:w.start.x*scale,z:w.start.z*scale},end:{x:w.end.x*scale,z:w.end.z*scale}}));
 return {project:base,wallCount:walls.length,reasons:['벽 높이 3 m·두께 150 mm는 임시값입니다.','개구부의 높이·문짝·창틀과 설비·계단의 실제 영역 및 설치 불가 구역은 아직 자동 구성하지 않습니다. 이 초안에는 해당 영역이 아직 반영되지 않았습니다.']};
}
