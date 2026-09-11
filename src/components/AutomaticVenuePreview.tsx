import {useMemo} from 'react';
import type {PlanPage} from '../lib/planImport';
import type {Project} from '../domain/types';
import {buildAutomaticVenue} from '../domain/automaticVenue';
import {deriveFloor} from '../domain/floor';
export function AutomaticVenuePreview({page,onAdopt,disabled}:{page:PlanPage;onAdopt:(p:Project)=>void;disabled:boolean}){
 const draft=useMemo(()=>buildAutomaticVenue(page),[page]);
 const p=draft.project,scale=p?.planReference?.mmPerPixel??1;
 return <section className="plan-text-analysis"><strong>자동 공간 초안</strong>{p&&<><p>외곽 벽 {p.walls.filter(w=>w.role!=='partition').length}개 · 내부 벽 {p.walls.filter(w=>w.role==='partition').length}개 · 바닥 {(deriveFloor(p.walls).areaMm2/1e6).toFixed(1)} m² · 치수 교차 검증 완료</p><svg role="img" aria-label="자동 공간 초안 미리보기" viewBox={`0 0 ${page.widthPx} ${page.heightPx}`} style={{width:'100%',maxHeight:300,background:'white'}}><image href={page.imageUrl} width={page.widthPx} height={page.heightPx} opacity={.4}/>{p.walls.map(w=><line key={w.id} x1={w.start.x/scale} y1={w.start.z/scale} x2={w.end.x/scale} y2={w.end.z/scale} stroke={w.role==='partition'?'#b45d16':'#365cf5'} strokeWidth={5}/>)}</svg><p>파랑: 바닥 경계 · 주황: 내부 벽 후보. 가구와 벽의 의미 구분은 아직 완료되지 않았습니다.</p></>}{draft.reasons.map(r=><p key={r}>{r}</p>)}{p&&<><p>적용하면 현재 공간과 작품을 이 초안으로 교체합니다. 실행 취소로 복원할 수 있습니다.</p><button className="button primary" disabled={disabled} onClick={()=>onAdopt(structuredClone(p))}>이 공간 초안 적용</button></>}</section>;
}
