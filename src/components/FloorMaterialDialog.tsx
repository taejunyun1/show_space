import {NoteEditor} from './NoteEditor';
import {useEffect,useRef} from 'react';
import {X} from 'lucide-react';
import {MaterialEditor} from './MaterialEditor';
import {useEditor} from '../state/editor';
export function FloorMaterialDialog({onClose}:{onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null),project=useEditor(s=>s.project);useEffect(()=>{ref.current?.showModal();},[]);
 return <dialog ref={ref} className="export-dialog" aria-label="바닥 재질" onCancel={onClose}><div className="dialog-header"><div><h2>바닥 재질</h2><p>바닥 경계와 실제 크기는 유지합니다.</p></div><button className="icon-button" onClick={onClose} aria-label="바닥 재질 닫기"><X size={18}/></button></div><MaterialEditor key={project.id} libraryTarget={{type:"floor"}} label="바닥 재질" material={project.floorMaterial} color={project.floorColor} legacyRoughness={.96} onChange={(floorMaterial,floorColor)=>useEditor.getState().patchProject({floorMaterial,floorColor})}/><NoteEditor key={project.id+"-floor"} target={{type:"floor"}} label="바닥 NOTE"/><button className="button primary full" onClick={onClose}>완료</button></dialog>;
}
