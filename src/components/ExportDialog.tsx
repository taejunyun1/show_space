import {X,FileJson,Image,Download,Box,LoaderCircle} from 'lucide-react';
import {useEffect,useRef,useState} from 'react';
import {useEditor} from '../state/editor';
import {downloadBlob} from '../lib/art';
import {MODEL_MAX_BYTES} from '../lib/glbPayload';

export function ExportDialog({onClose,onPng}:{onClose:()=>void;onPng:()=>void}){
 const project=useEditor(s=>s.project),ref=useRef<HTMLDialogElement>(null);
 const [busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[error,setError]=useState('');
 const exporting=useRef(false);
 useEffect(()=>{ref.current?.showModal();},[]);
 async function exportModel(){
  if(exporting.current)return;exporting.current=true;setBusy(true);setError('');setProgress('3D 모델 준비 중');
  try{
   const {exportProjectGlb}=await import('../lib/modelExport');
   const blob=await exportProjectGlb(project,setProgress);downloadBlob(blob,`${project.name}.glb`);
   useEditor.getState().notify(blob.size>MODEL_MAX_BYTES?'GLB를 저장했습니다. 파일이 12MB를 넘어 현재 앱에서는 다시 불러올 수 없습니다.':'벽·바닥·작품을 GLB로 저장했습니다.');onClose();
  }catch(e){setError(e instanceof Error?e.message:'3D 모델을 내보내지 못했습니다.');}
  finally{exporting.current=false;setBusy(false);setProgress('');}
 }
 return <dialog ref={ref} className="export-dialog" onCancel={e=>{if(exporting.current)e.preventDefault();else onClose();}} onClick={e=>{if(e.target===e.currentTarget&&!exporting.current)onClose();}}>
  <div className="dialog-header"><div><h2>전시안 내보내기</h2><p>작업을 보관하거나 이미지·3D 모델로 남기세요.</p></div><button className="icon-button" disabled={busy} onClick={onClose} aria-label="닫기"><X size={18}/></button></div>
  <button className="export-option" disabled={busy} onClick={()=>{downloadBlob(new Blob([JSON.stringify(project,null,2)],{type:'application/json'}),`${project.name}.json`);onClose();}}><FileJson size={25}/><span><strong>프로젝트 파일</strong><small>작품 이미지, 치수, 메모, Scene을 함께 저장 · JSON</small></span><Download size={18}/></button>
  <button className="export-option" disabled={busy} onClick={()=>{onClose();onPng();}}><Image size={25}/><span><strong>현재 화면 이미지</strong><small>3D·평면도·벽면도를 옵션과 해상도로 저장 · PNG</small></span><Download size={18}/></button>
  <button className="export-option" disabled={busy} onClick={()=>void exportModel()}><Box size={25}/><span><strong>3D 모델</strong><small>표시 중인 벽·바닥·작품·원본 모델 · 실제 크기 · GLB</small><small>작품 이미지 포함 · 이미지 긴 변 최대 1,024px</small></span>{busy?<LoaderCircle className="spin" size={18}/>:<Download size={18}/>}</button>
  {busy&&<p className="dialog-footnote" role="status" aria-live="polite">{progress}</p>}
  {error&&<p className="warning" role="alert">{error}</p>}
  <p className="dialog-footnote">GLB는 현재 배치의 3D 형상과 이미지를 담습니다. 메모·치수선·Scene 보관과 편집 복원에는 프로젝트 파일을 사용하세요. GLB 다시 불러오기는 12MB 이하를 지원합니다.</p>
 </dialog>;
}
