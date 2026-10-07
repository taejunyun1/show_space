import {useEffect,useRef,useState} from 'react';
import {Cloud,RefreshCw} from 'lucide-react';
import {cloudSession,useAuth} from '../state/auth';
import {AccountDialog} from './AccountDialog';
import {createCloudLibraryClient} from '../lib/cloudLibraryClient';
import {createCloudLibrarySync} from '../lib/cloudLibrarySync';
import {materialCategoryLabels,type MaterialCategory} from '../domain/materialLibrary';
import type {CloudLibrarySummary,LibraryKind} from '../domain/cloudLibrary';

export function CloudLibraryPanel({kind,localItems,disabled,onBusy,onImported}:{kind:LibraryKind;localItems:{id:string;name:string;archived?:boolean}[];disabled:boolean;onBusy:(busy:boolean)=>void;onImported:()=>Promise<void>}){
 const auth=useAuth(),[accountOpen,setAccountOpen]=useState(false),[items,setItems]=useState<CloudLibrarySummary[]>([]),[localId,setLocalId]=useState(''),[archived,setArchived]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const alive=useRef(true),running=useRef(false),controller=useRef<AbortController|null>(null),generation=useRef(0),label=kind==='artwork'?'작품':'재질';
 const enabled=auth.status==='signedIn'&&auth.config?.cloudEnabled===true;
 useEffect(()=>{if(!localItems.some(i=>i.id===localId))setLocalId(localItems[0]?.id??'');},[localItems,localId]);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;controller.current?.abort();};},[]);
 useEffect(()=>{generation.current++;controller.current?.abort();setItems([]);setError('');setMessage('');},[auth.user?.id,enabled]);
 useEffect(()=>{onBusy(busy);return()=>onBusy(false);},[busy,onBusy]);
 async function run(action:(client:ReturnType<typeof createCloudLibraryClient>,sync:ReturnType<typeof createCloudLibrarySync>,guard:()=>void)=>Promise<void>){
  if(running.current||disabled||!enabled)return;running.current=true;setBusy(true);setError('');setMessage('');const userId=auth.user!.id,epoch=generation.current,c=new AbortController();controller.current=c;
  const guard=()=>{if(!alive.current||c.signal.aborted||generation.current!==epoch||useAuth.getState().user?.id!==userId)throw new Error('계정이 바뀌어 작업을 중단했습니다. 저장 결과는 계정 목록에서 다시 확인해주세요.');};
  try{guard();const session=await cloudSession();guard();if(session.userId!==userId)throw new Error('계정 세션이 바뀌었습니다.');const client=createCloudLibraryClient(session.token,fetch,c.signal),sync=createCloudLibrarySync(userId,client,{guard});await action(client,sync,guard);guard();const list=await client.list(kind);guard();setItems(list);}
  catch(e){if(alive.current&&generation.current===epoch)setError(e instanceof Error?e.message:'계정 라이브러리 작업에 실패했습니다.');}
  finally{running.current=false;if(controller.current===c)controller.current=null;if(alive.current)setBusy(false);}
 }
 const unavailable=auth.status==='loading'?'계정 연결을 확인하고 있습니다.':auth.status==='disabled'?'로그인 서비스가 아직 연결되지 않았습니다. 로컬 저장과 백업을 사용할 수 있습니다.':auth.status==='signedIn'?'이 계정의 클라우드 저장을 아직 사용할 수 없습니다.':'로그인하면 선택한 항목을 계정에 보관하고 다른 기기에서 가져올 수 있습니다.';
 return <section className="cloud-library-panel" aria-label={`계정 ${label} 라이브러리`}>
  <h3><Cloud size={17}/>계정 {label} 라이브러리</h3>
  {!enabled?<><p className="field-hint">{unavailable}</p><button className="button secondary" disabled={auth.status==='loading'||disabled} onClick={()=>setAccountOpen(true)}>계정 로그인</button></>:<>
   <p className="field-hint">선택한 항목만 계정에 저장합니다. 연결된 항목은 다시 저장하거나 가져오면 갱신됩니다. 양쪽 수정이 충돌하면 덮어쓰지 않으며, 새 계정 또는 로컬 복사본을 만들 수 있습니다.</p>
   <div className="cloud-library-actions"><select aria-label={`계정에 저장할 ${label}`} disabled={disabled||busy||!localItems.length} value={localId} onChange={e=>setLocalId(e.target.value)}>{!localItems.length&&<option value="">먼저 로컬 라이브러리에 저장하세요</option>}{localItems.map(item=><option key={item.id} value={item.id}>{item.name}{item.archived?' · 보관됨':''}</option>)}</select><button className="button primary" disabled={disabled||busy||!localId} onClick={()=>void run(async(_client,sync,guard)=>{const saved=await sync.push(kind,localId);guard();setMessage(`‘${saved.name}’을 계정에 저장했습니다. 버전 ${saved.revision}`);})}>선택 항목 계정 저장</button><button className="button secondary" disabled={disabled||busy||!localId} onClick={()=>void run(async(_client,sync,guard)=>{await sync.push(kind,localId,true);guard();setMessage('새 계정 복사본을 저장했습니다. 기존 계정 항목은 유지됩니다.');})}>새 계정 복사본으로 저장</button><button className="button secondary" disabled={disabled||busy} onClick={()=>void run(async()=>{})}><RefreshCw size={15}/>계정 목록 새로고침</button></div>
   <label className="field-hint"><input type="checkbox" checked={archived} onChange={e=>setArchived(e.target.checked)}/> 계정 보관 항목 보기</label>
   <div className="cloud-library-list">{items.filter(i=>i.archived===archived).map(item=><article key={item.id} aria-label={`${item.name} 계정 ${label}`}><div><strong>{item.name}</strong><small>{kind==='material'?(materialCategoryLabels[item.detail as MaterialCategory]??item.detail):item.detail} · 버전 {item.revision} · {(item.bytes/1024/1024).toFixed(1)} MB</small><small>{new Date(item.updatedAt).toLocaleString('ko-KR')}</small></div><div className="cloud-library-actions"><button className="button secondary" disabled={disabled||busy} onClick={()=>void run(async(_client,sync,guard)=>{const result=await sync.pull(kind,item.id);guard();await onImported();guard();setMessage(result.unchanged?'이미 최신 로컬 항목입니다.':`‘${item.name}’을 로컬 라이브러리에 가져왔습니다.`);})}>로컬 라이브러리로 가져오기</button><button className="button secondary" disabled={disabled||busy} onClick={()=>void run(async(_client,sync,guard)=>{await sync.pull(kind,item.id,true);guard();await onImported();guard();setMessage('새 로컬 복사본을 만들었습니다. 이전 로컬 항목은 유지됩니다.');})}>새 로컬 복사본</button><button className="button secondary" disabled={disabled||busy} onClick={()=>void run(async(client,_sync,guard)=>{await client.archive(kind,item.id,item.revision,!item.archived);guard();setMessage(item.archived?'계정 항목을 복구했습니다.':'계정 항목을 보관했습니다. 로컬 항목은 유지됩니다.');})}>{item.archived?'계정 복구':'계정 보관'}</button></div></article>)}</div>
   {!busy&&!items.length&&<p className="field-hint">계정 목록 새로고침으로 저장한 항목을 확인하세요.</p>}
  </>}
  {busy&&<p role="status">계정 자산 처리 중…</p>}{message&&<p className="field-hint" role="status">{message}</p>}{error&&<p className="warning" role="alert">{error}</p>}
  {accountOpen&&<AccountDialog onClose={()=>setAccountOpen(false)}/>}
 </section>;
}
