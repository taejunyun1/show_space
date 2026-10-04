import {useEffect,useRef} from 'react';
import {Box,FolderOpen,ImagePlus,X} from 'lucide-react';

export function ImportDialog({onClose,onFile}:{onClose:()=>void;onFile:(file:File)=>void}){
 const dialog=useRef<HTMLDialogElement>(null),plan=useRef<HTMLInputElement>(null),project=useRef<HTMLInputElement>(null),model=useRef<HTMLInputElement>(null);
 useEffect(()=>{dialog.current?.showModal();},[]);
 function chosen(event:React.ChangeEvent<HTMLInputElement>){
  const file=event.currentTarget.files?.[0];event.currentTarget.value='';
  if(file){onClose();onFile(file);}
 }
 return <dialog ref={dialog} className="export-dialog import-dialog" aria-label="도면·3D 불러오기" onCancel={onClose}>
  <div className="dialog-header"><div><h2>도면·3D 불러오기</h2><p>전시장 도면 이미지 또는 3D 공간 파일을 선택하세요.</p></div><button className="icon-button" aria-label="불러오기 닫기" onClick={onClose}><X size={18}/></button></div>
  <button className="export-option" onClick={()=>plan.current?.click()}><ImagePlus size={23}/><span><strong>도면 불러오기</strong><small>JPG · PNG · PDF — 도면을 읽고 벽 초안을 만듭니다.</small><small>이미지 20MB 이하 · PDF 30MB 이하</small></span></button>
  <button className="export-option" onClick={()=>model.current?.click()}><Box size={23}/><span><strong>SketchUp / 3D 모델 불러오기</strong><small>SketchUp에서 내보낸 GLB · 12MB 이하</small><small>전시장 전체를 3D 참고 공간으로 가져옵니다. 직선 벽·바닥은 이후 편집 가능한 구조로 전환할 수 있습니다.</small></span></button>
  <p className="import-format-note">.skp 원본은 직접 열 수 없습니다. SketchUp에서 GLB로 내보낸 파일을 선택하세요.</p>
  <details className="import-help"><summary>SketchUp에서 GLB로 내보내는 방법</summary><ol><li>파일 → 내보내기 → 3D 모델을 엽니다.</li><li>파일 형식에서 GLTF Binary File (*.glb)를 선택해 저장합니다.</li><li>위의 SketchUp / 3D 모델 불러오기에서 파일을 선택합니다.</li></ol><p>GLB 내보내기가 없는 버전은 평면도를 JPG·PNG·PDF로 가져올 수 있습니다. <a href="https://help.sketchup.com/en/sketchup/working-gltf-files" target="_blank" rel="noopener noreferrer">SketchUp 공식 안내</a></p></details>
  <details className="import-backup"><summary><FolderOpen size={16}/>저장 프로젝트 복원 (ZIP · JSON)</summary>
   <p>이 앱에서 저장한 프로젝트 백업을 복원합니다. 도면이나 SketchUp 파일은 위에서 선택하세요.</p>
   <button className="export-option" onClick={()=>project.current?.click()}><FolderOpen size={23}/><span><strong>저장 프로젝트 불러오기</strong><small>백업 ZIP · JSON — 자산·벽·작품·Scene을 복원합니다.</small><small>ZIP은 압축을 풀 필요가 없습니다. 기존 작업은 프로젝트 목록에 보존합니다.</small></span></button>
  </details>
  <input ref={plan} hidden type="file" aria-label="도면 파일" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" onChange={chosen}/>
  <input ref={project} hidden type="file" aria-label="저장 프로젝트 파일" accept=".json,.zip,application/json,application/zip" onChange={chosen}/>
  <input ref={model} hidden type="file" aria-label="3D 모델 파일" accept=".glb,model/gltf-binary" onChange={chosen}/>
 </dialog>;
}
