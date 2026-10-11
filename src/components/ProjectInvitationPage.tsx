import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import {cloudSession,initializeAuth,useAuth} from '../state/auth';
import {createCollaborationClient,type InvitationPreview} from '../lib/collaborationClient';
import {createCloudProjectClient} from '../lib/cloudProjectClient';
import {openInvitedProject} from '../lib/openInvitedProject';
import {invitationSecret,invitationStorageKey,storedInvitationSecret} from '../domain/projectInvitation';
import {projectRoleLabels} from '../domain/collaboration';
import {AccountDialog} from './AccountDialog';
const TeamProjectDialog=lazy(()=>import('./TeamProjectDialog'));
type Props={invitationId:string|null;onEditorReady?:()=>void};
export default function ProjectInvitationPage(props:Props){return <InvitationContents key={props.invitationId??'invalid'} {...props}/>;}
function InvitationContents({invitationId,onEditorReady=()=>location.assign('/')}:Props){
 const auth=useAuth(),[actorEpoch,setActorEpoch]=useState(0),context=JSON.stringify([invitationId,auth.user?.id,actorEpoch]),live=useRef(context);live.current=context;
 const mounted=useRef(false),controller=useRef<AbortController|null>(null),[secret,setSecret]=useState<string>(),[account,setAccount]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[data,setData]=useState<{context:string;value:InvitationPreview}>(),[viewer,setViewer]=useState(false);
 const invitation=data?.context===context?data.value:undefined;
 function retire(explicit=false){controller.current?.abort();controller.current=null;if(mounted.current){setBusy(false);if(explicit)setNotice('초대 작업을 취소했습니다. 이미 수락한 참여 상태는 다시 확인할 수 있습니다.');}}
 useEffect(()=>{
  mounted.current=true;const stop=useAuth.subscribe((next,previous)=>{if(next.user?.id===previous.user?.id)return;retire();setData(undefined);setViewer(false);setError('');setAccount(false);setActorEpoch(value=>value+1);});
  if(invitationId){const key=invitationStorageKey(invitationId),token=invitationSecret(location.hash);let saved:string|undefined;try{saved=storedInvitationSecret(sessionStorage.getItem(key));if(token)sessionStorage.setItem(key,JSON.stringify({token,expiresAt:Date.now()+7*86400000}));}catch{/* Original link remains usable if storage is disabled. */}setSecret(token??saved);if(token)history.replaceState(null,'',location.pathname+location.search);}
  void initializeAuth();return()=>{mounted.current=false;retire();stop();};
 },[]);
 useEffect(()=>{retire();setData(undefined);setViewer(false);setError('');setNotice('');if(secret&&auth.user?.id)void request(false);return()=>retire();},[context,secret]);
 async function run(action:(client:ReturnType<typeof createCollaborationClient>,guard:()=>void,session:{userId:string;token:string})=>Promise<void>){
  const identity=auth.user?.id;if(controller.current||!mounted.current||!identity||!invitationId||!secret||live.current!==context||useAuth.getState().user?.id!==identity)return;const c=new AbortController(),captured=context;controller.current=c;setBusy(true);setError('');setNotice('');
  const owns=()=>mounted.current&&controller.current===c&&live.current===captured&&useAuth.getState().user?.id===identity,guard=()=>{if(!owns()||c.signal.aborted)throw new Error('로그인 계정 또는 초대가 바뀌었습니다.');};
  try{guard();const session=await cloudSession();guard();if(session.userId!==identity)throw new Error('로그인 계정이 바뀌었습니다.');await action(createCollaborationClient(session.token,fetch,c.signal),guard,session);guard();}
  catch(e){if(owns()&&!c.signal.aborted)setError(e instanceof Error?e.message:'초대를 처리하지 못했습니다.');}
  finally{if(controller.current===c){controller.current=null;if(mounted.current)setBusy(false);}}
 }
 async function request(accept:boolean){await run(async(client,guard)=>{const result=await client.preview(invitationId!,secret!,accept);guard();setData({context,value:result});});}
 async function edit(id:string){await run(async(_client,guard,session)=>{await openInvitedProject(createCloudProjectClient(session.token,fetch,controller.current!.signal),id,session.userId,guard);guard();onEditorReady();});}
 return <main className="shared-error"><h1>비공개 프로젝트 초대</h1>{!invitationId?<p>초대 주소가 올바르지 않습니다.</p>:auth.status==='loading'?<p>계정 연결 확인 중…</p>:auth.status==='disabled'?<p>계정 초대 연결을 준비 중입니다. 계정 연결 이후 원래 초대 링크로 다시 열 수 있습니다.</p>:!secret?<p>초대 토큰이 없습니다. 전달받은 전체 초대 링크를 다시 열어주세요.</p>:!auth.user?.id?<><p>초대받은 이메일 계정으로 로그인하세요.</p><button className="button primary" onClick={()=>setAccount(true)}>계정 로그인</button></>:<><p>{auth.user?.email}</p><button className="button secondary" onClick={()=>setAccount(true)}>계정 확인 / 변경</button>{invitation&&<><h2>{invitation.name}</h2><p>{invitation.venue} · {projectRoleLabels[invitation.role]}</p><p className="warning">수락하면 작품·3D 자산·내부 설치 메모·사진을 포함한 비공개 프로젝트 전체에 접근합니다. 공개 잠금 공유 링크와 별도 권한입니다.</p>{invitation.accepted?<><p>참여 중입니다.</p><button className="button primary" disabled={busy} onClick={()=>setViewer(true)}>공동 프로젝트 열기</button></>:<button className="button primary" disabled={busy} onClick={()=>void request(true)}>이 역할로 초대 수락</button>}</>}<button className="button secondary" disabled={busy} onClick={()=>void request(false)}>초대 다시 확인</button></>}{busy&&<><p role="status">초대 처리 중…</p><button className="button secondary" onClick={()=>retire(true)}>초대 작업 취소</button></>}{notice&&<p role="status">{notice}</p>}{error&&<p className="warning" role="alert">{error}</p>}<a href="/">편집기로 돌아가기</a>{account&&<AccountDialog returnPath={invitationId?'/join/'+invitationId:undefined} onClose={()=>setAccount(false)}/>} {viewer&&invitation?.accepted&&<Suspense fallback={<p>공동 프로젝트 불러오는 중…</p>}><TeamProjectDialog projectId={invitation.projectId} onClose={()=>setViewer(false)} onEdit={id=>void edit(id)}/></Suspense>}</main>;
}
