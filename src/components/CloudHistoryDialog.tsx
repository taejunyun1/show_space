import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import {Archive,ArchiveRestore,Download,Trash2,X} from 'lucide-react';
import {useAuth,cloudSession} from '../state/auth';
import {flushAutosave,useEditor} from '../state/editor';
import {cancelCloudProject} from '../state/cloudSync';
import {createCloudProjectClient,CloudProjectError} from '../lib/cloudProjectClient';
import {createCloudHistoryClient} from '../lib/cloudHistoryClient';
import {readCloudHistoryProject,restoreCloudHistory,cloudHistoryChanges} from '../lib/cloudHistoryActions';
import {projectLibrary} from '../lib/projectLibrary';
import {openLocalProject} from '../lib/persistence';
import {requireProjectSwitchReady} from './projectSwitchGuard';
import {copyProject} from '../domain/projects';
import {downloadBlob} from '../lib/art';
import type {CloudProjectSummary} from '../domain/cloudProject';
import type {CloudHistorySummary} from '../domain/cloudHistory';
import type {Project} from '../domain/types';
import './projectHistory.css';
const PresentationMode=lazy(()=>import('./PresentationMode'));
type Props={projectId:string;onClose:()=>void;onBusy:(busy:boolean)=>void;onRestored:()=>void};
export default function CloudHistoryDialog(props:Props){return <CloudHistoryContents key={props.projectId} {...props}/>;}
function CloudHistoryContents({projectId,onClose,onBusy,onRestored}:Props){
 const dialog=useRef<HTMLDialogElement>(null),alive=useRef(true),valid=useRef(true),controller=useRef<AbortController|undefined>(undefined),retire=useRef<((explicit?:boolean)=>void)|undefined>(undefined);
 const opening=useRef({userId:useAuth.getState().user?.id,localId:useEditor.getState().project.id,context:useEditor.getState().projectContextVersion});
 const callbacks=useRef({onClose,onBusy});callbacks.current={onClose,onBusy};
 const captureRetry=useRef<{id:string;label:string;revision:number}|undefined>(undefined);
 const [baseline,setBaseline]=useState<CloudProjectSummary>(),[items,setItems]=useState<CloudHistorySummary[]>([]),[label,setLabel]=useState(''),[archived,setArchived]=useState(false),[busy,setBusy]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [selected,setSelected]=useState<{point:CloudHistorySummary;project:Project;changes:string[]}>(),[preview,setPreview]=useState<Project>(),[deleting,setDeleting]=useState<CloudHistorySummary>();
 type Projects=ReturnType<typeof createCloudProjectClient>;type History=ReturnType<typeof createCloudHistoryClient>;
 async function run(action:(projects:Projects,history:History,guard:()=>void,userId:string)=>Promise<void>){
  if(controller.current||!alive.current||!valid.current)return;const scope=opening.current,userId=scope.userId;
  if(!userId){setBusy(false);setError('계정 로그인이 필요합니다.');return;}
  const inScope=()=>useAuth.getState().user?.id===userId&&useEditor.getState().project.id===scope.localId&&useEditor.getState().projectContextVersion===scope.context;
  if(!inScope())return;
  const c=new AbortController();controller.current=c;setBusy(true);callbacks.current.onBusy(true);setError('');setNotice('');
  const owns=()=>alive.current&&valid.current&&controller.current===c&&inScope();
  retire.current=(explicit=false)=>{c.abort();if(controller.current!==c)return;controller.current=undefined;retire.current=undefined;if(alive.current){setBusy(false);callbacks.current.onBusy(false);if(explicit)setNotice('클라우드 버전 작업을 취소했습니다. 이미 저장된 클라우드 버전은 유지됩니다. 목록을 새로고침해 확인할 수 있습니다.');}};
  const guard=()=>{if(!owns()||c.signal.aborted)throw new Error('작업 범위가 바뀌어 클라우드 버전 작업을 취소했습니다.');};
  try{guard();const session=await cloudSession();guard();if(session.userId!==userId)throw new Error('계정이 바뀌었습니다.');const projects=createCloudProjectClient(session.token,fetch,c.signal),history=createCloudHistoryClient(session.token,fetch,c.signal);await action(projects,history,guard,userId);guard();const [meta,list]=await Promise.all([projects.metadata(projectId),history.list(projectId)]);guard();setBaseline(meta);setItems(list);}catch(e){if(owns()&&!c.signal.aborted)setError(e instanceof Error?e.message:'클라우드 버전 작업에 실패했습니다.');}finally{if(controller.current===c){controller.current=undefined;retire.current=undefined;if(alive.current){setBusy(false);callbacks.current.onBusy(false);}}}
 }
 useEffect(()=>{
  alive.current=true;if(!dialog.current?.open)dialog.current?.showModal();
  const changed=(account=false)=>{valid.current=false;retire.current?.();setLabel('');setNotice('');setSelected(undefined);setPreview(undefined);setItems([]);setBaseline(undefined);setDeleting(undefined);captureRetry.current=undefined;if(account)setError('계정이 바뀌었습니다. 창을 닫고 새 계정의 버전 기록을 열어주세요.');else callbacks.current.onClose();};
  const stopAuth=useAuth.subscribe((next,previous)=>{if(next.user?.id!==previous.user?.id)changed(true);});
  const stopEditor=useEditor.subscribe((next,previous)=>{if(next.project.id!==previous.project.id||next.projectContextVersion!==previous.projectContextVersion)changed();});
  void run(async()=>{});
  return()=>{alive.current=false;retire.current?.();stopAuth();stopEditor();callbacks.current.onBusy(false);};
 },[]);
 return <><dialog ref={dialog} className="export-dialog project-history-dialog" aria-label="클라우드 버전 기록" onCancel={e=>{if(busy)e.preventDefault();else onClose();}}>
 <div className="dialog-header"><div><h2>클라우드 버전 기록</h2><p>{baseline?.name??'프로젝트'} · 로그인한 계정에 비공개 저장</p></div><button className="icon-button" aria-label="클라우드 버전 기록 닫기" disabled={busy} onClick={onClose}><X size={18}/></button></div>
 <p className="field-hint">이 프로젝트의 복원 지점을 다른 기기에서도 열 수 있습니다. 현재 클라우드에 저장된 전시를 기록합니다. 편집 중인 최신 작업은 먼저 클라우드 저장을 완료해주세요.</p>
 <form className="history-save" onSubmit={e=>{e.preventDefault();void run(async(_projects,history,guard)=>{if(!baseline)throw new Error('클라우드 저장 상태를 확인해주세요.');const capture=captureRetry.current?.label===label.trim()?captureRetry.current:{id:crypto.randomUUID(),label:label.trim(),revision:baseline.revision};captureRetry.current=capture;try{await history.capture(projectId,capture.id,capture.label,capture.revision);guard();captureRetry.current=undefined;setLabel('');}catch(e){guard();if(e instanceof CloudProjectError&&e.status<500&&captureRetry.current===capture)captureRetry.current=undefined;throw e;}});}}><label>클라우드 복원 지점 이름<input aria-label="클라우드 복원 지점 이름" required maxLength={200} value={label} placeholder="예: 설치 확정" disabled={busy||!valid.current||baseline?.archived} onChange={e=>setLabel(e.target.value)}/></label><button className="button primary" disabled={busy||!valid.current||!baseline||baseline.archived||!label.trim()}>저장된 클라우드 버전 기록</button></form>
 <div className="history-tools"><label><input type="checkbox" checked={archived} onChange={e=>setArchived(e.target.checked)}/>보관된 클라우드 버전 보기</label><button className="button secondary" disabled={busy||!valid.current} onClick={()=>void run(async()=>{setSelected(undefined);})}>버전 목록 새로고침</button></div>
 <p className="field-hint">프로젝트당 50지점 · 계정당 500지점/1GiB · 한 지점 80MiB 이하. 기록을 자동 삭제하지 않습니다.</p>
 {busy&&<><p role="status">클라우드 버전 처리 중…</p><button className="button secondary" onClick={()=>retire.current?.(true)}>클라우드 버전 작업 취소</button></>}{error&&<p className="warning" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 <div className="history-list">{items.filter(p=>p.archived===archived).map(point=><article className="history-card" key={point.id}><button className="history-select" aria-label={`${point.label} 클라우드 버전 비교`} aria-pressed={selected?.point.id===point.id} disabled={busy||!valid.current} onClick={()=>void run(async(projects,history,guard)=>{setSelected(undefined);const version=await readCloudHistoryProject(history,projectId,point.id,undefined,guard);guard();const current=await projects.read(projectId);guard();const {importProjectPackage}=await import('../lib/projectPackage');guard();const source=await importProjectPackage(current.bytes);guard();const changes=cloudHistoryChanges(source,version.project);guard();setSelected({point:version.summary,project:version.project,changes});})}><strong>{point.label}</strong><span>{new Date(point.createdAt).toLocaleString('ko-KR')} · 클라우드 저장 #{point.sourceRevision}</span><small>{(point.bytes/1024/1024).toFixed(1)} MiB</small></button><div className="history-card-actions"><button className="icon-button" aria-label={`${point.label} 클라우드 버전 백업`} disabled={busy||!valid.current} onClick={()=>void run(async(_projects,history,guard)=>{const version=await history.read(projectId,point.id);guard();downloadBlob(new Blob([version.bytes]),`${point.name}-${point.label}.gonggan.zip`);})}><Download size={16}/></button><button className="icon-button" aria-label={`${point.label} 클라우드 버전 ${point.archived?'복구':'보관'}`} disabled={busy||!valid.current} onClick={()=>void run(async(_projects,history,guard)=>{await history.archive(projectId,point.id,point.revision,!point.archived);guard();setSelected(undefined);})}>{point.archived?<ArchiveRestore size={16}/>:<Archive size={16}/>}</button>{point.archived&&<button className="icon-button" aria-label={`${point.label} 클라우드 버전 삭제`} disabled={busy} onClick={()=>setDeleting(point)}><Trash2 size={16}/></button>}</div></article>)}</div>
 {!busy&&!items.some(p=>p.archived===archived)&&<p className="field-hint">{archived?'보관된 클라우드 버전이 없습니다.':'클라우드 복원 지점을 저장하면 여기에 기록됩니다.'}</p>}
 {selected&&<section className="history-comparison" aria-label="선택 클라우드 버전 비교"><h3>{selected.point.label}</h3><p>{selected.changes.length?'현재 클라우드 전시와 다른 항목':'현재 클라우드 전시와 같습니다.'}</p>{selected.changes.length>0&&<ul>{selected.changes.map(change=><li key={change}>{change}</li>)}</ul>}<div className="history-restore-actions"><button className="button secondary" disabled={busy} onClick={()=>setPreview(selected.project)}>클라우드 버전 3D 미리보기</button><button className="button primary" disabled={busy||!valid.current||!baseline||baseline.archived} onClick={()=>void run(async(projects,history,guard,userId)=>{
  if(!baseline)throw new Error('저장 상태를 확인해주세요.');const snapshot=useEditor.getState().project,switchGuard=()=>{guard();requireProjectSwitchReady(snapshot);};switchGuard();await flushAutosave();switchGuard();cancelCloudProject(snapshot.id,userId);
  const restored=await restoreCloudHistory(projects,history,projectId,selected.point.id,baseline.revision,switchGuard);switchGuard();
  setNotice('클라우드 버전을 복원했습니다. 이 브라우저에 복사본을 여는 중입니다.');
  const next=copyProject(restored.project,restored.project.name),repo=projectLibrary(),stored=await repo.save(next,0,false);switchGuard();
  await repo.saveCloudLink({userId,localProjectId:next.id,cloudProjectId:projectId,revision:restored.summary.revision,localRevision:stored.revision,autoSync:true});switchGuard();
  const opened=await openLocalProject(next.id,switchGuard);switchGuard();useEditor.getState().loadProject(opened,true);useEditor.getState().notify('클라우드 버전을 복원하고 새 로컬 항목으로 열었습니다. 직전 클라우드 전시는 버전 기록, 기존 로컬 전시는 프로젝트 목록에 보존했습니다.');onRestored();
 })}>이 클라우드 버전으로 복원</button></div><p className="field-hint">직전 클라우드 전시를 자동 기록한 뒤 최신 전시를 교체합니다. 다른 기기 변경·자산 오류·저장 한도에 걸리면 덮어쓰지 않습니다. 기존 로컬 전시는 보존하고 복원본을 새 로컬 항목으로 엽니다.</p></section>}
 {deleting&&<section className="history-delete" role="alertdialog" aria-label="클라우드 버전 영구 삭제 확인"><h3>이 클라우드 버전을 영구 삭제할까요?</h3><p>{deleting.label}을 삭제하면 모든 기기에서 복구할 수 없습니다. 현재 클라우드 전시는 유지됩니다.</p><button className="button secondary" disabled={busy} onClick={()=>setDeleting(undefined)}>취소</button><button className="button secondary" disabled={busy||!valid.current} onClick={()=>void run(async(_projects,history,guard)=>{await history.remove(projectId,deleting.id,deleting.revision);guard();setSelected(undefined);setDeleting(undefined);})}>클라우드 버전 영구 삭제</button></section>}
 </dialog>{preview&&<Suspense fallback={null}><PresentationMode source={{project:preview,cutaway:true}} onClose={()=>setPreview(undefined)}/></Suspense>}</>;
}
