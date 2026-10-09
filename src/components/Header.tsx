import {saveEditorDraft} from '../lib/manualSave';
import {AccountDialog} from './AccountDialog';
import {useAuth} from '../state/auth';
import {useCloudSync} from '../state/cloudSync';
import {ProjectNotesDialog} from './ProjectNotesDialog';
import {ProjectsDialog} from './ProjectsDialog';
import {copyProject} from '../domain/projects';
import { Box, Check, Download, FolderOpen, LoaderCircle, TriangleAlert, Share2, Presentation, NotebookPen, ClipboardCheck, Save } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useEditor,saveCurrentDraft } from '../state/editor';
import { downloadBlob } from '../lib/art';
import {ImportDialog} from './ImportDialog';
import { parseProject } from '../domain/model';
export function Header({ onExport,onShare,onPlanImport,onInstallation,onPresentation }: { onPresentation:()=>void; onInstallation:()=>void;onPlanImport:(file:File)=>void;onExport: () => void;onShare:()=>void }) {
  const { project, renameProject, saveStatus, loadProject, notify, hydrated } = useEditor();
  const auth=useAuth(),cloud=useCloudSync(s=>s.current),[accountOpen,setAccountOpen]=useState(false);
  const cloudStatus=cloud?.projectId===project.id&&cloud.userId===auth.user?.id?cloud:null;
  const [importOpen,setImportOpen]=useState(false),[notesOpen,setNotesOpen]=useState(false),[projectsOpen,setProjectsOpen]=useState(false);
  const [renaming, setRenaming] = useState(false);
  const [importing,setImporting]=useState(false);
  const importVersion=useRef(0),alive=useRef(false),activeImport=useRef<{version:number;projectId:string}|null>(null);
  function retireImport(){importVersion.current++;activeImport.current=null;}
  useEffect(()=>{alive.current=true;const unsubscribe=useEditor.subscribe((next,previous)=>{
    if(next.project.id===previous.project.id||activeImport.current?.projectId===next.project.id)return;
    retireImport();setImporting(false);setImportOpen(false);
  });return()=>{alive.current=false;retireImport();unsubscribe();};},[]);
  function requireIdle(){const state=useEditor.getState();if(!state.hydrated)throw new Error('저장된 작업을 불러온 뒤 파일을 선택해주세요.');if(state.previewProject||state.wallGesture||state.artworkGesture||state.lightGesture||state.modelArtworkGesture||state.outdoorGesture||state.rotatingArtworkId)throw new Error('이동·회전을 마친 뒤 파일을 불러오세요.');}

  async function importFile(f: File) {
    if(!alive.current||activeImport.current)return;
    const operation={version:++importVersion.current,projectId:useEditor.getState().project.id};activeImport.current=operation;setImporting(true);
    const current=()=>alive.current&&activeImport.current===operation&&importVersion.current===operation.version&&useEditor.getState().project.id===operation.projectId;
    const progress=(message:string)=>{if(current())notify(message);};
    try {
      requireIdle();
      if (/\.glb$/i.test(f.name)) {
        const state=useEditor.getState();
        if(state.project.planDraft&&!state.project.planReference?.calibrated)throw new Error('도면 축척을 보정한 뒤 실제 크기의 3D 모델을 가져오세요.');
        notify('3D 모델을 읽고 있습니다…');
        const {readModelFile}=await import('../lib/modelImport');
        if(!current())return;
        const model=await readModelFile(f);
        if(!current())return;requireIdle();
        const editor=useEditor.getState();
        if(editor.project.planDraft&&!editor.project.planReference?.calibrated)throw new Error('도면 축척을 먼저 보정해주세요.');
        editor.patchProject({referenceModel:model});editor.setView('3d');editor.setTool('select');
        notify('3D 참고 모델을 가져왔습니다. 원본 크기를 유지하며 바닥 중앙에 놓았습니다.');return;
      }
      if (/\.(jpe?g|png|pdf)$/i.test(f.name)) { onPlanImport(f); return; }
      if (/\.skp$/i.test(f.name)) throw new Error('스케치업 .skp 원본은 아직 지원하지 않습니다. 3D 모델은 GLB로 내보내거나, 평면도를 JPG·PNG·PDF로 내보낸 뒤 불러오세요.');
      if (!/\.(json|zip)$/i.test(f.name)) throw new Error('도면 JPG·PNG·PDF, 3D 모델 GLB 또는 저장 프로젝트 JSON·백업 ZIP을 선택해주세요.');
      if (f.size > 80 * 1024 * 1024) throw new Error('프로젝트 파일은 80MB 이하로 선택해주세요.');
      const isBackup=/\.zip$/i.test(f.name);
      notify(isBackup?'프로젝트 백업을 검사하고 있습니다…':'프로젝트를 읽고 있습니다…');
      let data:ReturnType<typeof parseProject>;
      if(isBackup){const {readProjectBackup}=await import('../lib/projectBackup');if(!current())return;data=await readProjectBackup(f,progress);}
      else{data=parseProject(JSON.parse(await f.text()));if(!current())return;const {verifyProjectBackupImages}=await import('../lib/projectBackup');if(!current())return;await verifyProjectBackupImages(data,progress);}
      if(!current())return;requireIdle();
      // Saving this exact draft also rejects edits made while its write is pending.
      await saveCurrentDraft();if(!current())return;requireIdle();
      const previous=useEditor.getState().project,next=copyProject(data,data.name);
      downloadBlob(new Blob([JSON.stringify(previous)], { type: 'application/json' }), `${previous.name}-이전작업.json`);
      // This one deliberate ID transition belongs to the import. Other project
      // transitions still retire it synchronously, including batched A→B→A.
      operation.projectId=next.id;loadProject(next);
      if(!current())return;await saveCurrentDraft();if(!current())return;
      notify('프로젝트를 새 항목으로 불러왔습니다. 이전 작업은 목록과 백업 파일에 보존됩니다.');
    } catch (e) { if(current())notify(e instanceof Error ? e.message : '프로젝트를 읽지 못했습니다.'); }
    finally{if(current()){activeImport.current=null;setImporting(false);}}
  }
  return <><header className="header"><div className="brand"><Box size={31} strokeWidth={1.35} /><span>공간</span></div><div className="project-heading">{renaming ? <input aria-label="프로젝트 이름" autoFocus defaultValue={project.name} onBlur={e => { renameProject(e.target.value.trim() || project.name); setRenaming(false); }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} /> : <button className="project-title" onClick={() => setRenaming(true)} title="프로젝트 이름 변경">{project.name}</button>}<span>{project.venue||'전시장 미지정'}</span></div><div className="header-actions"><button className="button secondary" aria-label="프로젝트 목록" disabled={!useEditor.getState().hydrated||importing} onClick={()=>setProjectsOpen(true)}><FolderOpen size={16}/><span>프로젝트</span></button><button className="button secondary" aria-label="계정" onClick={()=>setAccountOpen(true)}>계정</button>{cloudStatus&&<span className="cloud-save-state" role="status">{cloudStatus.status==='saved'?'클라우드 저장됨':cloudStatus.status==='saving'?'클라우드 저장 중':cloudStatus.status==='conflict'?'클라우드 충돌':'클라우드 저장 대기'}</span>}<span className={`save-state ${saveStatus === 'error' ? 'error' : ''}`} role="status">{saveStatus === 'saved' ? <Check size={15} /> : saveStatus === 'error' ? <TriangleAlert size={15} /> : <LoaderCircle size={15} className="spin" />}{saveStatus === 'saved' ? '로컬 저장됨' : saveStatus === 'error' ? '저장 오류' : saveStatus === 'loading' ? '불러오는 중' : '저장 중'}</span><button className="icon-button" aria-label="로컬 저장" title="로컬 저장 · ⌘/Ctrl+S" disabled={!hydrated||importing||!!useEditor.getState().previewProject} onClick={()=>void saveEditorDraft()}><Save size={17}/></button><button className="button secondary" aria-label={importing?'불러오는 중':'도면·3D 불러오기'} disabled={importing} title="도면 JPG·PNG·PDF, 3D 모델 GLB 또는 저장 프로젝트 JSON·백업 ZIP 불러오기" onClick={() => setImportOpen(true)}>{importing?<LoaderCircle size={16} className="spin"/>:<FolderOpen size={16} />}<span>{importing?'불러오는 중':'도면·3D 불러오기'}</span></button><button className="button secondary presentation-entry" title="발표 모드" aria-label="발표 모드" disabled={!hydrated} onClick={onPresentation}><Presentation size={16}/><span>발표</span></button><button className="button secondary installation-entry" title="현장 설치 모드" aria-label="현장 설치 모드" onClick={onInstallation}><ClipboardCheck size={16}/><span>현장 설치</span></button><button className="button secondary" aria-label="프로젝트 메모" onClick={()=>setNotesOpen(true)}><NotebookPen size={16}/><span>메모</span></button><button className="button secondary" aria-label="공유" onClick={onShare}><Share2 size={16}/><span>공유</span></button><button className="button primary" aria-label="내보내기" onClick={onExport}><Download size={16} /><span>내보내기</span></button></div></header>{accountOpen&&<AccountDialog onClose={()=>setAccountOpen(false)}/>} {projectsOpen&&<ProjectsDialog onClose={()=>setProjectsOpen(false)}/>} {notesOpen&&<ProjectNotesDialog onClose={()=>setNotesOpen(false)}/>} {importOpen&&<ImportDialog onClose={()=>setImportOpen(false)} onFile={f=>void importFile(f)}/>}</>;
}
