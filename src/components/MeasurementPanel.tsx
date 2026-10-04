import {NumberField} from './Controls';
import {formatLength} from '../domain/lengthUnits';
import {resolveMeasurement} from '../domain/measurements';
import {useEditor} from '../state/editor';

export function MeasurementPanel(){
 const {project,view,activeWallId,activeTool,measurementDraft,saveMeasurement,clearMeasurement,deleteMeasurement,patchMeasurement}=useEditor();
 if(activeTool!=='measure')return null;
 const current=measurementDraft?.end?resolveMeasurement(project,{id:'draft',view,start:measurementDraft.start,end:measurementDraft.end,offsetMm:0}):null;
 const scaleUnknown=!!project.planImageUrl&&!project.planReference?.calibrated;
 const provisional=!!project.planDraft&&!project.planReference?.calibrated;
 const unit=provisional?'px':project.displayUnit??'mm';
 const format=(value:number)=>provisional?`${value.toLocaleString('ko-KR',{maximumFractionDigits:2})} px`:formatLength(value,project.displayUnit);
 const components=(result:ReturnType<typeof resolveMeasurement>)=><small className="measurement-components">수평거리 {format(result.horizontalMm)} · 높이차 {format(result.verticalMm)}</small>;
 const saved=(project.dimensions??[]).filter(item=>item.view===view&&(view!=='elevation'||item.elevationWallId===activeWallId));
 return <section className="measurement-panel" aria-label="줄자 측정">
  <strong>줄자 · {view==='plan'?'평면 거리':view==='elevation'?'벽면 거리':'3D 직선거리'}</strong>
  <small>프로젝트 표시 단위 · {unit} (아래 상태바에서 변경)</small>
  <p>{current?`직선거리 ${format(current.distanceMm)}${current.detached?' · 연결 끊김':''}`:measurementDraft?'두 번째 점을 선택하세요':'첫 번째 점을 선택하세요'}</p>
  {view==='3d'&&<small>벽·작품 모서리 근처에서 자동 스냅 · Alt로 해제. 3D 작품의 측정점은 이동·회전·크기 변경을 따라갑니다. 벽 걸이 작품은 벽 기준입니다.</small>}
  {current&&components(current)}
  <small>수평거리는 바닥에 투영한 거리입니다. 치수선·캡처와 라벨 간격은 {unit} 기준입니다.</small>
  {scaleUnknown&&<small>{provisional?'도면 좌표 기준 거리입니다. 실제 mm 길이는 두 점 축척 보정 후 확인하세요.':'참고 도면 축척 미정 · 표시는 모델상 값'}</small>}
  {current&&<div className="measurement-actions"><button className="button primary" onClick={saveMeasurement}>치수선 남기기</button><button className="button secondary" onClick={clearMeasurement}>새 측정</button></div>}
  {saved.length>0&&<div className="measurement-list">{saved.map(item=>{const result=resolveMeasurement(project,item);return <div key={item.id}><span>직선거리 {format(result.distanceMm)}{result.detached?' · 연결 끊김':''}</span>{components(result)}<NumberField label={`${item.id} 라벨 간격`} value={item.offsetMm} min={-100000} max={100000} step={10} suffix={provisional?'px':'mm'} onChange={offsetMm=>patchMeasurement(item.id,{offsetMm})}/><button className="icon-button" aria-label={`${item.id} 삭제`} onClick={()=>deleteMeasurement(item.id)}>×</button></div>;})}</div>}
 </section>;
}
