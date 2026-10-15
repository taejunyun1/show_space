import {useOutputJob} from './useOutputJob';
import {modelExportOmissionNotice} from '../domain/modelExportScope';
import {X,FileJson,FileText,Image,Download,Box,Files,LoaderCircle} from 'lucide-react';
import {useEffect,useRef} from 'react';
import {useEditor} from '../state/editor';
import {downloadBlob} from '../lib/art';
import {MODEL_MAX_BYTES} from '../lib/glbPayload';

export function ExportDialog({onClose,onPng,onPdf}:{onClose:()=>void;onPng:()=>void;onPdf:()=>void}){
 const project=useEditor(s=>s.project),omission=modelExportOmissionNotice(project),ref=useRef<HTMLDialogElement>(null);
 const job=useOutputJob(project.id,onClose),{busy,progress,error,notice}=job;
 useEffect(()=>{ref.current?.showModal();},[]);
 async function exportBackup(){await job.run(async(signal,report)=>{
  report('프로젝트 백업 준비 중');const {exportProjectBackup}=await import('../lib/projectBackup');signal.throwIfAborted();return exportProjectBackup(project,report);
 },blob=>{downloadBlob(blob,`${project.name}.gonggan.zip`);useEditor.getState().notify('자산을 포함한 프로젝트 백업을 저장했습니다. 불러오기에서 ZIP을 선택해 복원하세요.');onClose();});}
 async function exportModel(format:'glb'|'gltf'='glb'){await job.run(async(signal,report)=>{
  report('3D 모델 준비 중');const {exportProjectGlb,exportProjectGltf}=await import('../lib/modelExport');signal.throwIfAborted();return (format==='glb'?exportProjectGlb:exportProjectGltf)(project,report);
 },blob=>{
  downloadBlob(blob,`${project.name}.${format==='glb'?'glb':'gltf.zip'}`);
  const delivered=format==='gltf'?'glTF ZIP 다운로드를 시작했습니다. 압축을 풀고 scene.gltf를 여세요.':blob.size>MODEL_MAX_BYTES?'GLB를 저장했습니다. 파일이 12MB를 넘어 현재 앱에서는 다시 불러올 수 없습니다.':'벽·바닥·작품을 GLB로 저장했습니다.';useEditor.getState().notify(delivered+(omission?' '+omission:''));onClose();
 });}
 return <dialog ref={ref} className="export-dialog" onCancel={()=>job.dismiss()} onClick={e=>{if(e.target===e.currentTarget)job.dismiss();}}>
  <div className="dialog-header"><div><h2>전시안 내보내기</h2><p>작업을 보관하거나 이미지·PDF·3D 모델로 남기세요.</p></div><button className="icon-button" onClick={job.dismiss} aria-label="닫기"><X size={18}/></button></div>
  <button className="export-option" disabled={busy} onClick={()=>void exportBackup()}><Files size={25}/><span><strong>프로젝트 자산 백업</strong><small>모든 Scene · 조명·야외 시간 · 도면 이미지 · 숨긴/미배치 작품 · 영상 원본 · 3D 작품 · 참고 모델 · ZIP</small><small>메모와 편집 데이터 포함 · 다른 브라우저에서 그대로 복원</small></span><Download size={18}/></button>
  <button className="export-option" disabled={busy} onClick={()=>{downloadBlob(new Blob([JSON.stringify(project,null,2)],{type:'application/json'}),`${project.name}.json`);onClose();}}><FileJson size={25}/><span><strong>프로젝트 파일</strong><small>치수, 메모, 조명·야외 시간, Scene과 등록 자산 · JSON · 예제 이미지는 웹 경로 참조</small></span><Download size={18}/></button>
  <button className="export-option" disabled={busy} onClick={()=>{onClose();onPng();}}><Image size={25}/><span><strong>현재 화면 이미지</strong><small>3D·평면도·벽면도를 옵션과 해상도로 저장 · PNG</small></span><Download size={18}/></button>
  <button className="export-option" disabled={busy} onClick={()=>{onClose();onPdf();}}><FileText size={25}/><span><strong>전시안 PDF</strong><small>배치안 선택 · 3D·평면·벽면도 · 한글 · 치수 목록</small></span><Download size={18}/></button>
  {omission&&<p className="warning" role="note">{omission}</p>}
  <button className="export-option" disabled={busy} onClick={()=>void exportModel()}><Box size={25}/><span><strong>3D 모델</strong><small>표시 중인 벽·바닥·작품·원본 모델 · 실제 크기 · GLB</small><small>작품 이미지·Spot·태양 포함 · 프로젝터 투사·Area·환경·시간 설정 제외</small></span>{busy?<LoaderCircle className="spin" size={18}/>:<Download size={18}/>}</button>
  <button className="export-option" disabled={busy} onClick={()=>void exportModel('gltf')}><Files size={25}/><span><strong>glTF 파일 묶음</strong><small>다른 3D 프로그램 전달용 · glTF + 바이너리 + 이미지 · ZIP</small><small>포함·제외 항목과 치수 단위 안내 포함</small></span><Download size={18}/></button>
  {busy&&<><p className="dialog-footnote" role="status" aria-live="polite">{progress}</p><button className="button secondary" onClick={job.cancel}>생성 취소</button></>}{notice&&<p role="status">{notice}</p>}
  {error&&<p className="warning" role="alert">{error}</p>}
  <p className="dialog-footnote">작업 전체와 자산을 옮기려면 프로젝트 자산 백업을 사용하세요. 저장되지 않은 원본 업로드 PDF/JPG 파일과 Undo 기록은 포함하지 않습니다. GLB·glTF·PDF의 영상 스크린은 썸네일 정지 화면입니다. 영상 원본은 JSON·프로젝트 자산 백업에 보존됩니다. 프로젝터 투사는 PNG·PDF 3D 이미지에 포함되며 GLB·glTF에는 포함되지 않습니다. 프로젝터 설정·이미지는 JSON·자산 백업에 보존됩니다. GLB·glTF는 현재 배치의 3D 전달용입니다. glTF ZIP은 압축을 풀고 scene.gltf를 여세요. 공간 참고 모델은 GLB, 3D 작품 추가는 정적 GLB·glTF ZIP 12MB 이하를 지원합니다.</p>
 </dialog>;
}
