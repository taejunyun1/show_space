import {useEffect,useRef} from 'react';
import {X} from 'lucide-react';
import {NoteEditor} from './NoteEditor';
import {useEditor} from '../state/editor';
export function ProjectNotesDialog({onClose}:{onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null),id=useEditor(s=>s.project.id);useEffect(()=>{ref.current?.showModal();},[]);
 return <dialog ref={ref} className="export-dialog notes-dialog" aria-label="프로젝트 메모" onCancel={onClose}><div className="dialog-header"><h2>프로젝트 메모</h2><button type="button" className="icon-button" aria-label="프로젝트 메모 닫기" onClick={onClose}><X size={18}/></button></div><NoteEditor key={id} target={{type:'project'}} label="프로젝트 NOTE"/><button type="button" className="button primary full" onClick={onClose}>완료</button></dialog>;
}
