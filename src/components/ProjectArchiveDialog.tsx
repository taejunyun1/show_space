import {lazy,Suspense,useEffect,useMemo,useRef,useState} from 'react';
import {RefreshCw,X} from 'lucide-react';
import {ARCHIVE_SECTIONS,archiveLayout,archiveYear,filterArchiveProjects,type ArchiveSection,type ArchiveSummary} from '../domain/projectArchive';
import type {Project} from '../domain/types';
import {readCloudArchiveProject,readLocalArchiveProject,saveArchiveCopy} from '../lib/projectArchive';
import {projectLibrary} from '../lib/projectLibrary';
import {openLocalProject} from '../lib/persistence';
import {createCloudProjectClient} from '../lib/cloudProjectClient';
import {cloudSession,useAuth} from '../state/auth';
import {flushAutosave,useEditor} from '../state/editor';
import {ProjectArchiveContents} from './ProjectArchiveContents';
import {AccountDialog} from './AccountDialog';
import {ScreenRecoveryBoundary} from './ScreenRecoveryBoundary';
import './projectArchive.css';
const PresentationMode=lazy(()=>import('./PresentationMode'));
type Detail={summary:ArchiveSummary;project:Project};
type Tagged<T>={context:string;value:T};
export default function ProjectArchiveDialog({onClose,onReused}:{onClose:()=>void;onReused:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),auth=useAuth(),[source,setSource]=useState<'local'|'cloud'>('local');
 const context=source==='local'?'local':`cloud:${auth.user?.id??'signedOut'}:${!!auth.config?.cloudEnabled}`;
 const liveContext=useRef(context);liveContext.current=context;
 const mounted=useRef(false),controller=useRef<AbortController|null>(null),working=useRef(false);
 const [items,setItems]=useState<Tagged<ArchiveSummary[]>>(),[detail,setDetail]=useState<Tagged<Detail>>(),[pending,setPending]=useState<Tagged<boolean>>(),[error,setError]=useState<Tagged<string>>();
 const [query,setQuery]=useState(''),[status,setStatus]=useState<'all'|'active'|'archived'>('all'),[year,setYear]=useState(''),[sort,setSort]=useState<'updated'|'name'>('updated');
 const [section,setSection]=useState<ArchiveSection>('space'),[sceneId,setSceneId]=useState<string|null>(null),[copyName,setCopyName]=useState(''),[account,setAccount]=useState(false),[preview,setPreview]=useState<Tagged<{project:Project;camera?:Project['scenes'][number]['cameraView'];cutaway:boolean}>>();
 const list=items?.context===context?items.value:[],record=detail?.context===context?detail.value:undefined,busy=pending?.context===context&&pending.value;
 const layout=useMemo(()=>record?archiveLayout(record.project,sceneId):undefined,[record,sceneId]);
 const visible=filterArchiveProjects(list,query,status,year,sort),years=[...new Set(list.map(archiveYear))].sort().reverse();
 useEffect(()=>{mounted.current=true;dialog.current?.showModal();return()=>{mounted.current=false;controller.current?.abort();};},[]);
 // Tagged data is hidden synchronously on account/source changes, before this effect runs.
 useEffect(()=>{controller.current?.abort();working.current=false;setDetail(undefined);setPreview(undefined);setSceneId(null);setYear('');setError(undefined);void refresh();return()=>{controller.current?.abort();};},[context]); // eslint-disable-line react-hooks/exhaustive-deps
 function begin(){controller.current?.abort();const c=new AbortController(),captured=context;controller.current=c;setPending({context:captured,value:true});setError(undefined);
  const guard=()=>{if(!mounted.current||c.signal.aborted||liveContext.current!==captured||source==='cloud'&&useAuth.getState().user?.id!==auth.user?.id)throw new Error('아카이브 작업이 취소되었습니다.');};
  return {c,captured,guard};
 }
 async function client(guard:()=>void,c:AbortController){const session=await cloudSession();guard();if(session.userId!==auth.user?.id)throw new Error('로그인 계정이 바뀌었습니다.');return createCloudProjectClient(session.token,fetch,c.signal);}
 function fail(e:unknown,c:AbortController,captured:string){if(mounted.current&&!c.signal.aborted&&liveContext.current===captured)setError({context:captured,value:e instanceof Error?e.message:'아카이브 작업을 완료하지 못했습니다.'});}
 function finish(c:AbortController,captured:string){if(mounted.current&&controller.current===c){setPending({context:captured,value:false});working.current=false;}}
 async function refresh(){
  const {c,captured,guard}=begin();setDetail(undefined);setPreview(undefined);setSceneId(null);
  try{if(source==='cloud'&&(!auth.user||!auth.config?.cloudEnabled)){setItems({context:captured,value:[]});return;}
   const values=source==='local'?await projectLibrary().list():await (await client(guard,c)).list();guard();setItems({context:captured,value:values});
  }catch(e){fail(e,c,captured);}finally{finish(c,captured);}
 }
 async function select(item:ArchiveSummary){if(working.current)return;const {c,captured,guard}=begin();setDetail(undefined);setPreview(undefined);setSceneId(null);
  try{const value=source==='local'?await readLocalArchiveProject(item.id,item.revision):await readCloudArchiveProject(await client(guard,c),item.id,item.revision,guard);guard();setDetail({context:captured,value});setCopyName((value.project.name+' 재사용').slice(0,200));setSection('space');}
  catch(e){fail(e,c,captured);}finally{finish(c,captured);}
 }
 async function reuse(){if(!record||working.current||busy)return;working.current=true;const originalId=useEditor.getState().project.id,{c,captured,guard}=begin();
  const current=()=>{guard();if(useEditor.getState().project.id!==originalId)throw new Error('현재 프로젝트가 바뀌어 재사용을 중단했습니다.');};
  try{await flushAutosave();current();const saved=await saveArchiveCopy(record.project,copyName,projectLibrary(),current);current();const next=await openLocalProject(saved.project.id);current();useEditor.getState().loadProject(next,true);onReused();}
  catch(e){fail(e,c,captured);}finally{finish(c,captured);}
 }
 return <dialog ref={dialog} className="export-dialog archive-dialog" aria-label="전시 아카이브" onCancel={e=>{if(working.current)e.preventDefault();else onClose();}}><div className="dialog-header"><h2>전시 아카이브</h2><button className="icon-button" aria-label="전시 아카이브 닫기" disabled={working.current} onClick={onClose}><X size={18}/></button></div>
 <p className="field-hint">저장된 전시의 공간·배치·재질·조명·메모·Scene·참고 사진을 열람합니다. 새 프로젝트로 재사용해도 보관 원본은 유지됩니다.</p>
 <div className="archive-sources" role="group" aria-label="아카이브 저장 위치"><button className="button secondary" aria-pressed={source==='local'} disabled={working.current} onClick={()=>setSource('local')}>이 브라우저</button><button className="button secondary" aria-pressed={source==='cloud'} disabled={working.current} onClick={()=>setSource('cloud')}>내 계정</button><button className="button secondary" disabled={busy} onClick={()=>void refresh()}><RefreshCw size={15}/>목록 새로고침</button></div>
 {source==='cloud'&&<p className="field-hint">{auth.status==='loading'?'계정 연결 확인 중…':!auth.config?.cloudEnabled?'계정 아카이브 연결을 준비 중입니다. 이 브라우저의 아카이브는 계속 사용할 수 있습니다.':auth.user?`${auth.user.email} · 비공개 계정 아카이브`:'계정에 저장한 전시를 보려면 로그인하세요.'}</p>}
 {source==='cloud'&&auth.config?.cloudEnabled&&!auth.user&&<button className="button secondary" onClick={()=>setAccount(true)}>계정 로그인</button>}
 <div className="archive-filters"><label>검색<input type="search" value={query} placeholder="전시·전시장·연도" onChange={e=>setQuery(e.target.value)}/></label><label>보관 상태<select value={status} onChange={e=>setStatus(e.target.value as typeof status)}><option value="all">전체</option><option value="archived">보관됨</option><option value="active">사용 중</option></select></label><label>수정 연도<select value={year} onChange={e=>setYear(e.target.value)}><option value="">전체 연도</option>{years.map(y=><option key={y}>{y}</option>)}</select></label><label>정렬<select value={sort} onChange={e=>setSort(e.target.value as typeof sort)}><option value="updated">최근 수정순</option><option value="name">이름순</option></select></label></div>
 {error?.context===context&&<p className="warning" role="alert">{error.value}</p>}{busy&&<p role="status">{working.current?'새 프로젝트로 재사용하는 중…':'아카이브를 읽는 중…'}</p>}
 <div className="archive-body"><nav className="archive-list" aria-label="저장된 전시">{visible.map(item=><button key={item.id} className="archive-list-item" disabled={working.current} aria-pressed={record?.summary.id===item.id} onClick={()=>void select(item)}><strong>{item.name}</strong><span>{item.venue||'전시장 미지정'}</span><small>{item.archived?'보관됨':'사용 중'} · {new Date(item.updatedAt).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'})}</small></button>)}{!busy&&!visible.length&&<p className="field-hint">저장된 전시 또는 검색 결과가 없습니다.</p>}</nav>
 <section className="archive-detail" aria-label="전시 기록">{record&&layout?<><header><h3>{record.project.name}</h3><p>{record.project.venue||'전시장 미지정'} · {record.summary.archived?'보관됨':'사용 중'} · 버전 {record.summary.revision}</p></header>
 <div className="archive-layout-tools"><label>기록 배치<select value={sceneId??''} disabled={busy} onChange={e=>setSceneId(e.target.value||null)}><option value="">현재 배치</option>{record.project.scenes.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label><button className="button secondary" disabled={busy} onClick={()=>setPreview({context,value:{project:sceneId?layout:record.project,camera:record.project.scenes.find(s=>s.id===sceneId)?.cameraView,cutaway:true}})}>읽기 전용 3D 보기</button></div>
 <nav className="archive-tabs" aria-label="전시 기록 항목">{ARCHIVE_SECTIONS.map(([key,label])=><button key={key} aria-pressed={section===key} onClick={()=>setSection(key)}>{label}</button>)}</nav>
 <ProjectArchiveContents project={record.project} layout={layout} section={section} onScene={id=>{setSceneId(id);setSection('space');}}/>
 <form className="archive-reuse" onSubmit={e=>{e.preventDefault();void reuse();}}><p className="field-hint">현재 배치와 모든 Scene·자산·메모를 함께 복사합니다. 계정 자동 저장 연결은 복사하지 않습니다.</p><label>새 프로젝트 이름<input required maxLength={200} disabled={busy} value={copyName} onChange={e=>setCopyName(e.target.value)}/></label><button className="button primary" type="submit" disabled={busy||!copyName.trim()}>새 프로젝트로 재사용</button></form>
 </>:<p className="field-hint">왼쪽에서 전시를 선택하세요. 기록을 열람해도 편집 중인 전시는 바뀌지 않습니다.</p>}</section></div>
 {account&&<AccountDialog onClose={()=>setAccount(false)}/>}
 {preview?.context===context&&<ScreenRecoveryBoundary name="아카이브 3D 보기" onClose={()=>setPreview(undefined)}><Suspense fallback={<p role="status">3D 보기를 불러오는 중…</p>}><PresentationMode source={preview.value} returnLabel="아카이브로 돌아가기" onClose={()=>setPreview(undefined)}/></Suspense></ScreenRecoveryBoundary>}
 </dialog>;
}
