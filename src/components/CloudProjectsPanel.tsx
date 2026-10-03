import {useEffect,useRef,useState} from 'react';
import {Cloud,Archive,ArchiveRestore} from 'lucide-react';
import {AccountDialog} from './AccountDialog';
import {useAuth,cloudSession} from '../state/auth';
import {useCloudSync,syncCloudProject,cancelCloudProject} from '../state/cloudSync';
import {flushAutosave,useEditor} from '../state/editor';
import {projectLibrary} from '../lib/projectLibrary';
import {createCloudProjectClient} from '../lib/cloudProjectClient';
import type {CloudProjectSummary} from '../domain/cloudProject';
import {copyProject} from '../domain/projects';
import {saveNewLocalProject} from '../lib/persistence';

export function CloudProjectsPanel({disabled,onBusy,onLocalChange}:{disabled:boolean;onBusy:(busy:boolean)=>void;onLocalChange:()=>Promise<void>}){
 const auth=useAuth(),project=useEditor(s=>s.project),cloud=useCloudSync(s=>s.current),controller=useRef<AbortController|null>(null),mounted=useRef(true);
 const [items,setItems]=useState<CloudProjectSummary[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[account,setAccount]=useState(false),[auto,setAuto]=useState(false),[linked,setLinked]=useState(''),[archived,setArchived]=useState(false);
 const current=cloud?.projectId===project.id&&cloud.userId===auth.user?.id?cloud:null;
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();};},[]);
 useEffect(()=>{controller.current?.abort();setItems([]);setError('');setAuto(false);setLinked('');},[auth.user?.id]);
 useEffect(()=>{let cancelled=false;if(auth.user)void Promise.all([projectLibrary().cloudLink(auth.user.id,project.id),projectLibrary().cloudPending(auth.user.id,project.id)]).then(([saved,pending])=>{const link=pending?.link??saved;if(!cancelled){setAuto(link?.autoSync??false);setLinked(link?.cloudProjectId??'');}}).catch(e=>{if(!cancelled)setError(e.message);});return()=>{cancelled=true;};},[auth.user?.id,project.id,current?.status]);
 async function run(action:(client:ReturnType<typeof createCloudProjectClient>,guard:()=>void,userId:string)=>Promise<void>){
  if(busy||disabled)return;const userId=auth.user?.id;if(!userId)return;const c=new AbortController();controller.current=c;setBusy(true);onBusy(true);setError('');
  const guard=()=>{if(c.signal.aborted||useAuth.getState().user?.id!==userId)throw new Error('계정이 바뀌어 클라우드 작업을 취소했습니다.');};
  try{const session=await cloudSession();guard();if(session.userId!==userId)throw new Error('로그인 계정이 바뀌었습니다.');const client=createCloudProjectClient(session.token,fetch,c.signal);await action(client,guard,userId);guard();const list=await client.list();guard();setItems(list);await onLocalChange();}catch(e){if(mounted.current&&useAuth.getState().user?.id===userId)setError(e instanceof Error?e.message:'클라우드 작업을 완료하지 못했습니다.');}finally{if(mounted.current){setBusy(false);onBusy(false);}}
 }
 async function load(item:CloudProjectSummary,client:ReturnType<typeof createCloudProjectClient>,guard:()=>void,userId:string){
  const originalId=useEditor.getState().project.id;await flushAutosave();const result=await client.read(item.id);guard();
  const {readProjectBackup}=await import('../lib/projectBackup');const loaded=await readProjectBackup(new File([result.bytes],'cloud-project.zip',{type:'application/zip'}));guard();
  if(useEditor.getState().project.id!==originalId)throw new Error('현재 프로젝트가 바뀌었습니다. 다시 열어주세요.');
  if(loaded.id!==result.summary.sourceProjectId||loaded.name!==result.summary.name||loaded.venue!==result.summary.venue)throw new Error('클라우드 파일과 프로젝트 정보가 일치하지 않습니다.');
  // Open a new local copy, preserving the active draft and any queued cloud conflict.
  const next=await saveNewLocalProject(copyProject(loaded,loaded.name));guard();const stored=await projectLibrary().read(next.id);if(!stored)throw new Error('프로젝트 로컬 저장을 확인하지 못했습니다.');
  await projectLibrary().saveCloudLink({userId,localProjectId:next.id,cloudProjectId:item.id,revision:result.summary.revision,localRevision:stored.summary.revision,autoSync:true});guard();useEditor.getState().loadProject(next,true);
 }
 return <section className="cloud-projects" aria-label="클라우드 프로젝트"><h3><Cloud size={18}/>내 클라우드 프로젝트</h3>
 {auth.status==='loading'?<p>계정 연결 확인 중…</p>:!auth.config?.cloudEnabled?<p className="field-hint">클라우드 저장 연결을 준비 중입니다. 현재 작업은 이 브라우저에 저장됩니다.</p>:!auth.user?<><p className="field-hint">로그인한 계정에 프로젝트와 이미지·3D 모델을 비공개로 저장합니다.</p><button className="button secondary" onClick={()=>setAccount(true)}>계정 로그인</button></>:<>
 <p className="field-hint">{auth.user.email} · 처음 저장한 뒤 이 프로젝트의 변경 사항을 자동으로 저장합니다. 클라우드 프로젝트를 열면 새 로컬 항목으로 보존합니다.</p>
 <div className="cloud-actions"><button className="button primary" disabled={busy||disabled||current?.status==='saving'} onClick={()=>void run(async()=>{await syncCloudProject(useEditor.getState().project,true);})}>현재 프로젝트 클라우드 저장</button><button className="button secondary" disabled={busy||disabled} onClick={()=>void run(async()=>{})}>클라우드 목록 새로고침</button></div>
 {linked&&<label className="project-outdoor"><input type="checkbox" checked={auto} disabled={busy||disabled||current?.status==='saving'} onChange={e=>{const enabled=e.target.checked;void run(async(_client,guard,userId)=>{await projectLibrary().setCloudAutoSync(userId,project.id,enabled);guard();setAuto(enabled);if(enabled)await syncCloudProject(useEditor.getState().project,true);});}}/>이 프로젝트 클라우드 자동 저장</label>}
 {current&&<p role="status">{current.status==='saved'?'클라우드 저장됨':current.status==='saving'?'클라우드 저장 중…':current.status==='queued'?'클라우드 저장 대기 — 다시 저장하면 재시도합니다.':current.status==='conflict'?'클라우드 저장 충돌 — 현재 작업을 복사본으로 보존할 수 있습니다.':current.message}</p>}
 {current?.status==='conflict'&&<button className="button secondary" disabled={busy||disabled} onClick={()=>void run(async(_client,guard)=>{await flushAutosave().catch(()=>{});guard();const next=await saveNewLocalProject(copyProject(useEditor.getState().project));guard();useEditor.getState().loadProject(next,true);await syncCloudProject(next,true);})}>현재 작업을 새 클라우드 복사본으로 저장</button>}
 <label className="project-outdoor"><input type="checkbox" checked={archived} onChange={e=>setArchived(e.target.checked)}/>보관된 클라우드 프로젝트 보기</label>
 <div className="project-list">{items.filter(item=>item.archived===archived).map(item=><article className="project-card" key={item.id}><div><strong>{item.name}</strong><span>{item.venue||'전시장 미지정'}{linked===item.id?' · 연결된 프로젝트':''}</span><small>클라우드 수정 {new Date(item.updatedAt).toLocaleString('ko-KR')}</small></div><div className="project-card-actions">{!archived&&<button className="button secondary" disabled={busy||disabled} onClick={()=>void run((client,guard,userId)=>load(item,client,guard,userId))}>클라우드에서 열기</button>}<button className="icon-button" aria-label={`${item.name} 클라우드 ${archived?'복구':'보관'}`} disabled={busy||disabled||linked===item.id} onClick={()=>void run(async(client)=>{await client.archive(item.id,item.revision,!archived);})}>{archived?<ArchiveRestore size={16}/>:<Archive size={16}/>}</button></div></article>)}</div>
 {!items.length&&<p className="field-hint">목록 새로고침으로 저장된 프로젝트를 확인하세요.</p>}
 </>}{busy&&<><p role="status">클라우드 작업 중…</p><button className="button secondary" onClick={()=>{controller.current?.abort();cancelCloudProject(useEditor.getState().project.id);}}>클라우드 작업 취소</button></>}{error&&<p className="warning" role="alert">{error}</p>}{account&&<AccountDialog onClose={()=>setAccount(false)}/>}</section>;
}
