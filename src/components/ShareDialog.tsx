import {useEffect,useRef,useState} from 'react';
import {Copy,Link2,LoaderCircle,Trash2,X} from 'lucide-react';
import type {Project} from '../domain/types';
import type {CameraView3D} from './cameraView3d';
import {listPublicShares,publishPublicShare,revokePublicShare,type ShareListItem} from '../lib/shareClient';

export function ShareDialog({project,onClose,getCamera}:{project:Project;onClose:()=>void;getCamera?:()=>CameraView3D|null}){
  const ref=useRef<HTMLDialogElement>(null);
  const [ownerToken,setOwnerToken]=useState('');
  const [includeDimensions,setIncludeDimensions]=useState(false);
  const [items,setItems]=useState<ShareListItem[]|null>(null);
  const [link,setLink]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const hasModel=!!project.referenceModel?.visible||!!project.modelArtworks?.some(a=>a.visible);
  const uncalibrated=!!project.planDraft&&!project.planReference?.calibrated;
  useEffect(()=>{ref.current?.showModal();},[]);
  async function refresh(){
    if(!ownerToken.trim()){setError('작성자 키를 입력해 주세요.');return;}
    setBusy(true);setError('');
    try{setItems(await listPublicShares(ownerToken.trim()));}catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function create(){
    if(hasModel){setError('3D 작품·참고 모델을 포함한 링크 공유는 아직 지원하지 않습니다. 모델을 숨긴 배치를 공유하거나 자산 백업·GLB·PNG로 전달하세요.');return;}
    if(!ownerToken.trim()){setError('작성자 키를 입력해 주세요.');return;}
    setBusy(true);setError('');setLink('');
    try{
      const url=await publishPublicShare(project,{includeDimensions},ownerToken.trim(),getCamera?.()??undefined);
      setLink(url);
      setItems(await listPublicShares(ownerToken.trim()));
      try{await navigator.clipboard.writeText(url);}catch{/* Link remains available for manual copy. */}
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function revoke(id:string){
    if(!window.confirm('이 공유 링크를 중단할까요? 이후 새 열람과 이미지 요청이 차단됩니다.'))return;
    setBusy(true);setError('');
    try{await revokePublicShare(id,ownerToken.trim());setItems(await listPublicShares(ownerToken.trim()));if(link.endsWith(id))setLink('');}catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function copy(url:string){try{await navigator.clipboard.writeText(url);}catch{setError('자동 복사에 실패했습니다. 링크를 직접 선택해 복사해 주세요.');}}
  return <dialog ref={ref} className="share-dialog" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div className="dialog-header"><div><h2>보기 전용 링크 공유</h2><p>현재 배치를 고정된 스냅샷으로 공유합니다.</p></div><button className="icon-button" aria-label="공유 창 닫기" onClick={onClose}><X size={18}/></button></div>
    <p className="share-explain">링크를 가진 사람은 로그인 없이 열람할 수 있습니다. 원본 도면·내부 메모·다른 Scene은 포함하지 않습니다. 나중에 편집해도 이미 만든 링크는 바뀌지 않습니다.</p>
    {project.outdoor?.mode==='outdoor'&&<p className="share-explain">야외의 위치 좌표·날짜·시간·북쪽 방향을 포함해 같은 태양과 그림자로 표시합니다.</p>}
    <label className="share-key">작성자 키<input type="password" autoComplete="off" aria-label="작성자 키" value={ownerToken} onChange={e=>setOwnerToken(e.target.value)} placeholder="공유 서버의 작성자 키"/></label>
    <label className="share-check"><input type="checkbox" checked={includeDimensions} onChange={e=>setIncludeDimensions(e.target.checked)}/> 치수 공개</label>
    {uncalibrated&&<p className="share-error">도면의 두 점 축척을 보정한 뒤 3D 공간을 공유할 수 있습니다.</p>}
    {hasModel&&<p className="plan-quality-warning">3D 작품·참고 모델을 포함한 링크 공유는 아직 지원하지 않습니다. 모델을 숨긴 배치를 공유하거나 자산 백업·GLB·PNG로 전달하세요.</p>}
    <div className="share-actions"><button className="button primary" disabled={busy||uncalibrated||hasModel} onClick={()=>void create()}>{busy?<LoaderCircle size={16} className="spin"/>:<Link2 size={16}/>} 링크 만들기</button><button className="button secondary" disabled={busy} onClick={()=>void refresh()}>공유 목록</button></div>
    {error&&<p className="share-error" role="alert">{error}</p>}
    {link&&<div className="share-created"><strong>새 링크</strong><div><input aria-label="생성된 공유 링크" readOnly value={link} onFocus={e=>e.currentTarget.select()}/><button className="button secondary" onClick={()=>void copy(link)}><Copy size={15}/> 복사</button></div></div>}
    {items&&<div className="share-list"><strong>만든 링크</strong>{items.length===0?<p>아직 만든 링크가 없습니다.</p>:items.map(item=><div className="share-row" key={item.id}><span><b>{item.name}</b><small>{new Date(item.createdAt).toLocaleDateString('ko-KR')} · {item.includeDimensions?'치수 공개':'치수 비공개'} · {item.status==='revoked'?'중단됨':'열람 가능'}</small></span>{item.status==='active'&&<><button aria-label={`${item.name} 링크 복사`} title="링크 복사" onClick={()=>void copy(`${location.origin}/s/${item.id}`)}><Copy size={15}/></button><button aria-label={`${item.name} 공유 중단`} title="공유 중단" disabled={busy} onClick={()=>void revoke(item.id)}><Trash2 size={15}/></button></>}</div>)}</div>}
  </dialog>;
}
