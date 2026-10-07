import {useEffect,useRef,useState} from 'react';
import {Copy,Link2,LoaderCircle,Trash2,X} from 'lucide-react';
import {PUBLIC_SCENES_MAX} from '../domain/publicShare';
import type {Project} from '../domain/types';
import type {CameraView3D} from './cameraView3d';
import {listPublicShares,publishPublicShare,revokePublicShare,type ShareListItem} from '../lib/shareClient';

export function ShareDialog({project,onClose,getCamera}:{project:Project;onClose:()=>void;getCamera?:()=>CameraView3D|null}){
  const ref=useRef<HTMLDialogElement>(null);
  const [ownerToken,setOwnerToken]=useState('');
  const [includeDimensions,setIncludeDimensions]=useState(false);
  const [includeArtworkDetails,setIncludeArtworkDetails]=useState(false);
  const [sceneIds,setSceneIds]=useState<string[]>([]);
  const [items,setItems]=useState<ShareListItem[]|null>(null);
  const [link,setLink]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const uncalibrated=!!project.planDraft&&!project.planReference?.calibrated;
  useEffect(()=>{ref.current?.showModal();},[]);
  async function refresh(){
    if(!ownerToken.trim()){setError('작성자 키를 입력해 주세요.');return;}
    setBusy(true);setError('');
    try{setItems(await listPublicShares(ownerToken.trim()));}catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function create(){
    if(!ownerToken.trim()){setError('작성자 키를 입력해 주세요.');return;}
    setBusy(true);setError('');setLink('');
    try{
      const url=await publishPublicShare(project,{includeDimensions,includeArtworkDetails,sceneIds},ownerToken.trim(),getCamera?.()??undefined);
      setLink(url);
      setItems(await listPublicShares(ownerToken.trim()));
      try{await navigator.clipboard.writeText(url);}catch{/* Link remains available for manual copy. */}
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function revoke(id:string){
    if(!window.confirm('이 공유 링크를 중단할까요? 이후 새 열람과 이미지·3D 모델·영상 요청이 차단됩니다.'))return;
    setBusy(true);setError('');
    try{await revokePublicShare(id,ownerToken.trim());setItems(await listPublicShares(ownerToken.trim()));if(link.endsWith(id))setLink('');}catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function copy(url:string){try{await navigator.clipboard.writeText(url);}catch{setError('자동 복사에 실패했습니다. 링크를 직접 선택해 복사해 주세요.');}}
  return <dialog ref={ref} className="share-dialog" aria-label="보기 전용 링크 공유" onCancel={e=>{if(busy)e.preventDefault();else onClose();}} onClick={e=>{if(!busy&&e.target===e.currentTarget)onClose();}}>
    <div className="dialog-header"><div><h2>보기 전용 링크 공유</h2><p>현재 배치와 선택한 Scene을 고정된 상태로 공유합니다.</p></div><button className="icon-button" aria-label="공유 창 닫기" disabled={busy} onClick={onClose}><X size={18}/></button></div>
    <p className="share-explain">링크를 가진 사람은 로그인 없이 열람할 수 있습니다. 원본 도면·내부 메모·선택하지 않은 Scene은 포함하지 않습니다. 나중에 편집해도 이미 만든 링크는 바뀌지 않습니다.</p>
    {project.outdoor?.mode==='outdoor'&&<p className="share-explain">야외의 위치 좌표·날짜·시간·북쪽 방향을 포함해 같은 태양과 그림자로 표시합니다.</p>}
    {project.modelArtworks?.some(a=>a.visible)&&<p className="share-explain">표시 중인 3D 작품의 형상·재질과 작품 정보를 포함합니다. 공유 화면에서는 이동·회전·삭제할 수 없습니다.</p>}
    {(project.artworks.some(a=>a.video)||project.scenes.some(s=>s.artworks.some(a=>a.video)))&&<p className="share-explain">표시되는 영상 스크린의 원본 영상도 공개합니다. 열람자는 배치를 수정할 수 없으며 재생·소리만 조절합니다. 원본 하나 16MiB, 전체 Scene 합계 80MiB·20개까지입니다.</p>}
    <label className="share-key">작성자 키<input type="password" disabled={busy} autoComplete="off" aria-label="작성자 키" value={ownerToken} onChange={e=>setOwnerToken(e.target.value)} placeholder="공유 서버의 작성자 키"/></label>
    <label className="share-check"><input type="checkbox" checked={includeDimensions} disabled={busy} onChange={e=>setIncludeDimensions(e.target.checked)}/> 치수 공개</label>
    <label className="share-check"><input type="checkbox" checked={includeArtworkDetails} disabled={busy} onChange={e=>setIncludeArtworkDetails(e.target.checked)}/> 작품 상세 정보 공개</label>
    <p className="share-explain">이름·작가·연도는 기본 공개합니다. 상세 정보 공개를 켜면 재료·작품 설명·작품 종류·설치 형식을 선택한 모든 배치에 포함합니다. 내부 설치 메모는 포함하지 않습니다.</p>
    {project.scenes.length>0&&<fieldset className="share-scenes" disabled={busy}><legend>함께 공유할 Scene</legend><p>현재 배치는 항상 포함됩니다. 선택한 Scene의 작품·공간·조명·시점을 함께 공개합니다. 최대 {PUBLIC_SCENES_MAX}개.</p>{project.scenes.map(scene=><label className="share-check" key={scene.id}><input type="checkbox" checked={sceneIds.includes(scene.id)} disabled={!sceneIds.includes(scene.id)&&sceneIds.length>=PUBLIC_SCENES_MAX} onChange={e=>setSceneIds(ids=>e.target.checked?[...ids,scene.id]:ids.filter(id=>id!==scene.id))}/>{scene.name}</label>)}</fieldset>}
    {uncalibrated&&<p className="share-error">도면의 두 점 축척을 보정한 뒤 3D 공간을 공유할 수 있습니다.</p>}
    {project.referenceModel?.visible&&<p className="share-explain">가져온 전시장 3D 모델의 전체 형상·재질·배치를 포함합니다. 공유 화면에서 편집할 수 없으며 원본 파일명은 전달하지 않습니다.</p>}
    <div className="share-actions"><button className="button primary" disabled={busy||uncalibrated} onClick={()=>void create()}>{busy?<LoaderCircle size={16} className="spin"/>:<Link2 size={16}/>} 링크 만들기</button><button className="button secondary" disabled={busy} onClick={()=>void refresh()}>공유 목록</button></div>
    {error&&<p className="share-error" role="alert">{error}</p>}
    {link&&<div className="share-created"><strong>새 링크</strong><div><input aria-label="생성된 공유 링크" readOnly value={link} onFocus={e=>e.currentTarget.select()}/><button className="button secondary" onClick={()=>void copy(link)}><Copy size={15}/> 복사</button></div></div>}
    {items&&<div className="share-list"><strong>만든 링크</strong>{items.length===0?<p>아직 만든 링크가 없습니다.</p>:items.map(item=><div className="share-row" key={item.id}><span><b>{item.name}</b><small>{new Date(item.createdAt).toLocaleDateString('ko-KR')} · {item.includeDimensions?'치수 공개':'치수 비공개'}{item.includeArtworkDetails?' · 작품 상세 공개':''}{item.sceneCount?` · Scene ${item.sceneCount}개`:''} · {item.status==='revoked'?'중단됨':'열람 가능'}</small></span>{item.status==='active'&&<><button aria-label={`${item.name} 링크 복사`} title="링크 복사" onClick={()=>void copy(`${location.origin}/s/${item.id}`)}><Copy size={15}/></button><button aria-label={`${item.name} 공유 중단`} title="공유 중단" disabled={busy} onClick={()=>void revoke(item.id)}><Trash2 size={15}/></button></>}</div>)}</div>}
  </dialog>;
}
