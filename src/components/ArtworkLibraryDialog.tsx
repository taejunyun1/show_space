import {CloudLibraryPanel} from './CloudLibraryPanel';
import {useLengthFormatter} from './LengthUnits';
import {useEffect,useRef,useState} from 'react';
import {Archive,ArchiveRestore,Download,Library,Plus,Upload,X} from 'lucide-react';
import {useEditor} from '../state/editor';
import {artworkTypeLabels,presentationTypeLabels,type ArtworkType,type PresentationType} from '../domain/artworkInformation';
import {artworkLibrary,ARTWORK_LIBRARY_MAX_BYTES,type ArtworkLibrarySummary} from '../lib/artworkLibrary';
import {prepareArtworkLibraryInput,readArtworkLibraryBackup} from '../lib/artworkLibraryMedia';
import {downloadBlob} from '../lib/art';

export function ArtworkLibraryDialog({onClose}:{onClose:()=>void}){
 const formatLength = useLengthFormatter();
 const dialog=useRef<HTMLDialogElement>(null),upload=useRef<HTMLInputElement>(null),running=useRef(false),channel=useRef<BroadcastChannel|null>(null);
 const {project,selected,activeWallId}=useEditor();
 const [items,setItems]=useState<ArtworkLibrarySummary[]>([]),[localBusy,setBusy]=useState(true),[cloudBusy,setCloudBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[query,setQuery]=useState(''),[archived,setArchived]=useState(false),[kind,setKind]=useState('all'),[wallId,setWallId]=useState(activeWallId||project.walls[0]?.id||'');
 const busy=localBusy||cloudBusy;
 const refresh=async()=>setItems(await artworkLibrary().list());
 useEffect(()=>{
  dialog.current?.showModal();let cancelled=false;
  const update=()=>artworkLibrary().list().then(list=>{if(!cancelled)setItems(list);}).catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:'목록을 읽지 못했습니다.');});
  void update().finally(()=>{if(!cancelled)setBusy(false);});
  if(typeof BroadcastChannel!=='undefined'){channel.current=new BroadcastChannel('gonggan-artwork-library');channel.current.onmessage=()=>void update();}
  window.addEventListener('focus',update);return()=>{cancelled=true;channel.current?.close();channel.current=null;window.removeEventListener('focus',update);};
 },[]);
 async function run(action:()=>Promise<void>){
  if(running.current||cloudBusy)return;running.current=true;setBusy(true);setError('');setMessage('');
  try{await action();await refresh();channel.current?.postMessage({changed:true});}
  catch(e){setError(e instanceof Error?e.message:'작품 라이브러리 작업에 실패했습니다.');await refresh().catch(()=>{});}
  finally{running.current=false;setBusy(false);}
 }
 const choice=selected.length===1?selected[0]:undefined;
 const source=choice?.type==='artwork'?project.artworks.find(a=>a.id===choice.id):choice?.type==='modelArtwork'?project.modelArtworks?.find(a=>a.id===choice.id):undefined;
 const visible=items.filter(a=>a.archived===archived&&(kind==='all'||a.kind===kind)&&`${a.name} ${a.artist} ${a.year} ${a.medium} ${artworkTypeLabels[a.artworkType as ArtworkType]??''} ${presentationTypeLabels[a.presentationType as PresentationType]??''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
 const provisional=!!project.planDraft&&!project.planReference?.calibrated;
 return <dialog ref={dialog} className="export-dialog artwork-library-dialog" aria-label="작품 라이브러리" onCancel={e=>{if(busy)e.preventDefault();else onClose();}}>
  <div className="dialog-header"><div><h2>작품 라이브러리</h2><p>작품 정보와 자산을 보관하고 다른 전시에서 재사용하세요.</p></div><button className="icon-button" aria-label="작품 라이브러리 닫기" disabled={busy} onClick={onClose}><X size={18}/></button></div>
  <p className="field-hint">이 브라우저에 독립 저장됩니다. 계정에 보관할 항목은 아래에서 선택해 저장하세요. 제목·작가·연도·치수·분류·재료·액자·이미지·영상 원본 또는 모델을 보존하며, 설치 메모·위치·회전·그룹·잠금은 제외합니다.</p>
  <CloudLibraryPanel kind="artwork" localItems={items} disabled={localBusy} onBusy={setCloudBusy} onImported={async()=>{await refresh();channel.current?.postMessage({changed:true});}}/>
  <div className="artwork-library-actions"><button className="button primary" disabled={busy||!source} onClick={()=>void run(async()=>{if(!source||!choice)return;const item=await prepareArtworkLibraryInput(choice.type==='modelArtwork'?'model':'image',source);await artworkLibrary().add(item);setMessage(`‘${source.name}’ 작품을 라이브러리에 저장했습니다.`);})}><Library size={16}/>선택 작품 저장</button><button className="button secondary" disabled={busy||!items.length} onClick={()=>void run(async()=>{const backup=await artworkLibrary().backup();downloadBlob(new Blob([JSON.stringify(backup)],{type:'application/json'}),'공간-작품라이브러리.gonggan-artworks.json');setMessage('작품과 자산을 포함한 라이브러리 백업을 저장했습니다.');})}><Download size={16}/>라이브러리 백업</button><button className="button secondary" disabled={busy} onClick={()=>upload.current?.click()}><Upload size={16}/>백업 가져오기</button><input ref={upload} hidden type="file" aria-label="작품 라이브러리 백업 파일" accept=".json,application/json" onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';if(file)void run(async()=>{const backup=await readArtworkLibraryBackup(file);const added=await artworkLibrary().restore(backup);setMessage(`${added.length}개 작품을 새 라이브러리 항목으로 복원했습니다.`);});}}/></div>
  {!source&&<p className="field-hint">편집기에서 이미지·영상 작품 또는 3D 작품 하나를 선택하면 저장할 수 있습니다.</p>}
  <div className="artwork-library-tools"><input type="search" aria-label="라이브러리 작품 검색" placeholder="제목·작가·연도·재료 검색" value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="라이브러리 작품 형식" value={kind} onChange={e=>setKind(e.target.value)}><option value="all">모든 작품</option><option value="image">이미지·영상 작품</option><option value="model">3D 작품</option></select></div>
  <div className="artwork-library-target"><label>이미지·영상 작품을 배치할 벽<select aria-label="라이브러리 배치할 벽" disabled={busy||provisional} value={wallId} onChange={e=>setWallId(e.target.value)}>{project.walls.map(w=><option key={w.id} value={w.id}>{w.name}{!w.visible?' · 숨김':''}</option>)}</select></label><label><input type="checkbox" checked={archived} onChange={e=>setArchived(e.target.checked)}/> 보관된 작품 보기</label></div>
  {provisional&&<p className="warning">도면 축척을 보정하면 작품을 배치할 수 있습니다.</p>}
  {busy&&<p role="status">작품 처리 중…</p>}{message&&<p role="status" className="field-hint">{message}</p>}{error&&<p role="alert" className="warning">{error}</p>}
  <div className="artwork-library-list">{visible.map(item=><article className="artwork-library-card" key={item.id} aria-label={`${item.name} 라이브러리 작품`}><img src={item.thumbnail} alt={`${item.name} 썸네일`} loading="lazy"/><div><strong>{item.name}</strong><span>{item.artist||'작가 미지정'} · {item.year||'연도 미지정'}</span><small>{item.dimensions.map(formatLength).join(' × ')}</small><small>{item.kind==='model'?'3D':item.artworkType==='video'?'영상':'이미지'} · {artworkTypeLabels[item.artworkType as ArtworkType]??'종류 미지정'} · {presentationTypeLabels[item.presentationType as PresentationType]??'설치 형식 미지정'}</small><small>{item.medium||'재료 미지정'}</small></div><div className="artwork-library-card-actions">{!archived&&<button className="button secondary" disabled={busy||provisional} aria-label={`${item.name} 라이브러리 작품 배치`} onClick={()=>{const expected=project.id;void run(async()=>{const found=await artworkLibrary().read(item.id);if(!found||found.summary.archived)throw new Error('배치할 작품을 찾을 수 없습니다.');useEditor.getState().installLibraryArtwork(found.template,expected,wallId);onClose();});}}><Plus size={15}/>배치</button>}<button className="icon-button" disabled={busy} aria-label={`${item.name} 라이브러리 ${archived?'복구':'보관'}`} onClick={()=>void run(async()=>{await artworkLibrary().archive(item.id,!archived,item.revision);setMessage(archived?'작품을 복구했습니다.':'작품을 보관했습니다. 배치된 작품은 유지됩니다.');})}>{archived?<ArchiveRestore size={16}/>:<Archive size={16}/>}</button></div></article>)}</div>
  {!busy&&!visible.length&&<p className="field-hint">{query?'검색 결과가 없습니다.':archived?'보관된 작품이 없습니다.':'편집기에서 작품을 선택해 라이브러리에 저장하세요.'}</p>}
  <p className="field-hint">{items.length}/500개 · 보관된 작품 포함 · 저장 용량 {((items.reduce((n,a)=>n+a.bytes,0))/1024/1024).toFixed(1)} / {ARTWORK_LIBRARY_MAX_BYTES/1024/1024} MB. 보관은 복구 가능하며 용량을 비우지 않습니다. 프로젝트 백업과 라이브러리 백업은 별도 파일입니다.</p>
 </dialog>;
}
