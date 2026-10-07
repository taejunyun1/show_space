import {lazy,Suspense,useEffect,useMemo,useRef,useState} from 'react';
import {X} from 'lucide-react';
import {ARCHIVE_SECTIONS,archiveLayout,type ArchiveSection} from '../domain/projectArchive';
import {canEditProject,projectRoleLabels} from '../domain/collaboration';
import type {Project} from '../domain/types';
import type {CloudProjectSummary} from '../domain/cloudProject';
import {createCloudProjectClient} from '../lib/cloudProjectClient';
import {readCloudArchiveProject} from '../lib/projectArchive';
import {cloudSession,useAuth} from '../state/auth';
import {ProjectArchiveContents} from './ProjectArchiveContents';
import {ReviewCommentsPanel} from './ReviewCommentsPanel';
import {ScreenRecoveryBoundary} from './ScreenRecoveryBoundary';
import './projectArchive.css';
const PresentationMode=lazy(()=>import('./PresentationMode'));
export default function TeamProjectDialog({projectId,onClose,onEdit}:{projectId:string;onClose:()=>void;onEdit?:(id:string)=>void}){
 const auth=useAuth(),identity=auth.user?.id,context=projectId+':'+identity,live=useRef(context);live.current=context;
 const ref=useRef<HTMLDialogElement>(null),mounted=useRef(false),controller=useRef<AbortController|null>(null);
 const [data,setData]=useState<{context:string;project:Project;summary:CloudProjectSummary}>(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[section,setSection]=useState<ArchiveSection>('space'),[sceneId,setSceneId]=useState<string|null>(null),[preview,setPreview]=useState(false);
 const record=data?.context===context?data:undefined,layout=useMemo(()=>record?archiveLayout(record.project,sceneId):null,[record,sceneId]);
 useEffect(()=>{mounted.current=true;ref.current?.showModal();return()=>{mounted.current=false;controller.current?.abort();};},[]);
 useEffect(()=>{controller.current?.abort();setData(undefined);setSceneId(null);setPreview(false);void refresh();return()=>controller.current?.abort();},[context]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void verifyAccess();},30000);return()=>window.clearInterval(timer);},[context,busy,record]); // eslint-disable-line react-hooks/exhaustive-deps
 async function client(c:AbortController){const session=await cloudSession();if(session.userId!==identity||useAuth.getState().user?.id!==identity||c.signal.aborted)throw new Error('로그인 계정이 바뀌었습니다.');return createCloudProjectClient(session.token,fetch,c.signal);}
 function guard(c:AbortController,captured:string){if(!mounted.current||c.signal.aborted||live.current!==captured||useAuth.getState().user?.id!==identity)throw new Error('프로젝트 열람이 취소됐습니다.');}
 async function refresh(){controller.current?.abort();const c=new AbortController(),captured=context;controller.current=c;setBusy(true);setError('');setData(undefined);setPreview(false);setSceneId(null);try{const api=await client(c),summary=await api.metadata(projectId);guard(c,captured);const result=await readCloudArchiveProject(api,projectId,summary.revision,()=>guard(c,captured));guard(c,captured);setData({context:captured,...result});}catch(e){if(mounted.current&&!c.signal.aborted&&live.current===captured)setError((e as Error).message);}finally{if(mounted.current&&controller.current===c)setBusy(false);}}
 async function verifyAccess(){if(busy||!record)return;controller.current?.abort();const c=new AbortController(),captured=context;controller.current=c;try{const summary=await(await client(c)).metadata(projectId);guard(c,captured);if(summary.revision!==record.summary.revision)setError('새 저장 버전이 있습니다. 프로젝트 새로고침으로 최신 배치를 확인하세요.');setData(old=>old?.context===captured?{...old,summary:{...old.summary,role:summary.role,archived:summary.archived}}:old);}catch{if(mounted.current&&!c.signal.aborted&&live.current===captured){setData(undefined);setPreview(false);setError('접근 권한 또는 연결을 확인하지 못했습니다. 새로고침해 주세요.');}}}
 return <dialog ref={ref} className="export-dialog archive-dialog" aria-label="비공개 공동 프로젝트" onCancel={onClose}><div className="dialog-header"><h2>{record?.project.name??'비공개 공동 프로젝트'}</h2><button className="icon-button" aria-label="공동 프로젝트 닫기" onClick={onClose}><X size={18}/></button></div><p className="field-hint">참여 계정 전용 열람입니다. 메모·사진·자산도 포함합니다. 이 화면에서는 원본 배치를 수정하지 않습니다.</p><button className="button secondary" disabled={busy} onClick={()=>void refresh()}>프로젝트 새로고침</button>{busy&&<p role="status">프로젝트를 읽는 중…</p>}{error&&<p className="warning" role="alert">{error}</p>}
 {record&&layout&&<><p>{projectRoleLabels[record.summary.role??'owner']} · 버전 {record.summary.revision}{record.summary.archived?' · 보관됨':''}</p>{onEdit&&canEditProject(record.summary.role??'owner')&&!record.summary.archived&&<button className="button primary" onClick={()=>onEdit(projectId)}>편집기로 열기</button>}<div className="archive-layout-tools"><label>기록 배치<select value={sceneId??''} onChange={e=>setSceneId(e.target.value||null)}><option value="">현재 배치</option>{record.project.scenes.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><button className="button secondary" onClick={()=>setPreview(true)}>읽기 전용 3D 보기</button></div>
 <nav className="archive-tabs" aria-label="전시 기록 항목">{ARCHIVE_SECTIONS.map(([key,label])=><button key={key} aria-pressed={section===key} onClick={()=>setSection(key)}>{label}</button>)}</nav><ProjectArchiveContents project={record.project} layout={layout} section={section} onScene={id=>{setSceneId(id);setSection('space');}}/>
 <ReviewCommentsPanel shareId={projectId} privateProject={{id:projectId,name:record.project.name}}/>
 {preview&&<ScreenRecoveryBoundary name="공동 프로젝트 3D 보기" onClose={()=>setPreview(false)}><Suspense fallback={<p role="status">3D 보기 불러오는 중…</p>}><PresentationMode source={{project:sceneId?layout:record.project,camera:record.project.scenes.find(s=>s.id===sceneId)?.cameraView,cutaway:true}} onClose={()=>setPreview(false)} returnLabel="공동 프로젝트로 돌아가기"/></Suspense></ScreenRecoveryBoundary>}
 </>}
 </dialog>;
}
