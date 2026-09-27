import {resolveMeasurement} from '../domain/measurements';
import {useEditor} from '../state/editor';

export function MeasurementPanel(){
 const {project,view,activeWallId,activeTool,measurementDraft,saveMeasurement,clearMeasurement,deleteMeasurement,patchMeasurement}=useEditor();
 if(activeTool!=='measure')return null;
 const current=measurementDraft?.end?resolveMeasurement(project,{id:'draft',view,start:measurementDraft.start,end:measurementDraft.end,offsetMm:0}):null;
 const scaleUnknown=!!project.planImageUrl&&!project.planReference?.calibrated;
 const saved=(project.dimensions??[]).filter(item=>item.view===view&&(view!=='elevation'||item.elevationWallId===activeWallId));
 return <section className="measurement-panel" aria-label="줄자 측정">
  <strong>줄자 · {view==='plan'?'평면 거리':view==='elevation'?'벽면 거리':'3D 직선거리'}</strong>
  <p>{current?`${Math.round(current.distanceMm).toLocaleString()} mm${current.detached?' · 연결 끊김':''}`:measurementDraft?'두 번째 점을 선택하세요':'첫 번째 점을 선택하세요'}</p>
  {scaleUnknown&&<small>참고 도면 축척 미정 · 표시는 모델상 값</small>}
  {current&&<div className="measurement-actions"><button className="button primary" onClick={saveMeasurement}>치수선 남기기</button><button className="button secondary" onClick={clearMeasurement}>새 측정</button></div>}
  {saved.length>0&&<div className="measurement-list">{saved.map(item=>{const result=resolveMeasurement(project,item);return <div key={item.id}><span>{Math.round(result.distanceMm).toLocaleString()} mm{result.detached?' · 연결 끊김':''}</span><label>라벨 간격<input type="number" aria-label={`${item.id} 라벨 간격`} value={item.offsetMm} min="-100000" max="100000" step="10" onChange={e=>{const value=Number(e.target.value);if(Number.isFinite(value))patchMeasurement(item.id,{offsetMm:value});}}/> mm</label><button className="icon-button" aria-label={`${item.id} 삭제`} onClick={()=>deleteMeasurement(item.id)}>×</button></div>;})}</div>}
 </section>;
}
