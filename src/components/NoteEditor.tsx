import {useEffect,useRef,useState} from 'react';
import {ImagePlus,Plus,Trash2} from 'lucide-react';
import {TextEditor} from './Controls';
import {useEditor} from '../state/editor';
import {readNote,NOTE_CHECKS_MAX,NOTE_IMAGES_MAX,NOTE_TEXT_MAX,type NoteTarget,type NoteDetails} from '../domain/notes';
import {readNoteImage} from '../lib/noteImage';
type Props={target:NoteTarget;label?:string};
export function NoteEditor(props:Props){
 const project=useEditor(s=>s.project),version=useEditor(s=>s.projectContextVersion),[referenceEpoch,setReferenceEpoch]=useState(0);
 useEffect(()=>{if(props.target.type!=='referenceModel')return;return useEditor.subscribe((next,previous)=>{if(next.project.referenceModel?.dataUrl!==previous.project.referenceModel?.dataUrl)setReferenceEpoch(value=>value+1);});},[props.target.type]);
 try{readNote(project,props.target);}catch{return <section className="note-editor" role="status">메모 대상을 다시 선택해주세요.</section>;}
 return <NoteContents key={JSON.stringify([project.id,version,props.target.type,'id' in props.target?props.target.id:'',referenceEpoch])} {...props} version={version}/>;
}
function NoteContents({target,label='NOTE',version:contextVersion}:Props&{version:number}){
 const project=useEditor(s=>s.project),input=useRef<HTMLInputElement>(null),alive=useRef(true),request=useRef(0);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const key=project.id+':'+target.type+('id' in target?':'+target.id:''),referenceSource=target.type==='referenceModel'?project.referenceModel?.dataUrl:undefined;
 function inScope(){const state=useEditor.getState();if(!alive.current||state.project.id!==project.id||state.projectContextVersion!==contextVersion||target.type==='referenceModel'&&state.project.referenceModel?.dataUrl!==referenceSource)return false;try{readNote(state.project,target);return true;}catch{return false;}}
 function patch(value:NoteTarget,change:{text?:string;details?:NoteDetails}){if(inScope())useEditor.getState().patchNote(value,change);}
 useEffect(()=>{alive.current=true;setBusy(false);setError('');const unsubscribe=useEditor.subscribe((next,previous)=>{let missing=false;try{readNote(next.project,target);}catch{missing=true;}if(next.project.id!==previous.project.id||next.projectContextVersion!==previous.projectContextVersion||missing||target.type==='referenceModel'&&next.project.referenceModel?.dataUrl!==previous.project.referenceModel?.dataUrl){request.current++;setBusy(false);setError('');}});return()=>{unsubscribe();alive.current=false;request.current++;};},[key,referenceSource]);
 const note=readNote(project,target),details=note.details;
 const latest=()=>inScope()?readNote(useEditor.getState().project,target).details:details;
 function checklist(id:string,value:{text?:string;done?:boolean}){const current=latest();patch(target,{details:{...current,checklist:current.checklist.map(c=>c.id===id?{...c,...value}:c)}});}
 async function load(file:File){const version=++request.current,projectId=project.id;setBusy(true);setError('');try{
  const image=await readNoteImage(file);if(!inScope()||version!==request.current)return;
  const state=useEditor.getState();if(state.project.id!==projectId||state.projectContextVersion!==contextVersion||(target.type==='referenceModel'&&state.project.referenceModel?.dataUrl!==referenceSource))return;
  const current=readNote(state.project,target).details;state.patchNote(target,{details:{...current,images:[...current.images,image]}});
  if(useEditor.getState().message)setError(useEditor.getState().message!);
 }catch(e){if(inScope()&&version===request.current)setError(e instanceof Error?e.message:'이미지를 읽지 못했습니다.');}finally{if(inScope()&&version===request.current)setBusy(false);}}
 return <section className="note-editor" aria-label={label+' 메모'}><div className="section-label">{label}</div>
 <TextEditor key={key} label={label} multiline maxLength={NOTE_TEXT_MAX} value={note.text} placeholder="설치 메모를 남겨보세요" onCommit={text=>patch(target,{text})}/><small className="field-hint">최대 {NOTE_TEXT_MAX.toLocaleString()}자 · 메모는 공유·PDF·3D 출력에 포함되지 않습니다.</small>
 <div className="note-check-heading"><strong>체크리스트</strong><span>{details.checklist.filter(c=>c.done).length}/{details.checklist.length}</span></div>
 {details.checklist.map((c,i)=><div className="note-check-row" key={c.id}><input type="checkbox" aria-label={`${label} 체크 항목 ${i+1} 완료`} checked={c.done} onChange={e=>checklist(c.id,{done:e.target.checked})}/><TextEditor label={`${label} 체크 항목 ${i+1}`} maxLength={1000} value={c.text} placeholder="할 일" onCommit={text=>checklist(c.id,{text})}/><button type="button" className="icon-button" aria-label={`${label} 체크 항목 ${i+1} 삭제`} onClick={()=>{const current=latest();patch(target,{details:{...current,checklist:current.checklist.filter(item=>item.id!==c.id)}});}}><Trash2 size={14}/></button></div>)}
 <button type="button" className="button secondary full" disabled={details.checklist.length>=NOTE_CHECKS_MAX} onClick={()=>{const current=latest();patch(target,{details:{...current,checklist:[...current.checklist,{id:crypto.randomUUID(),text:'',done:false}]}});}}><Plus size={14}/> 체크 항목 추가</button>
 <div className="note-check-heading"><strong>참고 이미지</strong><span>{details.images.length}/{NOTE_IMAGES_MAX}</span></div>
 <div className="note-images">{details.images.map((image,i)=><figure key={image.id}><img src={image.imageUrl} alt={image.name||`참고 이미지 ${i+1}`}/><figcaption><span>{image.name}</span><button type="button" className="icon-button" aria-label={`${label} 참고 이미지 ${i+1} 삭제`} onClick={()=>{const current=latest();patch(target,{details:{...current,images:current.images.filter(item=>item.id!==image.id)}});}}><Trash2 size={14}/></button></figcaption></figure>)}</div>
 <input ref={input} hidden type="file" accept="image/png,image/jpeg,image/webp" aria-label={label+' 참고 이미지 파일'} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void load(file);}}/>
 <button type="button" className="button secondary full" disabled={busy||details.images.length>=NOTE_IMAGES_MAX} onClick={()=>input.current?.click()}><ImagePlus size={14}/>{busy?'이미지 처리 중…':'참고 이미지 추가'}</button>
 {error&&<p className="warning" role="alert">{error}</p>}<p className="field-hint">JPG·PNG·WebP · 원본 20MiB 이하 · 저장 시 긴 변 2,048px로 줄입니다. 이미지 한 장 2MiB, 한 메모 총합 8MiB 이내입니다.</p>
 </section>;
}
