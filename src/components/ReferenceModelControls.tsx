import {NoteEditor} from './NoteEditor';
import {useState} from 'react';
import {downloadBlob} from '../lib/art';
import {adoptModelSpace,sameModelGeometry} from '../domain/modelSpace';
import {useEditor} from '../state/editor';
export function ReferenceModelControls(){
 const {project,patchProject}=useEditor(),model=project.referenceModel;const [busy,setBusy]=useState(false);if(!model)return null;
 async function convert(){
  if(!model||busy)return;setBusy(true);
  try{
   const {readModelWalls}=await import('../lib/modelImport'),result=await readModelWalls(model),state=useEditor.getState();
   if(state.project.id!==project.id||!sameModelGeometry(state.project.referenceModel,model))throw new Error('모델이 변경되어 벽 추출을 취소했습니다. 다시 시도해주세요.');
   adoptModelSpace(state.project,result.walls,result.importedFloor);
   downloadBlob(new Blob([JSON.stringify(state.project)],{type:'application/json'}),`${state.project.name}-모델전환전.json`);
   state.adoptModelWalls(result.walls,model,result.importedFloor);
   if(!useEditor.getState().message)state.notify(`모델에서 벽 ${result.walls.length}개를 가져왔습니다. 기존 작품은 미배치 목록에 보관했습니다.`);
  }catch(error){useEditor.getState().notify(error instanceof Error?error.message:'모델 벽을 읽지 못했습니다.');}finally{setBusy(false);}
 }
 const update=(patch:Partial<typeof model>)=>patchProject({referenceModel:{...model,...patch}});
 return <section className="reference-model-controls" aria-label="3D 참고 모델">
 <strong>3D 참고 모델</strong><span>{model.name}</span>
 <label><input type="checkbox" checked={model.visible} onChange={e=>update({visible:e.target.checked})}/> 모델 표시</label>
 <small>{model.sizeMm.map(value=>Math.round(value*model.scale).toLocaleString()).join(' × ')} mm</small>
 <details><summary>모델 위치·크기</summary>
 {(['X','높이','Z'] as const).map((name,index)=><label key={name}>{name}<input type="number" aria-label={`모델 ${name} 위치`} value={model.positionMm[index]} step={100} onChange={e=>{const value=Number(e.target.value);if(!Number.isFinite(value)||Math.abs(value)>1e7)return;const position:[number,number,number]=[...model.positionMm];position[index]=value;update({positionMm:position});}}/>mm</label>)}
 <label>회전<input type="number" aria-label="모델 회전" value={model.rotationDeg} min={-180} max={180} step={15} onChange={e=>{const rotationDeg=Number(e.target.value);if(Number.isFinite(rotationDeg)&&Math.abs(rotationDeg)<=180)update({rotationDeg});}}/>°</label>
 <label>크기<input type="number" aria-label="모델 크기 배율" value={Math.round(model.scale*100)} min={1} max={10000} onChange={e=>{const scale=Number(e.target.value)/100;if(Number.isFinite(scale)&&scale>=.01&&scale<=100)update({scale});}}/>%</label>
 </details>
 <button className="button secondary" disabled={busy} onClick={()=>void convert()}>{busy?'벽 형상 분석 중…':'모델 벽으로 공간 만들기'}</button>
 <small>닫힌 직선 벽과 바닥을 추출해 작품 설치 공간으로 만듭니다. 기존 작업은 JSON으로 백업하고 원본 모델은 숨겨 보관합니다. 곡면·문이 뚫린 벽·설비 등은 자동 변환하지 않습니다. 모델 줄자 점은 고정 좌표입니다.</small>
 <details><summary>전시장 모델 메모</summary><NoteEditor key={project.id+"-reference-note"} target={{type:"referenceModel"}} label="전시장 NOTE"/></details>
 <button className="button secondary" onClick={()=>patchProject({referenceModel:undefined})}>참고 모델 제거</button>
 </section>;
}
