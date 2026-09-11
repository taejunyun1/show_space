import { Box, Check, Download, FolderOpen, LoaderCircle, TriangleAlert } from 'lucide-react';
import { useRef, useState } from 'react';
import { useEditor } from '../state/editor';
import { downloadBlob } from '../lib/art';
import { parseProject } from '../domain/model';
export function Header({ onExport }: { onExport: () => void }) {
  const { project, renameProject, saveStatus, loadProject, notify } = useEditor();
  const file = useRef<HTMLInputElement>(null);
  const [renaming, setRenaming] = useState(false);
  async function importFile(f: File) {
    try {
      if (f.size > 80 * 1024 * 1024) throw new Error('프로젝트 파일은 80MB 이하로 선택해주세요.');
      const data = parseProject(JSON.parse(await f.text()));
      // Keep a recoverable copy before replacing a local draft.
      downloadBlob(new Blob([JSON.stringify(project)], { type: 'application/json' }), `${project.name}-이전작업.json`);
      loadProject(data); notify('프로젝트를 불러왔습니다. 이전 작업은 파일로 백업했습니다.');
    } catch (e) { notify(e instanceof Error ? e.message : '프로젝트를 읽지 못했습니다.'); }
  }
  return <header className="header"><div className="brand"><Box size={31} strokeWidth={1.35} /><span>공간</span></div><div className="project-heading">{renaming ? <input aria-label="프로젝트 이름" autoFocus defaultValue={project.name} onBlur={e => { renameProject(e.target.value.trim() || project.name); setRenaming(false); }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} /> : <button className="project-title" onClick={() => setRenaming(true)} title="프로젝트 이름 변경">{project.name}</button>}<span>{project.venue} · 첫 번째 전시</span></div><div className="header-actions"><span className={`save-state ${saveStatus === 'error' ? 'error' : ''}`} role="status">{saveStatus === 'saved' ? <Check size={15} /> : saveStatus === 'error' ? <TriangleAlert size={15} /> : <LoaderCircle size={15} className="spin" />}{saveStatus === 'saved' ? '로컬 저장됨' : saveStatus === 'error' ? '저장 오류' : saveStatus === 'loading' ? '불러오는 중' : '저장 중'}</span><button className="button secondary" onClick={() => file.current?.click()}><FolderOpen size={16} /><span>불러오기</span></button><button className="button primary" onClick={onExport}><Download size={16} /><span>내보내기</span></button><input ref={file} type="file" accept=".json,application/json" hidden onChange={e => { const f = e.target.files?.[0]; if (f) void importFile(f); e.currentTarget.value = ''; }} /></div></header>;
}
