import {useEffect,useRef} from 'react';
import {Box,FolderOpen,ImagePlus,X} from 'lucide-react';

export function ImportDialog({onClose,onFile}:{onClose:()=>void;onFile:(file:File)=>void}){
 const dialog=useRef<HTMLDialogElement>(null),plan=useRef<HTMLInputElement>(null),project=useRef<HTMLInputElement>(null),model=useRef<HTMLInputElement>(null);
 useEffect(()=>{dialog.current?.showModal();},[]);
 function chosen(event:React.ChangeEvent<HTMLInputElement>){
  const file=event.currentTarget.files?.[0];event.currentTarget.value='';
  if(file){onClose();onFile(file);}
 }
 return <dialog ref={dialog} className="export-dialog" aria-label="도면·모델 불러오기" onCancel={onClose}>
  <div className="dialog-header"><div><h2>도면·모델 불러오기</h2><p>평면 도면이나 SketchUp에서 내보낸 3D 공간을 가져오세요.</p></div><button className="icon-button" aria-label="불러오기 닫기" onClick={onClose}><X size={18}/></button></div>
  <button className="export-option" onClick={()=>plan.current?.click()}><ImagePlus size={23}/><span><strong>도면 불러오기</strong><small>JPG · PNG · PDF — 평면도에 배치하고 벽 초안을 만듭니다.</small></span></button>
  <button className="export-option" onClick={()=>model.current?.click()}><Box size={23}/><span><strong>SketchUp / 3D 모델 불러오기</strong><small>GLB · 12MB 이하 — 내보낸 3D 공간을 원래 크기로 가져옵니다.</small><small>가져온 뒤 공간 목록에서 직선 벽·바닥을 편집 가능한 구조로 전환할 수 있습니다.</small></span></button>
  <p className="dialog-footnote">SketchUp에서 파일 → 내보내기 → 3D 모델 → GLTF Binary File (*.glb)를 선택하세요. GLB 내보내기가 없는 버전은 평면도를 JPG·PNG·PDF로 가져올 수 있습니다. .skp 원본 직접 입력은 아직 지원하지 않습니다. <a href="https://help.sketchup.com/en/sketchup/working-gltf-files" target="_blank" rel="noopener noreferrer">SketchUp 내보내기 안내</a></p>
  <hr className="import-divider"/>
  <button className="export-option" onClick={()=>project.current?.click()}><FolderOpen size={23}/><span><strong>저장 프로젝트 불러오기</strong><small>프로젝트 백업 ZIP · JSON — 자산·벽·작품·Scene을 복원합니다.</small><small>백업 ZIP은 압축을 풀 필요가 없습니다. 이전 작업은 JSON으로 백업합니다.</small></span></button>
  <input ref={plan} hidden type="file" aria-label="도면 파일" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" onChange={chosen}/>
  <input ref={project} hidden type="file" aria-label="저장 프로젝트 파일" accept=".json,.zip,application/json,application/zip" onChange={chosen}/>
  <input ref={model} hidden type="file" aria-label="3D 모델 파일" accept=".glb,model/gltf-binary" onChange={chosen}/>
 </dialog>;
}
