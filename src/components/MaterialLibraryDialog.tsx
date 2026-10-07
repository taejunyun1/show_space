import {useEffect,useRef,useState} from 'react';
import {Archive,ArchiveRestore,Download,Upload,X} from 'lucide-react';
import {applyMaterialTemplate,builtinMaterials,materialCategories,materialCategoryLabels,type MaterialCategory,type MaterialTarget,type MaterialTemplate} from '../domain/materialLibrary';
import {materialLibrary,type MaterialLibrarySummary} from '../lib/materialLibrary';
import {downloadBlob} from '../lib/art';
import {materialThumbnail,readMaterialLibraryBackup} from '../lib/materialLibraryMedia';
import {useEditor} from '../state/editor';

export default function MaterialLibraryDialog({source,target,onClose}:{source:MaterialTemplate;target:MaterialTarget;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),upload=useRef<HTMLInputElement>(null),running=useRef(false),channel=useRef<BroadcastChannel|null>(null);
 const original=useRef({source:structuredClone(source),target:{...target},projectId:useEditor.getState().project.id}).current;
 const [items,setItems]=useState<MaterialLibrarySummary[]>([]),[busy,setBusy]=useState(true),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [name,setName]=useState(source.name),[saveCategory,setSaveCategory]=useState<MaterialCategory>(source.category),[query,setQuery]=useState(''),[category,setCategory]=useState('all'),[archived,setArchived]=useState(false);
 const refresh=async()=>setItems(await materialLibrary().list());
 useEffect(()=>{
  dialog.current?.showModal();let alive=true;
  const update=()=>materialLibrary().list().then(list=>{if(alive)setItems(list);}).catch(e=>{if(alive)setError(e instanceof Error?e.message:'재질 목록을 읽지 못했습니다.');});
  void update().finally(()=>{if(alive)setBusy(false);});
  if(typeof BroadcastChannel!=='undefined'){channel.current=new BroadcastChannel('gonggan-material-library');channel.current.onmessage=()=>void update();}
  window.addEventListener('focus',update);return()=>{alive=false;channel.current?.close();channel.current=null;window.removeEventListener('focus',update);};
 },[]);
 async function run(action:()=>Promise<void>){
  if(running.current)return;running.current=true;setBusy(true);setError('');setMessage('');
  try{await action();await refresh();channel.current?.postMessage({changed:true});}
  catch(e){setError(e instanceof Error?e.message:'재질 작업에 실패했습니다.');await refresh().catch(()=>{});}
  finally{running.current=false;setBusy(false);}
 }
 function apply(template:MaterialTemplate){
  const state=useEditor.getState();state.commit(applyMaterialTemplate(state.project,original.target,template,original.projectId));
  state.notify('재질을 적용했습니다. 되돌리기로 이전 재질을 복원할 수 있습니다.');onClose();
 }
 const normalize=(v:string)=>v.normalize('NFC').toLocaleLowerCase();
 const matches=(item:Pick<MaterialTemplate,'name'|'category'>)=> (category==='all'||item.category===category)&&normalize(item.name+' '+materialCategoryLabels[item.category]).includes(normalize(query.trim()));
 const visible=items.filter(i=>i.archived===archived&&matches(i)),presets=archived?[]:builtinMaterials.filter(matches);
 return <dialog ref={dialog} className="export-dialog material-library-dialog" aria-label="재질 라이브러리" onCancel={e=>{if(busy)e.preventDefault();else onClose();}}>
  <div className="dialog-header"><div><h2>재질 라이브러리</h2><p>색·물성·텍스처 반복 크기를 저장하고 다시 적용하세요.</p></div><button className="icon-button" disabled={busy} aria-label="재질 라이브러리 닫기" onClick={onClose}><X size={18}/></button></div>
  <p className="field-hint">이 브라우저에 저장됩니다. 계정 클라우드 동기화는 아직 지원하지 않습니다. 재질 백업으로 다른 브라우저에 옮길 수 있습니다.</p>
  <fieldset className="material-library-save" disabled={busy}><legend>현재 재질 저장</legend><input aria-label="저장할 재질 이름" maxLength={100} value={name} onChange={e=>setName(e.target.value)}/><select aria-label="저장할 재질 분류" value={saveCategory} onChange={e=>setSaveCategory(e.target.value as MaterialCategory)}>{materialCategories.map(c=><option key={c} value={c}>{materialCategoryLabels[c]}</option>)}</select><button className="button primary" disabled={!name.trim()} onClick={()=>void run(async()=>{const template={...original.source,name,category:saveCategory};await materialLibrary().add(template,await materialThumbnail(template));setMessage('현재 재질을 저장했습니다. 적용된 객체는 그대로 유지됩니다.');})}>재질 저장</button></fieldset>
  <div className="artwork-library-actions"><button className="button secondary" disabled={busy||!items.length} onClick={()=>void run(async()=>{const backup=await materialLibrary().backup();downloadBlob(new Blob([JSON.stringify(backup)],{type:'application/json'}),'공간-재질라이브러리.gonggan-materials.json');setMessage('텍스처를 포함한 재질 백업을 저장했습니다.');})}><Download size={15}/>재질 백업</button><button className="button secondary" disabled={busy} onClick={()=>upload.current?.click()}><Upload size={15}/>백업 가져오기</button><input ref={upload} hidden type="file" accept=".json,application/json" aria-label="재질 라이브러리 백업 파일" onChange={e=>{const f=e.currentTarget.files?.[0];e.currentTarget.value='';if(f)void run(async()=>{const added=await materialLibrary().restore(await readMaterialLibraryBackup(f));setMessage(`${added.length}개 재질을 새 항목으로 복원했습니다.`);});}}/></div>
  <div className="artwork-library-tools"><input type="search" aria-label="재질 라이브러리 검색" placeholder="재질 이름·분류 검색" value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="재질 라이브러리 분류" value={category} onChange={e=>setCategory(e.target.value)}><option value="all">모든 분류</option>{materialCategories.map(c=><option key={c} value={c}>{materialCategoryLabels[c]}</option>)}</select></div>
  <label className="field-hint"><input type="checkbox" checked={archived} onChange={e=>setArchived(e.target.checked)}/> 보관된 재질 보기</label>
  {original.target.type==='artwork'&&<p className="field-hint">작품에는 표면 물성만 적용합니다. 작품 이미지·치수·액자는 유지하고, 저장 재질의 색·반복 텍스처는 적용하지 않습니다.</p>}
  {busy&&<p role="status">재질 처리 중…</p>}{message&&<p role="status" className="field-hint">{message}</p>}{error&&<p role="alert" className="warning">{error}</p>}
  <div className="material-library-list"><h3>저장한 재질</h3>{visible.map(item=><article className="material-library-card" key={item.id} aria-label={`${item.name} 저장 재질`}><span className="material-swatch" style={{backgroundColor:item.color}}>{item.thumbnail&&<img src={item.thumbnail} alt={item.name+" 텍스처"} loading="lazy"/>}</span><div><strong>{item.name}</strong><small>{materialCategoryLabels[item.category]} · {item.textured?'텍스처 포함':'색·물성'}</small></div><div className="material-library-card-actions">{!archived&&<button className="button secondary" disabled={busy} aria-label={`${item.name} 재질 적용`} onClick={()=>void run(async()=>{const found=await materialLibrary().read(item.id);if(!found||found.summary.archived)throw new Error('적용할 재질을 찾을 수 없습니다.');apply(found.template);})}>적용</button>}<button className="icon-button" disabled={busy} aria-label={`${item.name} 재질 ${archived?'복구':'보관'}`} onClick={()=>void run(async()=>{await materialLibrary().archive(item.id,!archived,item.revision);setMessage(archived?'재질을 복구했습니다.':'재질을 보관했습니다. 이미 적용한 객체는 유지됩니다.');})}>{archived?<ArchiveRestore size={16}/>:<Archive size={16}/>}</button></div></article>)}{!busy&&!visible.length&&<p className="field-hint">{query?'검색 결과가 없습니다.':archived?'보관된 재질이 없습니다.':'현재 재질을 이름과 함께 저장하세요.'}</p>}
  {presets.length>0&&<><h3>기본 재질</h3>{presets.map(item=><article className="material-library-card" key={item.material.preset}><span className="material-swatch" style={{backgroundColor:item.color}}/><div><strong>{item.name}</strong><small>{materialCategoryLabels[item.category]}</small></div><button className="button secondary" disabled={busy} aria-label={`${item.name} 기본 재질 적용`} onClick={()=>void run(async()=>apply(item))}>적용</button></article>)}</>}</div>
  <p className="field-hint">{items.length}/200개 · 저장 용량 {(items.reduce((n,i)=>n+i.bytes,0)/1024/1024).toFixed(1)} / 32 MB · 보관 항목 포함. 객체의 위치·치수·메모는 라이브러리에 넣지 않습니다. 기본 재질은 색·반사값이며 사진에서 새 재질을 생성하지 않습니다.</p>
 </dialog>;
}
