import {NumberField} from './Controls';
import {LengthUnitContext} from './LengthUnits';
import {parseLengthUnit, type LengthUnit} from '../domain/lengthUnits';
import {CloudProjectsPanel} from './CloudProjectsPanel';
import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import {Plus,Copy,Archive,ArchiveRestore,History,X} from 'lucide-react';
import {flushAutosave,useEditor} from '../state/editor';
import {copyProject,newProject} from '../domain/projects';
import {projectLibrary,type ProjectSummary} from '../lib/projectLibrary';
import {openLocalProject,saveNewLocalProject} from '../lib/persistence';

const ProjectHistoryDialog=lazy(()=>import('./ProjectHistoryDialog'));
export function ProjectsDialog({onClose}:{onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null),project=useEditor(s=>s.project),hydrated=useEditor(s=>s.hydrated),saveStatus=useEditor(s=>s.saveStatus);
 const [items,setItems]=useState<ProjectSummary[]>([]),[localBusy,setBusy]=useState(true),[cloudBusy,setCloudBusy]=useState(false),[error,setError]=useState(''),[query,setQuery]=useState(''),[archived,setArchived]=useState(false),[creating,setCreating]=useState(false);
 const [name,setName]=useState('새 전시'),[venue,setVenue]=useState(''),[width,setWidth]=useState(8000),[depth,setDepth]=useState(6000),[height,setHeight]=useState(3200),[unit,setUnit]=useState<LengthUnit>(project.displayUnit ?? 'mm'),[outdoor,setOutdoor]=useState(false);
 const [historyProjectId,setHistoryProjectId]=useState<string>();
 const busy=localBusy||cloudBusy;
 const refresh=async()=>setItems(await projectLibrary().list());
 useEffect(()=>{ref.current?.showModal();let cancelled=false;(async()=>{let failure='';try{await flushAutosave();}catch(e){failure=e instanceof Error?e.message:'저장하지 못했습니다.';}try{const list=await projectLibrary().list();if(!cancelled){setItems(list);setError(failure);}}catch(e){if(!cancelled)setError(e instanceof Error?e.message:'목록을 읽지 못했습니다.');}finally{if(!cancelled)setBusy(false);}})();return()=>{cancelled=true;};},[]);
 async function run(action:()=>Promise<void>){if(busy||!hydrated)return;setBusy(true);setError('');try{await action();await refresh();}catch(e){setError(e instanceof Error?e.message:'프로젝트 작업을 완료하지 못했습니다.');try{await refresh();}catch{/* Keep the previous list during storage failure. */}}finally{setBusy(false);}}
 const visible=items.filter(p=>p.archived===archived&&(`${p.name} ${p.venue}`).toLocaleLowerCase().includes(query.toLocaleLowerCase()));
 async function duplicate(id:string){const current=useEditor.getState();if(id===current.project.id&&current.saveStatus==='error'){await flushAutosave().catch(()=>{});const copy=copyProject(useEditor.getState().project);useEditor.getState().loadProject(await saveNewLocalProject(copy),true);return;}
  await flushAutosave();const stored=await projectLibrary().read(id);if(!stored)throw new Error('복제할 프로젝트를 찾을 수 없습니다.');useEditor.getState().loadProject(await saveNewLocalProject(copyProject(stored.project)),true);}
 return <dialog ref={ref} className="export-dialog projects-dialog" aria-label="프로젝트 목록" onCancel={e=>{if(busy)e.preventDefault();else onClose();}}><div className="dialog-header"><h2>프로젝트</h2><button type="button" className="icon-button" aria-label="프로젝트 목록 닫기" disabled={busy} onClick={onClose}><X size={18}/></button></div>
 <p className="field-hint">이 브라우저에 저장된 프로젝트입니다. 프로젝트 자산 백업으로 옮기거나, 연결된 계정의 클라우드에 저장할 수 있습니다.</p>
 <div className="projects-tools"><input aria-label="프로젝트 검색" type="search" placeholder="프로젝트·전시장 검색" value={query} onChange={e=>setQuery(e.target.value)}/><button className="button secondary" type="button" disabled={busy||!hydrated} onClick={()=>setCreating(!creating)}><Plus size={15}/>새 프로젝트</button></div>
 {creating&&<form className="new-project-form" onSubmit={e=>{e.preventDefault();void run(async()=>{const next=newProject({name,venue,widthMm:width,depthMm:depth,heightMm:height,outdoor,displayUnit:unit});await flushAutosave();useEditor.getState().loadProject(await saveNewLocalProject(next),true);setCreating(false);onClose();});}}>
 <label>프로젝트 이름<input required maxLength={200} value={name} onChange={e=>setName(e.target.value)}/></label><label>전시장 이름<input maxLength={200} value={venue} onChange={e=>setVenue(e.target.value)}/></label>
 <label>치수 단위<select aria-label="새 프로젝트 단위" value={unit} onChange={e=>setUnit(parseLengthUnit(e.target.value))}><option value="mm">mm</option><option value="cm">cm</option><option value="m">m</option></select></label><LengthUnitContext.Provider value={unit}><div className="project-size-fields"><NumberField label="초기 공간 너비" value={width} step={0.01} min={100} max={200000} onChange={setWidth}/><NumberField label="초기 공간 깊이" value={depth} step={0.01} min={100} max={200000} onChange={setDepth}/><NumberField label="벽 높이" value={height} step={0.01} min={100} max={30000} onChange={setHeight}/></div></LengthUnitContext.Provider>
 <label className="project-outdoor"><input type="checkbox" checked={outdoor} onChange={e=>setOutdoor(e.target.checked)}/>야외 전시</label><p className="field-hint">입력한 크기의 네 벽으로 시작합니다. 도면이나 모델을 불러오면 공간을 바꿀 수 있습니다.</p><button type="submit" className="button primary full" disabled={busy}>프로젝트 만들기</button></form>}
 <label className="project-outdoor"><input type="checkbox" checked={archived} onChange={e=>setArchived(e.target.checked)}/>보관된 프로젝트 보기</label>
 {(error||saveStatus==='error')&&<div className="project-error" role="alert"><p>{error||'현재 작업을 저장하지 못했습니다. 작업을 복사본으로 보존할 수 있습니다.'}</p><button type="button" className="button secondary" disabled={busy} onClick={()=>void run(()=>duplicate(project.id))}>현재 작업 복사본 만들기</button></div>}
 {busy&&<p role="status">프로젝트 처리 중…</p>}
 <div className="project-list">{visible.map(item=><article className="project-card" key={item.id}><div><strong>{item.name}</strong><span>{item.venue||'전시장 미지정'}{item.id===project.id?' · 현재 프로젝트':''}</span><small>수정 {new Date(item.updatedAt).toLocaleString('ko-KR')}</small></div><div className="project-card-actions"><button type="button" className="icon-button" aria-label={`${item.name} 버전 기록`} disabled={busy} onClick={()=>setHistoryProjectId(item.id)}><History size={16}/></button>{!archived&&<><button type="button" className="button secondary" disabled={busy||item.id===project.id} onClick={()=>void run(async()=>{await flushAutosave();useEditor.getState().loadProject(await openLocalProject(item.id),true);onClose();})}>열기</button><button type="button" className="icon-button" aria-label={`${item.name} 복제`} disabled={busy} onClick={()=>void run(()=>duplicate(item.id))}><Copy size={16}/></button></>}<button type="button" className="icon-button" aria-label={`${item.name} ${archived?'복구':'보관'}`} disabled={busy||item.id===project.id} onClick={()=>void run(async()=>{await flushAutosave();const latest=await projectLibrary().read(item.id);if(!latest)throw new Error('프로젝트를 찾을 수 없습니다.');await projectLibrary().archive(item.id,!archived,latest.summary.revision);})}>{archived?<ArchiveRestore size={16}/>:<Archive size={16}/>}</button></div></article>)}</div>
 {!busy&&!visible.length&&<p className="field-hint">{query?'검색 결과가 없습니다.':archived?'보관된 프로젝트가 없습니다.':'저장된 프로젝트가 없습니다.'}</p>}
 <CloudProjectsPanel disabled={localBusy} onBusy={setCloudBusy} onLocalChange={refresh}/>
 {historyProjectId&&<Suspense fallback={null}><ProjectHistoryDialog projectId={historyProjectId} onClose={()=>setHistoryProjectId(undefined)} onRestored={()=>{setHistoryProjectId(undefined);onClose();}}/></Suspense>}
 </dialog>;
}
