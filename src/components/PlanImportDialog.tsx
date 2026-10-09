import {useProjectDialogScope} from './useProjectDialogScope';
import {useEditor} from '../state/editor';
import {selectPlanPage} from '../lib/selectPlanPage';
import {adoptPlanDraft} from '../domain/editablePlanDraft';
import {AutomaticVenuePreview} from './AutomaticVenuePreview';
import type {Project} from '../domain/types';
import {PlanAutoAnalysis} from './PlanAutoAnalysis';
import { useEffect, useRef, useState } from 'react';
import { PlanRegionEditor } from './PlanRegionEditor';
import { loadPlanFile } from '../lib/planImport';
type Loaded = Awaited<ReturnType<typeof loadPlanFile>>;
type Rendered = Awaited<ReturnType<Loaded['renderPage']>>;
export function PlanImportDialog({file,existingProject,onClose,onImport,onAdopt}:{file:File;existingProject:Project;onAdopt:(project:Project)=>void;onClose:()=>void;onImport:(image:Rendered)=>void}) {
 const [loadedFile,setLoadedFile]=useState<{file:File;document:Loaded}|null>(null),[page,setPage]=useState(0),[rawPreview,setPreview]=useState<Rendered|null>(null),[previewFile,setPreviewFile]=useState<File|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(true);
 const document=loadedFile?.file===file?loadedFile.document:null,preview=previewFile===file?rawPreview:null;
 const scope=useProjectDialogScope(existingProject.id,onClose),input=useRef(file);input.current=file;
 const canApply=()=>input.current===file&&previewFile===file&&scope.begin()!==undefined&&!busy&&!reading;
 const [detail,setDetail]=useState(false),[magnified,setMagnified]=useState(false);
 const [reading,setReading]=useState(false);
 const [selectionNote,setSelectionNote]=useState(''),[stage,setStage]=useState(''),[resolvedPage,setResolvedPage]=useState(1);
 const [source,setSource]=useState<Rendered|null>(null),[editing,setEditing]=useState(false);
 const differentUnscaledDraft=!!existingProject.planDraft&&!existingProject.planReference?.calibrated&&!!preview&&(existingProject.planImageUrl!==preview.imageUrl||existingProject.planReference?.widthPx!==preview.widthPx||existingProject.planReference?.heightPx!==preview.heightPx);
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{dialog.current?.showModal();},[]);
 const generation=useRef(0);
 useEffect(()=>{
  let cancelled=false,loaded:Loaded|undefined;const version=scope.begin();
  const current=()=>!cancelled&&input.current===file&&version!==undefined&&scope.current(version);
  const dispose=(value:Loaded)=>{void value.destroy().catch(()=>{/* Document disposal is best effort. */});};
  setLoadedFile(null);setPreview(null);setPreviewFile(null);setSource(null);setPage(0);setDetail(false);setEditing(false);setMagnified(false);setReading(false);setBusy(true);setError('');setSelectionNote('');setStage('도면을 불러오는 중입니다…');
  if(version!==undefined)void loadPlanFile(file).then(value=>{loaded=value;if(!current()){dispose(value);return;}setLoadedFile({file,document:value});}).catch(e=>{if(current()){setError(e instanceof Error?e.message:'도면을 읽지 못했습니다.');setBusy(false);}});
  return()=>{cancelled=true;generation.current++;if(loaded)dispose(loaded);};
 },[file]);
 useEffect(()=>{if(!document)return;const version=scope.begin();if(version===undefined)return;const revision=++generation.current,c=new AbortController();const current=()=>!c.signal.aborted&&revision===generation.current&&input.current===file&&scope.current(version);setBusy(true);setPreview(null);setError('');setSelectionNote('');setStage('도면을 불러오는 중입니다…');
 const run=async()=>{
  if(page===0&&document.pageCount>1){const result=await selectPlanPage(document,c.signal,message=>{if(current())setStage(message);},detail);if(!current())return null;setResolvedPage(result.pageNumber);setSelectionNote(`${result.inspected}페이지를 분석해 ${result.pageNumber}페이지를 선택했습니다. ${result.verified?'공간 생성 검증을 통과했습니다.':'아직 공간을 확정하지 못해 구조 근거가 가장 많은 후보를 표시합니다.'}${result.failures.length?` 읽기·분석 시도 ${result.failures.length}건은 완료하지 못했습니다.`:''}`);return result.page;}
  const number=page||1;setResolvedPage(number);return document.renderPage(number,detail);
 };
 void run().then(value=>{if(value&&current()){setPreviewFile(file);setPreview(value);setSource(value);setEditing(false);}}).catch(e=>{if(current())setError(e instanceof Error?e.message:'도면 페이지를 읽지 못했습니다.');}).finally(()=>{if(current())setBusy(false);});return()=>{c.abort();};},[document,page,detail]);
 return <dialog ref={dialog} onCancel={onClose} className="export-dialog plan-import-dialog" aria-label="도면 가져오기"><h2>도면 가져오기</h2><p>{file.name}</p>{document&&document.pageCount>1&&<label>PDF 페이지 <select aria-label="PDF 페이지" value={page} disabled={busy||reading} onChange={e=>setPage(Number(e.target.value))}><option value={0}>자동 선택</option>{Array.from({length:document.pageCount},(_,i)=><option key={i} value={i+1}>{i+1} / {document.pageCount}</option>)}</select></label>}{document&&(file.type==='application/pdf'||/\.pdf$/i.test(file.name))&&<label className="detail-toggle"><input type="checkbox" checked={detail} disabled={busy||reading} onChange={e=>setDetail(e.target.checked)}/>고해상도 렌더 (PDF 최대 4800px)</label>}{busy&&<p role="status">{stage}</p>}{selectionNote&&<p role="status">{selectionNote}</p>}{error&&<p role="alert">{error}</p>}{preview&&<><div className="region-actions"><button className="button secondary" disabled={busy||reading} onClick={()=>setEditing(!editing)}>{editing?'미리보기로 돌아가기':'회전 / 영역 선택'}</button><button className="button secondary" disabled={busy||reading||preview===source} onClick={()=>{setPreview(source);setEditing(false);}}>원래 페이지로</button></div>{editing?<PlanRegionEditor key={`${preview.widthPx}-${preview.heightPx}-${preview.imageUrl.length}`} page={preview} onChange={setPreview} onBusy={setBusy}/>:<><div className="preview-actions"><span>{preview.widthPx} × {preview.heightPx}px</span><button className="button secondary" onClick={()=>setMagnified(!magnified)}>{magnified?'페이지 맞춤':'100% 픽셀 확인'}</button></div><div className={magnified?'plan-preview-scroll magnified':'plan-preview-scroll'}><img className="plan-import-preview" style={magnified?{width:preview.widthPx,maxHeight:'none',maxWidth:'none'}:undefined} src={preview.imageUrl} alt={`가져올 도면 ${resolvedPage}페이지`} /></div></>}<PlanAutoAnalysis key={preview.imageUrl} page={preview} onResult={value=>{setPreview(current=>current?.imageUrl===value.imageUrl?value:current);setSource(current=>current?.imageUrl===value.imageUrl?value:current);}} onBusy={setReading}/><AutomaticVenuePreview page={preview} onAdopt={draft=>{if(canApply())onAdopt(adoptPlanDraft(useEditor.getState().project,draft));}} disabled={busy||reading}/>{preview.diagnostics?.warnings.map((warning,i)=><p className="plan-quality-warning" key={i}>{warning}</p>)}<p className="quality-disclaimer">이 안내는 입력 품질 확인용입니다. 벽이나 치수의 인식 정확도를 보장하지 않습니다. 스캔은 확대해도 원본의 흐림이 복원되지 않습니다.</p></>}{differentUnscaledDraft&&<p className="plan-quality-warning">현재 벽은 이전 도면의 px 좌표입니다. 새 도면의 벽 초안을 적용하거나, 기존 초안을 두 점 축척 보정한 뒤 도면만 바꾸세요.</p>}<p>공간 자동 생성이 보류돼도 도면과 인식 결과를 저장할 수 있습니다.</p><div className="dialog-actions"><button className="button secondary" onClick={onClose}>취소</button><button className="button primary" disabled={!preview||busy||reading||differentUnscaledDraft} onClick={()=>{if(preview&&canApply())onImport(preview);}}>이 도면 배치</button></div></dialog>;
}
