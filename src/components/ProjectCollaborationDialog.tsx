import {useEffect,useRef,useState} from 'react';
import {X} from 'lucide-react';
import {createCollaborationClient} from '../lib/collaborationClient';
import {newInviteToken,inviteEmail,projectRoleLabels,type MemberRole,type ProjectMember,type ProjectInvitation} from '../domain/collaboration';
import {cloudSession,useAuth} from '../state/auth';
import {useEditor} from '../state/editor';
type Props={projectId:string;name:string;onClose:()=>void};
export default function ProjectCollaborationDialog(props:Props){return <CollaborationContents key={props.projectId} {...props}/>;}
function CollaborationContents({projectId,name,onClose}:Props){
 const opening=useRef({userId:useAuth.getState().user?.id,localId:useEditor.getState().project.id,version:useEditor.getState().projectContextVersion}),context=JSON.stringify([projectId,opening.current.userId]);
 const ref=useRef<HTMLDialogElement>(null),mounted=useRef(false),valid=useRef(true),controller=useRef<AbortController|null>(null),draft=useRef<{id:string;email:string;role:MemberRole;token:string}|undefined>(undefined),linkVersion=useRef(0),close=useRef(onClose);close.current=onClose;
 const [data,setData]=useState<{context:string;members:ProjectMember[];invitations:ProjectInvitation[];truncated:boolean}>(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[email,setEmail]=useState(''),[role,setRole]=useState<MemberRole>('viewer'),[link,setLink]=useState<{context:string;id:string;url:string}>(),[copied,setCopied]=useState(false);
 function inScope(){const scope=opening.current,state=useEditor.getState();return useAuth.getState().user?.id===scope.userId&&state.project.id===scope.localId&&state.projectContextVersion===scope.version;}
 function retire(explicit=false){controller.current?.abort();controller.current=null;if(mounted.current){setBusy(false);if(explicit)setNotice('공동 작업을 취소했습니다. 이미 반영된 초대·역할은 목록을 새로고침해 확인할 수 있습니다.');}}
 useEffect(()=>{
  mounted.current=true;if(!ref.current?.open)ref.current?.showModal();
  const changed=()=>{if(!valid.current)return;valid.current=false;retire();draft.current=undefined;linkVersion.current++;setData(undefined);setLink(undefined);setEmail('');close.current();};
  const stopAuth=useAuth.subscribe((next,previous)=>{if(next.user?.id!==previous.user?.id)changed();});
  const stopEditor=useEditor.subscribe((next,previous)=>{if(next.project.id!==previous.project.id||next.projectContextVersion!==previous.projectContextVersion)changed();});
  if(inScope())void run();else changed();return()=>{mounted.current=false;retire();linkVersion.current++;stopAuth();stopEditor();};
 },[]);
 async function run(action?:(client:ReturnType<typeof createCollaborationClient>,guard:()=>void)=>Promise<void>){
  const identity=opening.current.userId;if(controller.current||!identity||!mounted.current||!valid.current||!inScope())return;const c=new AbortController();controller.current=c;setBusy(true);setError('');setNotice('');
  const owns=()=>mounted.current&&valid.current&&controller.current===c&&inScope(),guard=()=>{if(!owns()||c.signal.aborted)throw new Error('작업 범위가 바뀌어 공동 작업을 취소했습니다.');};
  try{guard();const session=await cloudSession();guard();if(session.userId!==identity)throw new Error('로그인 계정이 바뀌었습니다.');const client=createCollaborationClient(session.token,fetch,c.signal);await action?.(client,guard);guard();const [members,invitations]=await Promise.all([client.members(projectId),client.invitations(projectId)]);guard();setData({context,members:members.items,invitations:invitations.items,truncated:members.truncated||invitations.truncated});}
  catch(e){if(owns()&&!c.signal.aborted)setError(e instanceof Error?e.message:'공동 작업을 완료하지 못했습니다.');}
  finally{if(controller.current===c){controller.current=null;if(mounted.current)setBusy(false);}}
 }
 async function create(){if(controller.current||!valid.current)return;let recipient;try{recipient=inviteEmail(email);}catch(e){setError((e as Error).message);return;}if(!draft.current||draft.current.email!==recipient||draft.current.role!==role)draft.current={id:crypto.randomUUID(),email:recipient,role,token:newInviteToken()};const value=draft.current;await run(async(client,guard)=>{const result=await client.invite(projectId,value);guard();if(result.status!=='pending'){draft.current=undefined;throw new Error('이미 처리된 초대입니다. 새 초대를 만들어 주세요.');}linkVersion.current++;setLink({context,id:value.id,url:location.origin+'/join/'+value.id+'#token='+value.token});setCopied(false);draft.current=undefined;});}
 const rows=valid.current&&data?.context===context?data:undefined,visibleLink=valid.current&&link?.context===context?link.url:undefined;
 async function copyLink(){const version=linkVersion.current;if(!visibleLink||!valid.current||!inScope())return;try{await navigator.clipboard.writeText(visibleLink);if(mounted.current&&valid.current&&version===linkVersion.current&&inScope())setCopied(true);}catch{if(mounted.current&&valid.current&&version===linkVersion.current&&inScope())setError('위 링크를 직접 선택해 복사해 주세요.');}}
 return <dialog ref={ref} className="export-dialog notes-dialog" aria-label="프로젝트 공동 작업" onCancel={onClose}><div className="dialog-header"><h2>{name} · 공동 작업</h2><button className="icon-button" aria-label="공동 작업 닫기" onClick={onClose}><X size={18}/></button></div>
 <p className="warning">초대한 계정은 작품·이미지·3D 자산·내부 설치 메모·사진을 포함한 비공개 프로젝트 전체를 읽습니다. 공개된 잠금 공유 링크와 별도 권한입니다.</p>
 <p className="field-hint">편집자는 배치를 저장하고 의견을 작성합니다. 열람자는 읽기만, 댓글 참여자는 읽기와 의견 작성만 가능합니다. 보관·역할·초대 관리는 소유자만 할 수 있습니다. 실시간 동시 편집은 지원하지 않으며 저장 충돌 때 복사본을 보존합니다.</p>
 <form onSubmit={e=>{e.preventDefault();void create();}}><label>초대할 계정 이메일<input type="email" required maxLength={254} value={email} disabled={busy||!valid.current} onChange={e=>setEmail(e.target.value)}/></label><label>참여 역할<select value={role} disabled={busy||!valid.current} onChange={e=>setRole(e.target.value as MemberRole)}>{(['viewer','editor','commenter'] as const).map(r=><option key={r} value={r}>{projectRoleLabels[r]}</option>)}</select></label><button className="button primary" disabled={busy||!valid.current}>7일 유효 초대 링크 만들기</button></form>
 {visibleLink&&<div><p>이 링크를 직접 전달하세요. 지정한 이메일 계정만 수락할 수 있습니다. 닫기 전에 복사해 주세요.</p><input aria-label="새 초대 링크" readOnly value={visibleLink}/><button className="button secondary" onClick={()=>void copyLink()}>{copied?'복사됨':'초대 링크 복사'}</button></div>}
 <button className="button secondary" disabled={busy||!valid.current} onClick={()=>void run()}>참여자 목록 새로고침</button>{busy&&<><p role="status">공동 작업 처리 중…</p><button className="button secondary" onClick={()=>retire(true)}>공동 작업 취소</button></>}{notice&&<p role="status">{notice}</p>}{error&&<p className="warning" role="alert">{error}</p>}{rows?.truncated&&<p>최근 기록 200개를 표시합니다.</p>}
 <h3>참여자</h3>{rows?.members.map(m=><article className="project-card" key={m.userId}><strong>{m.email}</strong>{m.revoked?<p>참여 제외됨 · 다시 참여하려면 새 초대가 필요합니다.</p>:<><label>역할<select aria-label={m.email+' 역할'} disabled={busy||!valid.current} value={m.role} onChange={e=>{const nextRole=e.target.value as MemberRole;void run(async client=>{await client.changeMember(projectId,m.userId,m.revision,nextRole,false);});}}>{(['viewer','editor','commenter'] as const).map(r=><option key={r} value={r}>{projectRoleLabels[r]}</option>)}</select></label><button className="button secondary" disabled={busy||!valid.current} onClick={()=>void run(async client=>{await client.changeMember(projectId,m.userId,m.revision,m.role,true);})}>참여 제외</button></>}</article>)}
 <h3>초대 기록</h3>{rows?.invitations.map(i=><article className="project-card" key={i.id}><strong>{i.email}</strong><p>{projectRoleLabels[i.role]} · {i.status==='accepted'?'수락됨':i.status==='revoked'?'취소됨':Date.parse(i.expiresAt)<=Date.now()?'만료됨':'수락 대기'} · {new Date(i.expiresAt).toLocaleString('ko-KR')}</p>{i.status==='pending'&&<button className="button secondary" disabled={busy||!valid.current} onClick={()=>void run(async(client,guard)=>{await client.revokeInvite(projectId,i);guard();if(link?.id===i.id){linkVersion.current++;setLink(undefined);setCopied(false);}})}>초대 취소</button>}</article>)}
 </dialog>;
}
