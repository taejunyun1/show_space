import { X, FileJson, Image, Download } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useEditor } from '../state/editor';
import { downloadBlob } from '../lib/art';
export function ExportDialog({ onClose, onPng }: { onClose: () => void; onPng: () => void }) {
  const project = useEditor(s => s.project);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="export-dialog" onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}><div className="dialog-header"><div><h2>전시안 내보내기</h2><p>작업을 보관하거나 현재 모습을 이미지로 남기세요.</p></div><button className="icon-button" onClick={onClose} aria-label="닫기"><X size={18} /></button></div><button className="export-option" onClick={() => { downloadBlob(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }), `${project.name}.json`); onClose(); }}><FileJson size={25} /><span><strong>프로젝트 파일</strong><small>작품 이미지, 치수, 메모, Scene을 함께 저장 · JSON</small></span><Download size={18} /></button><button className="export-option" onClick={() => { onPng(); onClose(); }}><Image size={25} /><span><strong>3D 미리보기 이미지</strong><small>현재 3D 카메라의 모습을 저장 · PNG</small></span><Download size={18} /></button><p className="dialog-footnote">현재 버전은 브라우저에 저장됩니다. 작업을 오래 보관하려면 프로젝트 파일도 내려받으세요.</p></dialog>;
}
