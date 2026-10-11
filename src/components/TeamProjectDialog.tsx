import {lazy,Suspense,useEffect,useMemo,useRef,useState} from 'react';
import {X} from 'lucide-react';
import {ARCHIVE_SECTIONS,archiveLayout,type ArchiveSection} from '../domain/projectArchive';
import {canEditProject,projectRoleLabels} from '../domain/collaboration';
import type {Project} from '../domain/types';
import type {CloudProjectSummary} from '../domain/cloudProject';
import {createCloudProjectClient} from '../lib/cloudProjectClient';
import {readCloudArchiveProject} from '../lib/projectArchive';
import {cloudSession,useAuth} from '../state/auth';
import {useEditor} from '../state/editor';
import {ProjectArchiveContents} from './ProjectArchiveContents';
import {ReviewCommentsPanel} from './ReviewCommentsPanel';
import {ScreenRecoveryBoundary} from './ScreenRecoveryBoundary';
import './projectArchive.css';
const PresentationMode=lazy(()=>import('./PresentationMode'));
type Props={projectId:string;onClose:()=>void;onEdit?:(id:string)=>void};
export default function TeamProjectDialog(props:Props){return <TeamProjectContents key={props.projectId} {...props}/>;}
function TeamProjectContents({projectId,onClose,onEdit}:Props){
 const opening=useRef({userId:useAuth.getState().user?.id,localId:useEditor.getState().project.id,version:useEditor.getState().projectContextVersion}),context=JSON.stringify([projectId,opening.current.userId]);
 const ref=useRef<HTMLDialogElement>(null),mounted=useRef(false),valid=useRef(true),controller=useRef<AbortController|null>(null),close=useRef(onClose);close.current=onClose;
 const [data,setData]=useState<{context:string;project:Project;summary:CloudProjectSummary}>(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[section,setSection]=useState<ArchiveSection>('space'),[sceneId,setSceneId]=useState<string|null>(null),[preview,setPreview]=useState(false);
 const record=valid.current&&data?.context===context?data:undefined,layout=useMemo(()=>record?archiveLayout(record.project,sceneId):null,[record,sceneId]);
 const opinions=useMemo(()=>record?{id:projectId,name:record.project.name,role:record.summary.role,archived:record.summary.archived}:undefined,[projectId,record?.project.name,record?.summary.role,record?.summary.archived]);
 function inScope(){const state=useEditor.getState(),scope=opening.current;return useAuth.getState().user?.id===scope.userId&&state.project.id===scope.localId&&state.projectContextVersion===scope.version;}
 function retire(explicit=false){controller.current?.abort();controller.current=null;if(mounted.current){setBusy(false);if(explicit)setNotice('열람 불러오기를 취소했습니다. 다시 새로고침할 수 있습니다.');}}
 useEffect(()=>{
  mounted.current=true;if(!ref.current?.open)ref.current?.showModal();
  const changed=()=>{if(!valid.current)return;valid.current=false;retire();setData(undefined);setPreview(false);setSceneId(null);close.current();};
  const stopAuth=useAuth.subscribe((next,previous)=>{if(next.user?.id!==previous.user?.id)changed();});
  const stopEditor=useEditor.subscribe((next,previous)=>{if(next.project.id!==previous.project.id||next.projectContextVersion!==previous.projectContextVersion)changed();});
  if(inScope())void refresh();else changed();
  return()=>{mounted.current=false;retire();stopAuth();stopEditor();};
 },[]);
 useEffect(()=>{const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void verifyAccess();},30000);return()=>window.clearInterval(timer);},[record]);
 function guard(c:AbortController){if(!mounted.current||!valid.current||controller.current!==c||c.signal.aborted||!inScope())throw new Error('프로젝트 열람이 취소됐습니다.');}
 async function client(c:AbortController){guard(c);const session=await cloudSession();guard(c);if(session.userId!==opening.current.userId)throw new Error('로그인 계정이 바뀌었습니다.');return createCloudProjectClient(session.token,fetch,c.signal);}
 async function refresh(){
  if(!mounted.current||!valid.current||!inScope())return;retire();const c=new AbortController();controller.current=c;setBusy(true);setError('');setNotice('');setData(undefined);setPreview(false);setSceneId(null);
  try{const api=await client(c),summary=await api.metadata(projectId);guard(c);const result=await readCloudArchiveProject(api,projectId,summary.revision,()=>guard(c));guard(c);setData({context,...result});}
  catch(e){if(mounted.current&&controller.current===c&&!c.signal.aborted)setError(e instanceof Error?e.message:'프로젝트를 읽지 못했습니다.');}
  finally{if(controller.current===c){controller.current=null;if(mounted.current)setBusy(false);}}
 }
 async function verifyAccess(){
  if(!mounted.current||!valid.current||controller.current||!record)return;const c=new AbortController();controller.current=c;
  try{const summary=await(await client(c)).metadata(projectId);guard(c);if(summary.revision!==record.summary.revision)setError('새 저장 버전이 있습니다. 프로젝트 새로고침으로 최신 배치를 확인하세요.');setData(old=>old?.context===context?{...old,summary:{...old.summary,role:summary.role,archived:summary.archived}}:old);}
  catch{if(mounted.current&&controller.current===c&&!c.signal.aborted){setData(undefined);setPreview(false);setError('접근 권한 또는 연결을 확인하지 못했습니다. 새로고침해 주세요.');}}
  finally{if(controller.current===c)controller.current=null;}
 }
 return <dialog ref={ref} className="export-dialog archive-dialog" aria-label="비공개 공동 프로젝트" onCancel={onClose}><div className="dialog-header"><h2>{record?.project.name??'비공개 공동 프로젝트'}</h2><button className="icon-button" aria-label="공동 프로젝트 닫기" onClick={onClose}><X size={18}/></button></div><p className="field-hint">참여 계정 전용 열람입니다. 메모·사진·자산도 포함합니다. 이 화면에서는 원본 배치를 수정하지 않습니다.</p><button className="button secondary" disabled={busy||!valid.current} onClick={()=>void refresh()}>프로젝트 새로고침</button>{busy&&<><p role="status">프로젝트를 읽는 중…</p><button className="button secondary" onClick={()=>retire(true)}>열람 불러오기 취소</button></>}{notice&&<p role="status">{notice}</p>}{error&&<p className="warning" role="alert">{error}</p>}
 {record&&layout&&<><p>{projectRoleLabels[record.summary.role??'owner']} · 버전 {record.summary.revision}{record.summary.archived?' · 보관됨':''}</p>{onEdit&&canEditProject(record.summary.role??'owner')&&!record.summary.archived&&<button className="button primary" onClick={()=>onEdit(projectId)}>편집기로 열기</button>}<div className="archive-layout-tools"><label>기록 배치<select value={sceneId??''} onChange={e=>setSceneId(e.target.value||null)}><option value="">현재 배치</option>{record.project.scenes.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><button className="button secondary" onClick={()=>setPreview(true)}>읽기 전용 3D 보기</button></div>
 <nav className="archive-tabs" aria-label="전시 기록 항목">{ARCHIVE_SECTIONS.map(([key,label])=><button key={key} aria-pressed={section===key} onClick={()=>setSection(key)}>{label}</button>)}</nav><ProjectArchiveContents project={record.project} layout={layout} section={section} onScene={id=>{setSceneId(id);setSection('space');}}/>
 <ReviewCommentsPanel shareId={projectId} privateProject={opinions}/>
 {preview&&<ScreenRecoveryBoundary name="공동 프로젝트 3D 보기" onClose={()=>setPreview(false)}><Suspense fallback={<p role="status">3D 보기 불러오는 중…</p>}><PresentationMode source={{project:sceneId?layout:record.project,camera:record.project.scenes.find(s=>s.id===sceneId)?.cameraView,cutaway:true}} onClose={()=>setPreview(false)} returnLabel="공동 프로젝트로 돌아가기"/></Suspense></ScreenRecoveryBoundary>}
 </>}
 </dialog>;
}
