import {useEditor} from '../state/editor';
export function ReferenceModelControls(){
 const {project,patchProject}=useEditor(),model=project.referenceModel;if(!model)return null;
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
 <small>형상은 참고용입니다. 작품 설치 벽은 별도로 편집합니다. 모델의 줄자 점은 고정 좌표입니다.</small>
 <button className="button secondary" onClick={()=>patchProject({referenceModel:undefined})}>참고 모델 제거</button>
 </section>;
}
