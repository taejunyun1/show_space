import {NumberField} from './Controls';
import {useLengthFormatter} from './LengthUnits';
import {NoteEditor} from './NoteEditor';
import {useEffect,useRef,useState} from 'react';
import {downloadBlob} from '../lib/art';
import {adoptModelSpace,sameModelGeometry} from '../domain/modelSpace';
import {sameModelConversionSpace} from '../domain/modelConversionScope';
import type {Project} from '../domain/types';
import {useEditor} from '../state/editor';
export function ReferenceModelControls({hidden=false}:{hidden?:boolean}={}){
 const formatLength = useLengthFormatter();
 const {project,patchProject}=useEditor(),model=project.referenceModel;const [busy,setBusy]=useState(false);
 const alive=useRef(false),active=useRef<{projectId:string;source:Project;model:NonNullable<typeof model>}|null>(null);
 useEffect(()=>{alive.current=true;const unsubscribe=useEditor.subscribe((next,previous)=>{const job=active.current;if(job&&next.project!==previous.project&&(next.project.id!==job.projectId||!sameModelGeometry(next.project.referenceModel,job.model)||!sameModelConversionSpace(next.project,job.source))){active.current=null;setBusy(false);}});return()=>{alive.current=false;active.current=null;unsubscribe();};},[]);
 function requireIdle(){const s=useEditor.getState();if(!s.hydrated)throw new Error('저장된 작업을 불러온 뒤 모델을 변환하세요.');if(s.previewProject||s.wallGesture||s.artworkGesture||s.lightGesture||s.modelArtworkGesture||s.outdoorGesture||s.rotatingArtworkId)throw new Error('이동·회전을 마친 뒤 모델을 변환하세요.');}
 if(!model)return null;
 async function convert(){
  const source=useEditor.getState().project;if(!alive.current||active.current||!source.referenceModel)return;
  const job={projectId:source.id,source,model:structuredClone(source.referenceModel)};active.current=job;setBusy(true);
  const current=()=>alive.current&&active.current===job&&useEditor.getState().project.id===job.projectId&&sameModelGeometry(useEditor.getState().project.referenceModel,job.model);
  try{
   requireIdle();const {readModelWalls}=await import('../lib/modelImport');if(!current())return;
   const result=await readModelWalls(job.model);if(!current())return;requireIdle();const state=useEditor.getState();
   if(result.unresolvedFloor)throw new Error('모델의 바닥을 편집 가능한 경계로 변환하지 못했습니다. 원본 전시장과 기존 작업을 유지합니다. 3D 참고 모델로 계속 사용할 수 있습니다.');
   adoptModelSpace(state.project,result.walls,result.importedFloor);
   downloadBlob(new Blob([JSON.stringify(state.project)],{type:'application/json'}),`${state.project.name}-모델전환전.json`);
   if(!current())return;requireIdle();const before=useEditor.getState().project;
   // The synchronous adoption intentionally changes the guarded space itself.
   active.current=null;
   useEditor.getState().adoptModelWalls(result.walls,job.model,result.importedFloor);if(alive.current)setBusy(false);
   if(alive.current&&useEditor.getState().project.id===job.projectId&&useEditor.getState().project!==before)useEditor.getState().notify(`모델에서 벽 ${result.walls.length}개를 가져왔습니다. 기존 작품은 미배치 목록에 보관했습니다.`);
  }catch(error){if(current())useEditor.getState().notify(error instanceof Error?error.message:'모델 벽을 읽지 못했습니다.');}finally{if(alive.current&&active.current===job){active.current=null;setBusy(false);}}
 }
 const update=(patch:Partial<typeof model>)=>patchProject({referenceModel:{...model,...patch}});
 return <section style={hidden?{display:'none'}:undefined} className="reference-model-controls" aria-label="3D 참고 모델">
 <strong>3D 참고 모델</strong><span>{model.name}</span>
 <label><input type="checkbox" checked={model.visible} onChange={e=>update({visible:e.target.checked})}/> 모델 표시</label>
 <small>{model.sizeMm.map(value=>formatLength(value*model.scale)).join(' × ')}</small>
 <details><summary>모델 위치·크기</summary>
 {(['X','높이','Z'] as const).map((name,index)=><NumberField key={name} label={`모델 ${name} 위치`} value={model.positionMm[index]} step={100} min={-1e7} max={1e7} onChange={value=>{const position:[number,number,number]=[...model.positionMm];position[index]=value;update({positionMm:position});}}/>)}
 <label>회전<input type="number" aria-label="모델 회전" value={model.rotationDeg} min={-180} max={180} step={15} onChange={e=>{const rotationDeg=Number(e.target.value);if(Number.isFinite(rotationDeg)&&Math.abs(rotationDeg)<=180)update({rotationDeg});}}/>°</label>
 <label>크기<input type="number" aria-label="모델 크기 배율" value={Math.round(model.scale*100)} min={1} max={10000} onChange={e=>{const scale=Number(e.target.value)/100;if(Number.isFinite(scale)&&scale>=.01&&scale<=100)update({scale});}}/>%</label>
 </details>
 <button className="button secondary" disabled={busy} onClick={()=>void convert()}>{busy?'벽 형상 분석 중…':'모델 벽으로 공간 만들기'}</button>
 <small>닫힌 직선 벽과 바닥을 추출해 작품 설치 공간으로 만듭니다. 바닥을 변환할 수 없으면 원본 공간을 그대로 유지합니다. 전환 시 기존 작업은 JSON으로 백업하고 원본 모델은 숨겨 보관합니다. 곡면·문이 뚫린 벽·설비 등은 자동 변환하지 않습니다. 모델 줄자 점은 고정 좌표입니다.</small>
 <details><summary>전시장 모델 메모</summary><NoteEditor key={project.id+"-reference-note"} target={{type:"referenceModel"}} label="전시장 NOTE"/></details>
 <button className="button secondary" onClick={()=>patchProject({referenceModel:undefined})}>참고 모델 제거</button>
 </section>;
}
