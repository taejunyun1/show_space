import {useEffect,useRef,useState} from 'react';
import {Camera,X} from 'lucide-react';
import type {CaptureOptions} from '../lib/captureSvg';
import type {View} from '../state/editor';

export function CaptureDialog({view,hasPlan,onClose,onCapture}:{view:View;hasPlan:boolean;onClose:()=>void;onCapture:(options:CaptureOptions)=>Promise<void>}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [longEdge,setLongEdge]=useState<1920|3840>(1920);
 const [includeDimensions,setIncludeDimensions]=useState(true);
 const [includeGrid,setIncludeGrid]=useState(view!=='elevation');
 const [includePlan,setIncludePlan]=useState(true);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{dialog.current?.showModal();},[]);
 async function save(){
  setBusy(true);setError('');
  try{await onCapture({longEdge,includeDimensions,includeGrid,includePlan});onClose();}
  catch(cause){setError(cause instanceof Error?cause.message:'PNG 저장에 실패했습니다.');}
  finally{setBusy(false);}
 }
 return <dialog className="export-dialog capture-dialog" ref={dialog} onCancel={event=>{if(busy)event.preventDefault();else onClose();}} onClick={event=>{if(event.target===event.currentTarget&&!busy)onClose();}}>
  <div className="dialog-header"><div><h2>{view==='plan'?'평면도':view==='elevation'?'벽면도':'3D 공간'} 캡처</h2><p>현재 시점을 PNG로 저장합니다. 선택 표시와 편집 핸들은 제외됩니다.</p></div><button className="icon-button" aria-label="닫기" disabled={busy} onClick={onClose}><X size={18}/></button></div>
  <div className="capture-options"><label>긴 변 해상도<select value={longEdge} onChange={event=>setLongEdge(Number(event.target.value) as 1920|3840)}><option value={1920}>1920 px</option><option value={3840}>3840 px</option></select></label>
   <label><input type="checkbox" checked={includeDimensions} onChange={event=>setIncludeDimensions(event.target.checked)}/> 치수와 주석 표시</label>
   {view!=='elevation'&&<label><input type="checkbox" checked={includeGrid} onChange={event=>setIncludeGrid(event.target.checked)}/> 격자 표시</label>}
   {view==='plan'&&hasPlan&&<label><input type="checkbox" checked={includePlan} onChange={event=>setIncludePlan(event.target.checked)}/> 원본 도면 표시</label>}
  </div>
  {error&&<p className="capture-error" role="alert">{error}</p>}
  <button className="button primary full" disabled={busy} onClick={save}><Camera size={16}/>{busy?'PNG 만드는 중…':'PNG 저장'}</button>
 </dialog>;
}
