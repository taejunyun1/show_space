import {useMemo} from 'react';
import type {PlanPage} from '../lib/planImport';
import type {Project} from '../domain/types';
import {buildEditablePlanDraft} from '../domain/editablePlanDraft';
import {floorWithOpenings,openingSegments} from '../domain/openings';
export function AutomaticVenuePreview({page,onAdopt,disabled}:{page:PlanPage;onAdopt:(p:Project)=>void;disabled:boolean}){
 const draft=useMemo(()=>buildEditablePlanDraft(page),[page]);
 const p=draft.project,verified=draft.kind==='verified';
 const scale=p?.planReference?.mmPerPixel??1,origin=p?.planReference?.origin??{x:0,z:0};
 return <section className="plan-text-analysis">
  <strong>{verified?'자동 공간 초안':'편집 가능한 벽 초안'}</strong>
  {p&&<>
   <p>{verified?`외곽 벽 ${p.walls.filter(w=>w.role!=='partition').length}개 · 내부 벽 ${p.walls.filter(w=>w.role==='partition').length}개 · 바닥 ${(floorWithOpenings(p).areaMm2/1e6).toFixed(1)} m² · 치수 교차 검증 완료`:`구조선 후보 ${p.walls.length}개 · 축척 미정 · 바닥 경계와 실제 길이는 확정하지 않았습니다.`}</p>
   <svg role="img" aria-label="자동 공간 초안 미리보기" viewBox={`0 0 ${page.widthPx} ${page.heightPx}`} style={{width:'100%',maxHeight:300,background:'white'}}>
    <image href={p.planImageUrl??page.imageUrl} width={page.widthPx} height={page.heightPx} opacity={.4}/>
    {p.walls.map(w=><line key={w.id} x1={(w.start.x-origin.x)/scale} y1={(w.start.z-origin.z)/scale} x2={(w.end.x-origin.x)/scale} y2={(w.end.z-origin.z)/scale} stroke={w.role==='partition'?'#b45d16':'#365cf5'} strokeWidth={5}/>)}
    {openingSegments(p).map(o=><line key={o.id} x1={(o.start.x-origin.x)/scale} y1={(o.start.z-origin.z)/scale} x2={(o.end.x-origin.x)/scale} y2={(o.end.z-origin.z)/scale} stroke="#16816b" strokeWidth={5} strokeDasharray="8 5"/>)}
   </svg>
   <p>{verified?'파랑: 바닥 경계 · 주황: 내부 벽 후보 · 초록 점선: 개구부. 가구와 벽의 의미 구분은 아직 완료되지 않았습니다.':'주황 선은 자동 추출 후보입니다. 벽·가구·치수선 구분은 확정되지 않았으며, 두 점 축척 보정 전 길이는 도면 px 기준입니다.'}</p>
  </>}
  {p?.sourcePlan&&<details><summary>변환 전 원본 도면</summary><img src={p.sourcePlan.imageUrl} alt="변환 전 원본 도면" style={{width:'100%'}}/></details>}
  {draft.reasons.map(r=><p key={r}>{verified?r:`전체 공간 검증: ${r.replace('자동 적용은 보류했습니다.','전체 공간 적용은 보류했습니다.')}`}</p>)}
  {p&&<><p>적용하면 현재 공간과 작품을 이 초안으로 교체합니다. 실행 취소로 복원할 수 있습니다. 같은 도면을 다시 분석해도 편집한 벽은 자동으로 덮어쓰지 않습니다.</p><button className="button primary" disabled={disabled} onClick={()=>onAdopt(structuredClone(p))}>{verified?'검증된 공간 초안 적용':'벽 초안으로 편집 시작'}</button></>}
 </section>;
}
