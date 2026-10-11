import {ScreenRecoveryBoundary} from './ScreenRecoveryBoundary';
import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import {Cloud,Archive,ArchiveRestore,History,Users} from 'lucide-react';
import {AccountDialog} from './AccountDialog';
import {useAuth,cloudSession} from '../state/auth';
import {useCloudSync,syncCloudProject,cancelCloudProject} from '../state/cloudSync';
import {flushAutosave,useEditor} from '../state/editor';
import {projectLibrary} from '../lib/projectLibrary';
import {createCloudProjectClient} from '../lib/cloudProjectClient';
import type {CloudProjectSummary} from '../domain/cloudProject';
import {canEditProject,projectRoleLabels} from '../domain/collaboration';
import {openEditableCloudProject} from '../lib/openCloudProject';
import {copyProject} from '../domain/projects';
import {saveNewLocalProject} from '../lib/persistence';
import {requireProjectSwitchReady} from './projectSwitchGuard';
const ProjectCollaborationDialog=lazy(()=>import('./ProjectCollaborationDialog'));
const TeamProjectDialog=lazy(()=>import('./TeamProjectDialog'));
const CloudHistoryDialog=lazy(()=>import('./CloudHistoryDialog'));

export function CloudProjectsPanel({disabled,onBusy,onLocalChange}:{disabled:boolean;onBusy:(busy:boolean)=>void;onLocalChange:()=>Promise<void>}){
 const auth=useAuth(),project=useEditor(s=>s.project),projectContext=useEditor(s=>s.projectContextVersion),cloud=useCloudSync(s=>s.current),controller=useRef<AbortController|null>(null),mounted=useRef(true),epoch=useRef(0),retire=useRef<((explicit?:boolean)=>void)|null>(null);
 const [contextEpoch,setContextEpoch]=useState(0);
 const busyCallback=useRef(onBusy);busyCallback.current=onBusy;
 const [items,setItems]=useState<{userId:string;values:CloudProjectSummary[]}>(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[account,setAccount]=useState(false),[auto,setAuto]=useState(false),[linked,setLinked]=useState(''),[archived,setArchived]=useState(false);
 const [collaboration,setCollaboration]=useState<{userId:string;id:string;name:string}>(),[team,setTeam]=useState<{userId:string;id:string}>();
 const [historyId,setHistoryId]=useState<string>(),[historyBusy,setHistoryBusy]=useState(false);
 useEffect(()=>{onBusy(busy||historyBusy);},[busy,historyBusy,onBusy]);
 const current=cloud?.projectId===project.id&&cloud.userId===auth.user?.id?cloud:null;
 useEffect(()=>{
  mounted.current=true;
  const change=(accountChanged=false)=>{epoch.current++;retire.current?.();setContextEpoch(epoch.current);setError('');setAuto(false);setLinked('');setHistoryId(undefined);setHistoryBusy(false);setCollaboration(undefined);setTeam(undefined);if(accountChanged){setItems(undefined);setAccount(false);}};
  const stopAuth=useAuth.subscribe((next,previous)=>{if(next.user?.id!==previous.user?.id)change(true);});
  const stopEditor=useEditor.subscribe((next,previous)=>{if(next.project.id!==previous.project.id||next.projectContextVersion!==previous.projectContextVersion)change();});
  return()=>{mounted.current=false;retire.current?.();stopAuth();stopEditor();busyCallback.current(false);};
 },[]);
 useEffect(()=>{let cancelled=false;const version=epoch.current;if(auth.user)void Promise.all([projectLibrary().cloudLink(auth.user.id,project.id),projectLibrary().cloudPending(auth.user.id,project.id)]).then(([saved,pending])=>{const link=pending?.link??saved;if(!cancelled&&mounted.current&&version===epoch.current){setAuto(link?.autoSync??false);setLinked(link?.cloudProjectId??'');}}).catch(e=>{if(!cancelled&&mounted.current&&version===epoch.current)setError(e.message);});return()=>{cancelled=true;};},[auth.user?.id,project.id,current?.status,contextEpoch]);
 async function run(action:(client:ReturnType<typeof createCloudProjectClient>,guard:()=>void,userId:string)=>Promise<void>){
  const userId=auth.user?.id,state=useEditor.getState();if(busy||disabled||controller.current||!userId||!mounted.current||contextEpoch!==epoch.current||useAuth.getState().user?.id!==userId||state.project.id!==project.id||state.projectContextVersion!==projectContext)return;
  const c=new AbortController(),version=epoch.current;controller.current=c;setBusy(true);setError('');
  const owns=()=>mounted.current&&controller.current===c&&version===epoch.current&&useAuth.getState().user?.id===userId;
  retire.current=(explicit=false)=>{c.abort();cancelCloudProject(project.id,userId);if(controller.current!==c)return;controller.current=null;retire.current=null;if(mounted.current){setBusy(false);if(explicit)setError('클라우드 작업을 취소했습니다. 저장 대기는 유지됩니다.');}};
  const guard=()=>{if(!owns()||c.signal.aborted)throw new Error('작업 범위가 바뀌어 클라우드 작업을 취소했습니다.');};
  try{guard();const session=await cloudSession();guard();if(session.userId!==userId)throw new Error('로그인 계정이 바뀌었습니다.');const client=createCloudProjectClient(session.token,fetch,c.signal);await action(client,guard,userId);guard();const [owned,shared]=await Promise.all([client.list(),client.listShared()]);guard();setItems({userId,values:[...owned,...shared]});await onLocalChange();}catch(e){if(owns()&&!c.signal.aborted)setError(e instanceof Error?e.message:'클라우드 작업을 완료하지 못했습니다.');}finally{if(controller.current===c){controller.current=null;retire.current=null;if(mounted.current)setBusy(false);}}
 }
 async function load(id:string,client:ReturnType<typeof createCloudProjectClient>,guard:()=>void,userId:string){
  const snapshot=useEditor.getState().project,switchGuard=()=>{guard();requireProjectSwitchReady(snapshot);};switchGuard();await flushAutosave();switchGuard();const next=await openEditableCloudProject(client,id,userId,switchGuard);switchGuard();useEditor.getState().loadProject(next,true);setTeam(undefined);
 }
 return <section className="cloud-projects" aria-label="클라우드 프로젝트"><h3><Cloud size={18}/>내 클라우드·공동 프로젝트</h3>
 {auth.status==='loading'?<p>계정 연결 확인 중…</p>:!auth.config?.cloudEnabled?<p className="field-hint">클라우드 저장 연결을 준비 중입니다. 현재 작업은 이 브라우저에 저장됩니다.</p>:!auth.user?<><p className="field-hint">로그인한 계정에 프로젝트와 이미지·3D 모델을 비공개로 저장합니다.</p><button className="button secondary" onClick={()=>setAccount(true)}>계정 로그인</button></>:<>
 <p className="field-hint">{auth.user.email} · 처음 저장한 뒤 이 프로젝트의 변경 사항을 자동으로 저장합니다. 클라우드 프로젝트를 열면 새 로컬 항목으로 보존합니다.</p>
 <div className="cloud-actions"><button className="button primary" disabled={busy||disabled||current?.status==='saving'} onClick={()=>void run(async()=>{await syncCloudProject(useEditor.getState().project,true);})}>현재 프로젝트 클라우드 저장</button><button className="button secondary" disabled={busy||disabled} onClick={()=>void run(async()=>{})}>클라우드 목록 새로고침</button></div>
 {linked&&<label className="project-outdoor"><input type="checkbox" checked={auto} disabled={busy||disabled||current?.status==='saving'} onChange={e=>{const enabled=e.target.checked;void run(async(_client,guard,userId)=>{await projectLibrary().setCloudAutoSync(userId,project.id,enabled);guard();setAuto(enabled);if(enabled)await syncCloudProject(useEditor.getState().project,true);});}}/>이 프로젝트 클라우드 자동 저장</label>}
 {current?.status==='conflict'&&current.message&&<p className="warning">{current.message}</p>}{current&&<p role="status">{current.status==='saved'?'클라우드 저장됨':current.status==='saving'?'클라우드 저장 중…':current.status==='queued'?'클라우드 저장 대기 — 다시 저장하면 재시도합니다.':current.status==='conflict'?'클라우드 저장 충돌·권한 변경 — 현재 작업을 복사본으로 보존할 수 있습니다.':current.message}</p>}
 {current?.status==='conflict'&&<button className="button secondary" disabled={busy||disabled} onClick={()=>void run(async(_client,guard)=>{const snapshot=useEditor.getState().project,switchGuard=()=>{guard();requireProjectSwitchReady(snapshot);};switchGuard();await flushAutosave().catch(()=>{});switchGuard();const next=await saveNewLocalProject(copyProject(snapshot),switchGuard);switchGuard();useEditor.getState().loadProject(next,true);await syncCloudProject(next,true);})}>현재 작업을 새 클라우드 복사본으로 저장</button>}
 <label className="project-outdoor"><input type="checkbox" checked={archived} onChange={e=>setArchived(e.target.checked)}/>보관된 클라우드 프로젝트 보기</label>
 <div className="project-list">{(items?.userId===auth.user.id?items.values:[]).filter(item=>item.archived===archived).map(item=><article className="project-card" key={item.id}><div><strong>{item.name}</strong><span>{item.venue||'전시장 미지정'} · {projectRoleLabels[item.role??'owner']}{linked===item.id?' · 연결된 프로젝트':''}</span><small>클라우드 수정 {new Date(item.updatedAt).toLocaleString('ko-KR')}</small></div><div className="project-card-actions">{(item.role??'owner')==='owner'&&<button className="icon-button" aria-label={`${item.name} 클라우드 버전 기록`} disabled={busy||disabled} onClick={()=>setHistoryId(item.id)}><History size={16}/></button>}{!archived&&canEditProject(item.role??'owner')&&<button className="button secondary" disabled={busy||disabled} onClick={()=>void run((client,guard,userId)=>load(item.id,client,guard,userId))}>편집기로 열기</button>}<button className="button secondary" disabled={busy||disabled} onClick={()=>setTeam({userId:auth.user!.id,id:item.id})}>열람·의견</button>{(item.role??'owner')==='owner'&&<button className="icon-button" aria-label={`${item.name} 공동 작업 관리`} disabled={busy||disabled||archived} onClick={()=>setCollaboration({userId:auth.user!.id,id:item.id,name:item.name})}><Users size={16}/></button>}{(item.role??'owner')==='owner'&&<button className="icon-button" aria-label={`${item.name} 클라우드 ${archived?'복구':'보관'}`} disabled={busy||disabled||linked===item.id} onClick={()=>void run(async(client)=>{await client.archive(item.id,item.revision,!archived);})}>{archived?<ArchiveRestore size={16}/>:<Archive size={16}/>}</button>}</div></article>)}</div>
 {(!items||items.userId!==auth.user.id||!items.values.length)&&<p className="field-hint">목록 새로고침으로 저장된 프로젝트를 확인하세요.</p>}
 </>}{busy&&<><p role="status">클라우드 작업 중…</p><button className="button secondary" onClick={()=>retire.current?.(true)}>클라우드 작업 취소</button></>}{error&&<p className="warning" role="alert">{error}</p>}{account&&<AccountDialog onClose={()=>setAccount(false)}/>} {collaboration?.userId===auth.user?.id&&collaboration&&<ScreenRecoveryBoundary name="프로젝트 공동 작업" onClose={()=>setCollaboration(undefined)}><Suspense fallback={null}><ProjectCollaborationDialog key={collaboration.userId+collaboration.id} projectId={collaboration.id} name={collaboration.name} onClose={()=>setCollaboration(undefined)}/></Suspense></ScreenRecoveryBoundary>} {team?.userId===auth.user?.id&&team&&<ScreenRecoveryBoundary name="공동 프로젝트 열람" onClose={()=>setTeam(undefined)}><Suspense fallback={null}><TeamProjectDialog key={team.userId+team.id} projectId={team.id} onClose={()=>setTeam(undefined)} onEdit={id=>{setTeam(undefined);void run((client,guard,userId)=>load(id,client,guard,userId));}}/></Suspense></ScreenRecoveryBoundary>} {historyId&&<ScreenRecoveryBoundary name="계정 버전 기록" onClose={()=>setHistoryId(undefined)}><Suspense fallback={null}><CloudHistoryDialog projectId={historyId} onClose={()=>setHistoryId(undefined)} onBusy={setHistoryBusy} onRestored={()=>{setHistoryId(undefined);void run(async()=>{});}}/></Suspense></ScreenRecoveryBoundary>}</section>;
}
