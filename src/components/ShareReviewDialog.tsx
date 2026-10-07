import {useEffect,useRef,useState} from 'react';
import {X} from 'lucide-react';
import {parsePublicShare,type PublicShareSnapshot} from '../domain/publicShare';
import {ReviewCommentsPanel} from './ReviewCommentsPanel';
import {LengthUnitContext} from './LengthUnits';
export default function ShareReviewDialog({shareId,identity,credential,onClose}:{shareId:string;identity:string;credential:()=>Promise<string>;onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null),[publication,setPublication]=useState<{identity:string;value:PublicShareSnapshot}>(),[error,setError]=useState('');
 useEffect(()=>{ref.current?.showModal();const c=new AbortController();setError('');fetch(`/api/public/${shareId}`,{signal:c.signal,cache:'no-store'}).then(async r=>{if(!r.ok)throw new Error(r.status===410?'중단된 공유 링크입니다.':'공유 화면을 불러오지 못했습니다.');return parsePublicShare(await r.json());}).then(value=>{if(!c.signal.aborted)setPublication({identity,value});}).catch(e=>{if(!c.signal.aborted)setError(e.message);});return()=>c.abort();},[shareId,identity]);
 return <dialog ref={ref} className="export-dialog review-dialog" aria-label="공유 댓글 관리" onCancel={onClose}><header className="dialog-header"><h2>공유 댓글 관리</h2><button type="button" className="icon-button" aria-label="공유 댓글 관리 닫기" onClick={onClose}><X size={18}/></button></header>{error?<p className="warning" role="alert">{error}</p>:publication?.identity===identity?<><h3>{publication.value.name}</h3><LengthUnitContext.Provider value={publication.value.displayUnit??'mm'}><ReviewCommentsPanel key={shareId+identity} shareId={shareId} publication={publication.value} credential={credential} credentialIdentity={identity}/></LengthUnitContext.Provider></>:<p role="status">공유 화면을 읽는 중…</p>}</dialog>;
}
