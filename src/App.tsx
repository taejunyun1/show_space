import { useEffect, useRef, useState } from 'react';
import { Undo2, Redo2, X, CircleHelp } from 'lucide-react';
import { useEditor, hydrateEditor, startAutosave } from './state/editor';
import { Header } from './components/Header';
import { Outliner } from './components/Outliner';
import { Inspector } from './components/Inspector';
import { Workspace } from './components/Workspace';
import { ExportDialog } from './components/ExportDialog';
import { IconButton } from './components/Controls';
export default function App() {
  const { selected, undo, redo, past, future, message, notify } = useEditor();
  const [exportOpen, setExportOpen] = useState(false), [help, setHelp] = useState(false);
  const capture = useRef<(() => void) | null>(null);
  useEffect(() => { const stop = startAutosave(); void hydrateEditor(); return stop; }, []);
  useEffect(() => {
    function keyboard(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      if (el.closest('input,textarea,select,[contenteditable="true"],dialog')) return;
      const state = useEditor.getState(), mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) state.redo(); else state.undo(); }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); state.redo(); }
      if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); state.duplicateSelected(); }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); state.deleteSelected(); }
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); setExportOpen(true); }
    }
    window.addEventListener('keydown', keyboard); return () => window.removeEventListener('keydown', keyboard);
  }, []);
  function exportPng() {
    const state = useEditor.getState();
    if (state.view !== '3d') { state.setView('3d'); state.notify('3D 화면으로 전환했습니다. 내보내기에서 이미지를 저장해주세요.'); return; }
    if (capture.current) capture.current(); else state.notify('3D 화면을 불러온 뒤 다시 시도해주세요.');
  }
  return <div className="app"><Header onExport={() => setExportOpen(true)} /><div className="editor-body"><Outliner /><Workspace captureRef={capture} /><Inspector /></div><footer className="status-bar"><div><span>{selected.length}개 객체 선택됨</span><span className="status-divider" /><span>실제 치수 기준 · mm</span></div><div className="footer-actions"><span className="local-version">로컬 편집기 0.3</span><IconButton label="되돌리기" disabled={past.length === 0} onClick={undo}><Undo2 size={16} /></IconButton><IconButton label="다시 실행" disabled={future.length === 0} onClick={redo}><Redo2 size={16} /></IconButton><span className="status-divider" /><IconButton label="사용 방법" active={help} onClick={() => setHelp(!help)}><CircleHelp size={16} /></IconButton></div></footer>{help && <div className="help-popover"><strong>빠르게 시작하기</strong><p>1. 작품을 선택하고 오른쪽에서 실제 크기를 입력하세요.</p><p>2. 벽면도에서 작품을 끌어 배치하세요.</p><p>3. Shift로 여러 작품을 선택해 간격을 맞추세요.</p><p>4. Scene으로 배치안을 저장하고 비교하세요.</p><small>⌘ / Ctrl + Z 되돌리기 · D 복제 · S 내보내기<br />평면도 끝점 드래그 · 3D 드래그 회전 / 휠 확대</small></div>}{message && <div className="toast" role="status"><span>{message}</span><button className="icon-button" aria-label="알림 닫기" onClick={() => notify(null)}><X size={15} /></button></div>}{exportOpen && <ExportDialog onClose={() => setExportOpen(false)} onPng={exportPng} />}</div>;
}
