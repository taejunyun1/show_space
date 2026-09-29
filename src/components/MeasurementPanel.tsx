import {useState} from 'react';
import {formatMeasurement,type MeasurementUnit,resolveMeasurement} from '../domain/measurements';
import {useEditor} from '../state/editor';

export function MeasurementPanel(){
 const {project,view,activeWallId,activeTool,measurementDraft,saveMeasurement,clearMeasurement,deleteMeasurement,patchMeasurement}=useEditor();
 const [displayUnit,setDisplayUnit]=useState<MeasurementUnit>('mm');
 if(activeTool!=='measure')return null;
 const current=measurementDraft?.end?resolveMeasurement(project,{id:'draft',view,start:measurementDraft.start,end:measurementDraft.end,offsetMm:0}):null;
 const scaleUnknown=!!project.planImageUrl&&!project.planReference?.calibrated;
 const provisional=!!project.planDraft&&!project.planReference?.calibrated;
 const unit=provisional?'px':displayUnit;
 const format=(value:number)=>formatMeasurement(value,unit);
 const components=(result:ReturnType<typeof resolveMeasurement>)=><small className="measurement-components">수평거리 {format(result.horizontalMm)} · 높이차 {format(result.verticalMm)}</small>;
 const saved=(project.dimensions??[]).filter(item=>item.view===view&&(view!=='elevation'||item.elevationWallId===activeWallId));
 return <section className="measurement-panel" aria-label="줄자 측정">
  <strong>줄자 · {view==='plan'?'평면 거리':view==='elevation'?'벽면 거리':'3D 직선거리'}</strong>
  <label>패널 표시 단위 <select aria-label="측정 패널 표시 단위" value={unit} disabled={provisional} onChange={e=>setDisplayUnit(e.target.value as MeasurementUnit)}>{provisional?<option value="px">px</option>:<><option value="mm">mm</option><option value="cm">cm</option><option value="m">m</option></>}</select></label>
  <p>{current?`직선거리 ${format(current.distanceMm)}${current.detached?' · 연결 끊김':''}`:measurementDraft?'두 번째 점을 선택하세요':'첫 번째 점을 선택하세요'}</p>
  {current&&components(current)}
  <small>수평거리는 바닥에 투영한 거리입니다. 치수선·캡처와 라벨 간격은 {provisional?'px':'mm'} 기준입니다.</small>
  {scaleUnknown&&<small>{provisional?'도면 좌표 기준 거리입니다. 실제 mm 길이는 두 점 축척 보정 후 확인하세요.':'참고 도면 축척 미정 · 표시는 모델상 값'}</small>}
  {current&&<div className="measurement-actions"><button className="button primary" onClick={saveMeasurement}>치수선 남기기</button><button className="button secondary" onClick={clearMeasurement}>새 측정</button></div>}
  {saved.length>0&&<div className="measurement-list">{saved.map(item=>{const result=resolveMeasurement(project,item);return <div key={item.id}><span>직선거리 {format(result.distanceMm)}{result.detached?' · 연결 끊김':''}</span>{components(result)}<label>라벨 간격<input type="number" aria-label={`${item.id} 라벨 간격`} value={item.offsetMm} min="-100000" max="100000" step="10" onChange={e=>{const value=Number(e.target.value);if(Number.isFinite(value))patchMeasurement(item.id,{offsetMm:value});}}/> {provisional?'px':'mm'}</label><button className="icon-button" aria-label={`${item.id} 삭제`} onClick={()=>deleteMeasurement(item.id)}>×</button></div>;})}</div>}
 </section>;
}
