import {useEffect,useRef} from 'react';
import {Box,FolderOpen,ImagePlus,X} from 'lucide-react';

export function ImportDialog({onClose,onFile}:{onClose:()=>void;onFile:(file:File)=>void}){
 const dialog=useRef<HTMLDialogElement>(null),plan=useRef<HTMLInputElement>(null),project=useRef<HTMLInputElement>(null),model=useRef<HTMLInputElement>(null);
 useEffect(()=>{dialog.current?.showModal();},[]);
 function chosen(event:React.ChangeEvent<HTMLInputElement>){
  const file=event.currentTarget.files?.[0];event.currentTarget.value='';
  if(file){onClose();onFile(file);}
 }
 return <dialog ref={dialog} className="export-dialog" aria-label="불러오기" onCancel={onClose}>
  <div className="dialog-header"><div><h2>불러오기</h2><p>도면으로 공간을 만들거나 저장한 전시를 이어서 편집하세요.</p></div><button className="icon-button" aria-label="불러오기 닫기" onClick={onClose}><X size={18}/></button></div>
  <button className="export-option" onClick={()=>plan.current?.click()}><ImagePlus size={23}/><span><strong>도면 불러오기</strong><small>JPG · PNG · PDF — 평면도에 배치하고 벽 초안을 만듭니다.</small></span></button>
  <button className="export-option" onClick={()=>project.current?.click()}><FolderOpen size={23}/><span><strong>저장 프로젝트 불러오기</strong><small>프로젝트 백업 ZIP · JSON — 자산·벽·작품·Scene을 복원합니다.</small><small>백업 ZIP은 압축을 풀 필요가 없습니다. 이전 작업은 JSON으로 백업합니다.</small></span></button>
  <button className="export-option" onClick={()=>model.current?.click()}><Box size={23}/><span><strong>3D 모델 불러오기</strong><small>GLB · 12MB 이하 — 스케치업에서 내보낸 모델을 원래 크기로 가져옵니다.</small></span></button>
  <p className="dialog-footnote">스케치업에서 파일 → 내보내기 → 3D 모델 → GLB로 저장하세요. GLB 내보내기가 없는 버전은 평면도를 JPG·PNG·PDF로 가져올 수 있습니다. .skp 원본 입력은 아직 지원하지 않습니다.</p>
  <input ref={plan} hidden type="file" aria-label="도면 파일" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" onChange={chosen}/>
  <input ref={project} hidden type="file" aria-label="저장 프로젝트 파일" accept=".json,.zip,application/json,application/zip" onChange={chosen}/>
  <input ref={model} hidden type="file" aria-label="3D 모델 파일" accept=".glb,model/gltf-binary" onChange={chosen}/>
 </dialog>;
}
