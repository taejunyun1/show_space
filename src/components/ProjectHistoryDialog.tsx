import {useProjectDialogScope} from './useProjectDialogScope';
import {requireProjectSwitchReady} from './projectSwitchGuard';
import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import {X,Archive,ArchiveRestore,Download,Trash2} from 'lucide-react';
import {flushAutosave,useEditor} from '../state/editor';
import type {Project} from '../domain/types';
import {type RestorePointSummary} from '../domain/projectHistory';
import {projectHistory,HISTORY_MAX_BYTES} from '../lib/projectHistory';
import {projectLibrary,ProjectConflictError,type StoredProject} from '../lib/projectLibrary';
import {exportProjectBackup,verifyProjectBackupImages} from '../lib/projectBackup';
import {localProjectRevision} from '../lib/persistence';
import {restoreProjectVersion,compareProjectHistory} from '../lib/projectHistoryActions';
import {downloadBlob} from '../lib/art';
import './projectHistory.css';
const PresentationMode=lazy(()=>import('./PresentationMode'));

type HistoryDialogProps={projectId:string;onClose:()=>void;onRestored:()=>void};
export default function ProjectHistoryDialog(props:HistoryDialogProps){return <ProjectHistoryContents key={props.projectId} {...props}/>;}
function ProjectHistoryContents({projectId,onClose,onRestored}:HistoryDialogProps){
 const dialog=useRef<HTMLDialogElement>(null),originalProjectId=useRef(useEditor.getState().project.id),scope=useProjectDialogScope(originalProjectId.current,onClose),selectedRequest=useRef(0),listRequest=useRef(0),running=useRef(false),loading=useRef(true),liveProject=useEditor(state=>state.project);
 const [baseline,setBaseline]=useState<StoredProject>(),[items,setItems]=useState<RestorePointSummary[]>([]),[usage,setUsage]=useState(0),[label,setLabel]=useState(''),[archived,setArchived]=useState(false);
 const [busy,setBusy]=useState(true),[progress,setProgress]=useState(''),[error,setError]=useState(''),[selected,setSelected]=useState<{point:RestorePointSummary;project:Project;changes:string[]}>(),[preview,setPreview]=useState<Project>(),[deleting,setDeleting]=useState<RestorePointSummary>();
 const failure=(cause:unknown,fallback:string)=>cause&&typeof cause==='object'&&'message' in cause&&typeof cause.message==='string'?cause.message:fallback;
 async function refresh(){const version=scope.begin();if(version===undefined)return;const request=++listRequest.current;const [stored,list,bytes]=await Promise.all([projectLibrary().read(projectId),projectHistory().list(projectId),projectHistory().usage()]);if(scope.current(version)&&request===listRequest.current){setBaseline(stored);setItems(list);setUsage(bytes);}}
 useEffect(()=>{dialog.current?.showModal();const version=scope.begin();loading.current=true;
  void(async()=>{let warning='';try{await flushAutosave();}catch(cause){warning=failure(cause,'현재 작업을 저장하지 못했습니다.');}if(version===undefined||!scope.current(version))return;try{await refresh();if(scope.current(version))setError(warning);}catch(cause){if(scope.current(version))setError(failure(cause,'버전 기록을 읽지 못했습니다.'));}finally{if(scope.current(version)){loading.current=false;setBusy(false);}}})();
  return()=>{selectedRequest.current++;listRequest.current++;};
 },[]);
 useEffect(()=>{setSelected(undefined);setPreview(undefined);},[liveProject]);
 async function run(action:(guard:()=>void,update:(message:string)=>void,snapshot:Project)=>Promise<void>){
  const version=scope.begin();if(version===undefined||running.current||loading.current)return;const request=++selectedRequest.current,snapshot=useEditor.getState().project;
  const current=()=>scope.current(version)&&request===selectedRequest.current;
  const guard=()=>{if(!current())throw new Error('버전 작업이 취소되었습니다.');requireProjectSwitchReady(snapshot);};
  const update=(message:string)=>{if(current()&&useEditor.getState().project===snapshot)setProgress(message);};
  running.current=true;setBusy(true);setProgress('');setError('');
  try{guard();await action(guard,update,snapshot);if(current())await refresh();}
  catch(cause){if(current()){setError(failure(cause,'버전 작업을 완료하지 못했습니다.'));await refresh().catch(()=>{});}}
  finally{running.current=false;if(current()){setBusy(false);setProgress('');}}
 }
 async function select(point:RestorePointSummary){await run(async(guard,update,snapshot)=>{
  setSelected(undefined);const version=await projectHistory().read(projectId,point.id);guard();await verifyProjectBackupImages(version.project,update);guard();
  const source=snapshot.id===projectId?snapshot:baseline?.project;if(!source)throw new Error('비교할 프로젝트를 찾을 수 없습니다.');const changes=await compareProjectHistory(source,version.project,p=>exportProjectBackup(p,update));guard();setSelected({...version,changes});
 });}
 const changes=selected?.changes??[];
 return <><dialog ref={dialog} className="export-dialog project-history-dialog" aria-label="프로젝트 버전 기록" onCancel={e=>{if(busy)e.preventDefault();else onClose();}}>
 <div className="dialog-header"><div><h2>버전 기록</h2><p>{baseline?.summary.name??'프로젝트'} · 이 브라우저에 저장</p></div><button type="button" className="icon-button" aria-label="버전 기록 닫기" disabled={busy} onClick={onClose}><X size={18}/></button></div>
 <p className="field-hint">도면·모델·작품·메모·Scene 전체를 복원 지점으로 보존합니다. Scene은 같은 전시의 배치·시점을 바꾸고, 버전은 프로젝트 전체를 되돌립니다. 이 목록은 로컬 기록입니다. 계정에 저장할 복원 지점은 프로젝트 목록의 클라우드 버전 기록에서 만들거나, 선택 버전을 ZIP으로 백업해주세요.</p>
 <form className="history-save" onSubmit={e=>{e.preventDefault();void run(async(guard,update)=>{await flushAutosave();guard();const stored=await projectLibrary().read(projectId);guard();if(!stored||stored.summary.archived)throw new Error('열려 있는 프로젝트만 기록할 수 있습니다.');if(useEditor.getState().project.id===projectId&&localProjectRevision(projectId)!==stored.summary.revision)throw new ProjectConflictError();const blob=await exportProjectBackup(stored.project,update);guard();await projectHistory().add(projectId,label,stored.summary.revision,blob);guard();setLabel('');});}}>
 <label>복원 지점 이름<input aria-label="복원 지점 이름" required maxLength={200} placeholder="예: 작품 배치 완료" value={label} disabled={busy||baseline?.summary.archived} onChange={e=>setLabel(e.target.value)}/></label><button type="submit" className="button primary" disabled={busy||!baseline||baseline.summary.archived||!label.trim()}>현재 버전 저장</button></form>
 <div className="history-tools"><label><input type="checkbox" checked={archived} onChange={e=>setArchived(e.target.checked)}/>보관된 버전 보기</label><small>{(usage/1024/1024).toFixed(1)} / {HISTORY_MAX_BYTES/1024/1024} MiB · 프로젝트당 50개</small></div>
 {error&&<p className="warning" role="alert">{error}</p>}{busy&&<p role="status">{progress||'버전 처리 중…'}</p>}
 <div className="history-list">{items.filter(p=>p.archived===archived).map(point=><article className="history-card" key={point.id}><button type="button" className="history-select" aria-label={`${point.label} 버전 비교`} aria-pressed={selected?.point.id===point.id} disabled={busy} onClick={()=>void select(point)}><strong>{point.label}</strong><span>{new Date(point.createdAt).toLocaleString('ko-KR')} · 저장 #{point.sourceRevision}</span><small>벽 {point.walls} · 작품 {point.artworks} · Scene {point.scenes}</small></button><div className="history-card-actions"><button type="button" className="icon-button" aria-label={`${point.label} 버전 백업`} disabled={busy} onClick={()=>void run(async guard=>{const blob=await projectHistory().backup(projectId,point.id);guard();downloadBlob(blob,`${point.projectName}-${point.label}.gonggan.zip`);})}><Download size={16}/></button><button type="button" className="icon-button" aria-label={`${point.label} 버전 ${point.archived?'복구':'보관'}`} disabled={busy} onClick={()=>void run(async guard=>{guard();await projectHistory().archive(projectId,point.id,!point.archived);guard();if(selected?.point.id===point.id)setSelected(undefined);})}>{point.archived?<ArchiveRestore size={16}/>:<Archive size={16}/>}</button>{point.archived&&<button type="button" className="icon-button" aria-label={`${point.label} 버전 삭제`} disabled={busy} onClick={()=>setDeleting(point)}><Trash2 size={16}/></button>}</div></article>)}</div>
 {!busy&&!items.some(p=>p.archived===archived)&&<p className="field-hint">{archived?'보관된 버전이 없습니다.':'복원 지점을 저장하면 여기에 기록됩니다.'}</p>}
 {selected&&<section className="history-comparison" aria-label="선택 버전 비교"><h3>{selected.point.label}</h3><p>{changes.length?'현재 프로젝트와 다른 항목':'현재 프로젝트와 같습니다.'}</p>{changes.length>0&&<ul>{changes.map(change=><li key={change}>{change}</li>)}</ul>}<div className="history-restore-actions"><button type="button" className="button secondary" disabled={busy} onClick={()=>setPreview(selected.project)}>버전 3D 미리보기</button><button type="button" className="button primary" disabled={busy||!baseline||baseline.summary.archived} onClick={()=>void run(async guard=>{await flushAutosave();guard();const latest=useEditor.getState(),revision=latest.project.id===projectId?localProjectRevision(projectId):baseline?.summary.revision;if(revision===undefined)throw new Error('프로젝트 저장 상태를 먼저 확인해주세요.');const restored=await restoreProjectVersion(projectId,selected.point.id,revision,undefined,guard);guard();useEditor.getState().loadProject(restored,true);useEditor.getState().notify('버전을 복원했습니다. 복원 직전 작업도 버전 기록에 보존했습니다.');onRestored();})}>이 버전으로 복원</button></div><p className="field-hint">복원 전 현재 프로젝트를 자동 기록합니다. 공간 부족·다른 탭 변경·자산 오류가 있으면 복원하지 않고 현재 작업을 유지합니다. Undo 목록은 새로 시작하며 이전 작업은 버전 기록에서 다시 열 수 있습니다.</p></section>}
 {deleting&&<section className="history-delete" role="alertdialog" aria-label="버전 영구 삭제 확인"><h3>이 버전을 영구 삭제할까요?</h3><p>{deleting.label}의 복원 지점을 삭제하면 복구할 수 없습니다. 현재 전시와 다른 버전은 유지됩니다.</p><button className="button secondary" disabled={busy} onClick={()=>setDeleting(undefined)}>취소</button><button className="button secondary" disabled={busy} onClick={()=>void run(async guard=>{guard();await projectHistory().remove(projectId,deleting.id);guard();if(selected?.point.id===deleting.id)setSelected(undefined);setDeleting(undefined);})}>버전 영구 삭제</button></section>}
 </dialog>{preview&&<Suspense fallback={null}><PresentationMode source={{project:preview,cutaway:true}} onClose={()=>setPreview(undefined)}/></Suspense>}</>;
}
