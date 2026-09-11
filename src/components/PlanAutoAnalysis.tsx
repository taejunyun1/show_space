import {PlanTextAnalysis} from './PlanTextAnalysis';
import{useEffect,useRef,useState}from'react';
import type{PlanPage}from'../lib/planImport';
import{analyzePlan}from'../lib/analyzePlan';
export function PlanAutoAnalysis({page,onResult,onBusy}:{page:PlanPage;onResult:(p:PlanPage)=>void;onBusy:(b:boolean)=>void}){
 const controller=useRef<AbortController|null>(null),revision=useRef(0);
 const [busy,setBusy]=useState(false),[stage,setStage]=useState(''),[error,setError]=useState('');
 const [manualBusy,setManualBusy]=useState(false);
 useEffect(()=>{onBusy(busy||manualBusy);},[busy,manualBusy]);
 async function run(input=page){controller.current?.abort();const c=new AbortController();controller.current=c;const id=++revision.current;setBusy(true);setError('');try{const result=await analyzePlan(input,c.signal,setStage);if(!c.signal.aborted&&id===revision.current)onResult(result);}catch(e){if(!c.signal.aborted&&id===revision.current)setError((e as Error).message);}finally{if(id===revision.current){setBusy(false);}}}
 useEffect(()=>{if(!page.analysis)void run();return()=>{revision.current++;controller.current?.abort();};},[page.imageUrl]);
 useEffect(()=>()=>onBusy(false),[]);
 return <section className="plan-text-analysis"><strong>도면 자동 분석</strong>{busy?<><p role="status">{stage}</p><button className="button secondary" onClick={()=>{controller.current?.abort();revision.current++;setBusy(false);setError('자동 분석을 취소했습니다. 원본을 유지합니다.');}}>자동 분석 취소</button></>:<>{page.analysis&&<><p role="status">숫자 표기 {page.analysis.numericCount}개 · 구조 선 후보 {page.analysis.lines.length}개</p><p>개별 분석 버튼 없이 문자와 선을 함께 분석했습니다. 아직 전시장 전체 생성 결과는 아닙니다.</p>{page.analysis.issues.length>0&&<details open><summary>확인이 필요한 정보</summary><ul>{page.analysis.issues.map(issue=><li key={issue}>{issue}</li>)}</ul></details>}<details><summary>분석된 선 보기</summary><svg role="img" aria-label="자동 분석 선 후보" viewBox={`0 0 ${page.widthPx} ${page.heightPx}`} style={{width:'100%',maxHeight:280,background:'white'}}><image href={page.imageUrl} width={page.widthPx} height={page.heightPx}/>{page.analysis.lines.map(l=><line key={l.id} x1={l.start.x} y1={l.start.y} x2={l.end.x} y2={l.end.y} stroke="#5157ef" strokeWidth={Math.max(2,page.widthPx/700)}/>)}</svg><p>치수선·가구 선도 포함될 수 있는 구조 후보입니다.</p></details></>}<button className="button secondary" disabled={manualBusy} onClick={()=>void run()}>자동 분석 다시 실행</button><details><summary>문자 인식 고급 도구</summary><PlanTextAnalysis page={page} auto={false} onBusy={setManualBusy} onResult={value=>{void run({...value,analysis:undefined});}}/></details></>}{error&&<p role="alert">{error}</p>}</section>;
}
