import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Undo2, Redo2, X, CircleHelp } from 'lucide-react';
import { useEditor, hydrateEditor, startAutosave } from './state/editor';
import { Header } from './components/Header';
import { Outliner } from './components/Outliner';
import { Inspector } from './components/Inspector';
import { Workspace } from './components/Workspace';
import { ExportDialog } from './components/ExportDialog';
import { IconButton } from './components/Controls';
import {ShareDialog} from './components/ShareDialog';
import type {CameraView3D} from './components/cameraView3d';
const PdfDialog=lazy(()=>import('./components/PdfDialog'));
export default function App() {
  const { project, selected, undo, redo, past, future, message, notify } = useEditor();
  const [exportOpen, setExportOpen] = useState(false), [help, setHelp] = useState(false),[shareOpen,setShareOpen]=useState(false);
  const [pdfOpen,setPdfOpen]=useState(false);
  const [incomingPlan,setIncomingPlan]=useState<File|null>(null);
  const capture = useRef<(() => void) | null>(null);
  const cameraGetter=useRef<(()=>CameraView3D)|null>(null);
  useEffect(() => { const stop = startAutosave(); void hydrateEditor(); return stop; }, []);
  useEffect(() => {
    function keyboard(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      if (el.closest('input,textarea,select,[contenteditable="true"],dialog')) return;
      const state = useEditor.getState(), mod = e.metaKey || e.ctrlKey;
      if (e.key === 'Escape') { e.preventDefault(); if(state.lightGesture)state.finishLightMove(true);else if(state.wallGesture)state.finishWallTransform(true); else if(state.artworkGesture)state.finishArtworkDrag(true); else state.setTool('select'); return; }
      if (!mod && !e.altKey && !e.shiftKey && e.key.toLowerCase()==='m') { e.preventDefault(); state.setTool('move'); return; }
      if (!mod && !e.altKey && !e.shiftKey && e.key.toLowerCase()==='h') { e.preventDefault(); state.setTool('pan'); return; }
      if (!mod && !e.altKey && !e.shiftKey && e.key.toLowerCase()==='q') { e.preventDefault(); state.setTool('rotate'); return; }
      if (!mod && !e.altKey && !e.shiftKey && e.key.toLowerCase()==='v') { e.preventDefault(); state.setTool('select'); return; }
      if (!mod && !e.altKey && !e.shiftKey && e.key.toLowerCase()==='w') { e.preventDefault(); state.setView('plan'); state.setTool('draw'); return; }
      if (!mod && !e.altKey && !e.shiftKey && e.key.toLowerCase()==='t') { e.preventDefault(); state.setTool('measure'); return; }
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) state.redo(); else state.undo(); }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); state.redo(); }
      if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); state.duplicateSelected(); }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); state.deleteSelected(); }
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); setExportOpen(true); }
    }
    window.addEventListener('keydown', keyboard); return () => window.removeEventListener('keydown', keyboard);
  }, []);
  function exportPng() {
    capture.current?.();
  }
  return <div className="app"><Header onPlanImport={file=>{useEditor.getState().setTool('select');useEditor.getState().setView('plan');setIncomingPlan(file);}} onExport={() => setExportOpen(true)} onShare={()=>setShareOpen(true)}/><div className="editor-body"><Outliner /><Workspace incomingPlan={incomingPlan} onPlanReceived={()=>setIncomingPlan(null)} captureRef={capture} cameraGetterRef={cameraGetter}/><Inspector /></div><footer className="status-bar"><div><span>{selected.length}개 객체 선택됨</span><span className="status-divider" /><span>{project.planDraft&&!project.planReference?.calibrated?'도면 축척 미정 · 벽 길이 px':'실제 치수 기준 · mm'}</span></div><div className="footer-actions"><span className="local-version">로컬 편집기 0.3</span><IconButton label="되돌리기" disabled={past.length === 0} onClick={undo}><Undo2 size={16} /></IconButton><IconButton label="다시 실행" disabled={future.length === 0} onClick={redo}><Redo2 size={16} /></IconButton><span className="status-divider" /><IconButton label="사용 방법" active={help} onClick={() => setHelp(!help)}><CircleHelp size={16} /></IconButton></div></footer>{help && <div className="help-popover"><strong>빠르게 시작하기</strong><p>1. 작품을 선택하고 오른쪽에서 실제 크기를 입력하세요.</p><p>2. 3D 또는 벽면도에서 작품을 끌어 배치하세요.</p><p>3. Shift로 여러 벽을 선택해 함께 이동·회전하세요.</p><p>4. 평면도에서 W로 벽을 그리고 끝점을 맞추세요.</p><small>⌘ / Ctrl + Z 되돌리기 · D 복제 · S 내보내기<br />H 손 도구 · M 벽 이동 · Q 벽 회전 · W 벽 그리기 · T 줄자 · V 선택 · Esc 취소<br />손 도구 드래그 시점 이동 / 빈 3D 공간 드래그 시점 회전 / 휠 확대</small></div>}{message && <div className="toast" role="status"><span>{message}</span><button className="icon-button" aria-label="알림 닫기" onClick={() => notify(null)}><X size={15} /></button></div>}{exportOpen && <ExportDialog onClose={() => setExportOpen(false)} onPng={exportPng} onPdf={()=>setPdfOpen(true)} />}{pdfOpen&&<Suspense fallback={null}><PdfDialog onClose={()=>setPdfOpen(false)} getCamera={()=>{const view=cameraGetter.current?.(),box=document.querySelector('.viewport-stage')?.getBoundingClientRect();return useEditor.getState().view==='3d'&&view&&box&&box.width>0&&box.height>0?{view,width:box.width,height:box.height,cutaway:!!document.querySelector<HTMLInputElement>('.cutaway-toggle input')?.checked}:undefined;}}/></Suspense>}{shareOpen&&<ShareDialog project={project} onClose={()=>setShareOpen(false)} getCamera={()=>cameraGetter.current?.()??null}/>}</div>;
}
