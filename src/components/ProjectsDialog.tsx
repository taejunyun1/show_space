import {useProjectDialogScope} from './useProjectDialogScope';
import {requireProjectSwitchReady} from './projectSwitchGuard';
import {ScreenRecoveryBoundary} from './ScreenRecoveryBoundary';
import {NumberField} from './Controls';
import {LengthUnitContext} from './LengthUnits';
import {parseLengthUnit, type LengthUnit} from '../domain/lengthUnits';
import {CloudProjectsPanel} from './CloudProjectsPanel';
import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import {Plus,Copy,Archive,ArchiveRestore,History,X} from 'lucide-react';
import {flushAutosave,useEditor} from '../state/editor';
import {copyProject,newProject} from '../domain/projects';
import {projectLibrary,ProjectConflictError,type ProjectSummary} from '../lib/projectLibrary';
import {openLocalProject,saveNewLocalProject} from '../lib/persistence';

const ProjectArchiveDialog=lazy(()=>import('./ProjectArchiveDialog'));
const ProjectHistoryDialog=lazy(()=>import('./ProjectHistoryDialog'));
export function ProjectsDialog({onClose}:{onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null),originalProjectId=useRef(useEditor.getState().project.id),running=useRef(false),loading=useRef(true),listRequest=useRef(0),project=useEditor(s=>s.project),hydrated=useEditor(s=>s.hydrated),saveStatus=useEditor(s=>s.saveStatus);
 const [items,setItems]=useState<ProjectSummary[]>([]),[localBusy,setBusy]=useState(true),[cloudBusy,setCloudBusy]=useState(false),[error,setError]=useState(''),[query,setQuery]=useState(''),[archived,setArchived]=useState(false),[creating,setCreating]=useState(false);
 const [name,setName]=useState('새 전시'),[venue,setVenue]=useState(''),[width,setWidth]=useState(8000),[depth,setDepth]=useState(6000),[height,setHeight]=useState(3200),[unit,setUnit]=useState<LengthUnit>(project.displayUnit ?? 'mm'),[outdoor,setOutdoor]=useState(false);
 const [historyProjectId,setHistoryProjectId]=useState<string>(),[archiveOpen,setArchiveOpen]=useState(false);
 const scope=useProjectDialogScope(originalProjectId.current,onClose),cloudBusyNow=useRef(cloudBusy);cloudBusyNow.current=cloudBusy;
 const busy=localBusy||cloudBusy;
 const current=(version:number)=>scope.current(version);
 const failure=(e:unknown,fallback:string)=>e&&typeof e==='object'&&'message' in e&&typeof e.message==='string'?e.message:fallback;
 async function refresh(){const version=scope.begin();if(version===undefined)return;const request=++listRequest.current;const list=await projectLibrary().list();if(current(version)&&request===listRequest.current)setItems(list);}
 useEffect(()=>{ref.current?.showModal();const version=scope.begin();loading.current=true;
  void(async()=>{let warning='';try{await flushAutosave();}catch(e){warning=failure(e,'저장하지 못했습니다.');}if(version===undefined||!current(version))return;
   try{await refresh();if(current(version))setError(warning);}catch(e){if(current(version))setError(failure(e,'목록을 읽지 못했습니다.'));}finally{if(current(version)){loading.current=false;setBusy(false);}}
  })();return()=>{listRequest.current++;};},[]);
 async function run(action:(guard:()=>void)=>Promise<void>){
  const version=scope.begin();if(version===undefined||running.current||loading.current||cloudBusyNow.current||!useEditor.getState().hydrated)return;
  const snapshot=useEditor.getState().project,guard=()=>{if(!current(version))throw new Error('프로젝트 작업이 취소되었습니다.');requireProjectSwitchReady(snapshot);};
  running.current=true;setBusy(true);setError('');
  try{guard();await action(guard);if(current(version))await refresh();}
  catch(e){if(current(version)){setError(failure(e,'프로젝트 작업을 완료하지 못했습니다.'));try{await refresh();}catch{/* Keep the previous list during storage failure. */}}}
  finally{running.current=false;if(current(version))setBusy(false);}
 }
 const visible=items.filter(p=>p.archived===archived&&(`${p.name} ${p.venue}`).toLocaleLowerCase().includes(query.toLocaleLowerCase()));
 async function duplicate(id:string,guard:()=>void){const current=useEditor.getState();
  if(id===current.project.id&&current.saveStatus==='error'){await flushAutosave().catch(()=>{});guard();const copy=copyProject(current.project);const saved=await saveNewLocalProject(copy,guard);guard();useEditor.getState().loadProject(saved,true);return;}
  await flushAutosave();guard();const stored=await projectLibrary().read(id);guard();if(!stored)throw new Error('복제할 프로젝트를 찾을 수 없습니다.');const saved=await saveNewLocalProject(copyProject(stored.project),guard);guard();useEditor.getState().loadProject(saved,true);
 }
 return <dialog ref={ref} className="export-dialog projects-dialog" aria-label="프로젝트 목록" onCancel={e=>{if(busy)e.preventDefault();else onClose();}}><div className="dialog-header"><h2>프로젝트</h2><button type="button" className="icon-button" aria-label="프로젝트 목록 닫기" disabled={busy} onClick={onClose}><X size={18}/></button></div>
 <p className="field-hint">이 브라우저에 저장된 프로젝트입니다. 프로젝트 자산 백업으로 옮기거나, 연결된 계정의 클라우드에 저장할 수 있습니다.</p>
 <div className="projects-tools"><button className="button secondary" type="button" disabled={busy||!hydrated} onClick={()=>setArchiveOpen(true)}><Archive size={15}/>전시 아카이브</button><input aria-label="프로젝트 검색" type="search" placeholder="프로젝트·전시장 검색" value={query} onChange={e=>setQuery(e.target.value)}/><button className="button secondary" type="button" disabled={busy||!hydrated} onClick={()=>setCreating(!creating)}><Plus size={15}/>새 프로젝트</button></div>
 {creating&&<form className="new-project-form" onSubmit={e=>{e.preventDefault();void run(async guard=>{const next=newProject({name,venue,widthMm:width,depthMm:depth,heightMm:height,outdoor,displayUnit:unit});await flushAutosave();guard();const saved=await saveNewLocalProject(next,guard);guard();useEditor.getState().loadProject(saved,true);});}}>
 <label>프로젝트 이름<input required maxLength={200} value={name} onChange={e=>setName(e.target.value)}/></label><label>전시장 이름<input maxLength={200} value={venue} onChange={e=>setVenue(e.target.value)}/></label>
 <label>치수 단위<select aria-label="새 프로젝트 단위" value={unit} onChange={e=>setUnit(parseLengthUnit(e.target.value))}><option value="mm">mm</option><option value="cm">cm</option><option value="m">m</option></select></label><LengthUnitContext.Provider value={unit}><div className="project-size-fields"><NumberField label="초기 공간 너비" value={width} step={0.01} min={100} max={200000} onChange={setWidth}/><NumberField label="초기 공간 깊이" value={depth} step={0.01} min={100} max={200000} onChange={setDepth}/><NumberField label="벽 높이" value={height} step={0.01} min={100} max={30000} onChange={setHeight}/></div></LengthUnitContext.Provider>
 <label className="project-outdoor"><input type="checkbox" checked={outdoor} onChange={e=>setOutdoor(e.target.checked)}/>야외 전시</label><p className="field-hint">입력한 크기의 네 벽으로 시작합니다. 도면이나 모델을 불러오면 공간을 바꿀 수 있습니다.</p><button type="submit" className="button primary full" disabled={busy}>프로젝트 만들기</button></form>}
 <label className="project-outdoor"><input type="checkbox" checked={archived} onChange={e=>setArchived(e.target.checked)}/>보관된 프로젝트 보기</label>
 {(error||saveStatus==='error')&&<div className="project-error" role="alert"><p>{error||'현재 작업을 저장하지 못했습니다. 작업을 복사본으로 보존할 수 있습니다.'}</p><button type="button" className="button secondary" disabled={busy} onClick={()=>void run(guard=>duplicate(project.id,guard))}>현재 작업 복사본 만들기</button></div>}
 {busy&&<p role="status">프로젝트 처리 중…</p>}
 <div className="project-list">{visible.map(item=><article className="project-card" key={item.id}><div><strong>{item.name}</strong><span>{item.venue||'전시장 미지정'}{item.id===project.id?' · 현재 프로젝트':''}</span><small>수정 {new Date(item.updatedAt).toLocaleString('ko-KR')}</small></div><div className="project-card-actions"><button type="button" className="icon-button" aria-label={`${item.name} 버전 기록`} disabled={busy} onClick={()=>setHistoryProjectId(item.id)}><History size={16}/></button>{!archived&&<><button type="button" className="button secondary" disabled={busy||item.id===project.id} onClick={()=>void run(async guard=>{await flushAutosave();guard();const next=await openLocalProject(item.id,guard);guard();useEditor.getState().loadProject(next,true);})}>열기</button><button type="button" className="icon-button" aria-label={`${item.name} 복제`} disabled={busy} onClick={()=>void run(guard=>duplicate(item.id,guard))}><Copy size={16}/></button></>}<button type="button" className="icon-button" aria-label={`${item.name} ${archived?'복구':'보관'}`} disabled={busy||item.id===project.id} onClick={()=>void run(async guard=>{await flushAutosave();guard();const latest=await projectLibrary().read(item.id);guard();if(!latest)throw new Error('프로젝트를 찾을 수 없습니다.');if(latest.summary.revision!==item.revision)throw new ProjectConflictError();await projectLibrary().archive(item.id,!archived,item.revision);guard();})}>{archived?<ArchiveRestore size={16}/>:<Archive size={16}/>}</button></div></article>)}</div>
 {!busy&&!visible.length&&<p className="field-hint">{query?'검색 결과가 없습니다.':archived?'보관된 프로젝트가 없습니다.':'저장된 프로젝트가 없습니다.'}</p>}
 <CloudProjectsPanel disabled={localBusy} onBusy={setCloudBusy} onLocalChange={refresh}/>
 {archiveOpen&&<ScreenRecoveryBoundary name="전시 아카이브" onClose={()=>setArchiveOpen(false)}><Suspense fallback={null}><ProjectArchiveDialog onClose={()=>setArchiveOpen(false)} onReused={()=>{setArchiveOpen(false);if(scope.begin()!==undefined)onClose();}}/></Suspense></ScreenRecoveryBoundary>}
 {historyProjectId&&<ScreenRecoveryBoundary name="프로젝트 버전 기록" onClose={()=>setHistoryProjectId(undefined)}><Suspense fallback={null}><ProjectHistoryDialog projectId={historyProjectId} onClose={()=>setHistoryProjectId(undefined)} onRestored={()=>{setHistoryProjectId(undefined);if(scope.begin()!==undefined)onClose();}}/></Suspense></ScreenRecoveryBoundary>}
 </dialog>;
}
