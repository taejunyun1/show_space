import {useEffect,useRef,useState} from 'react';
import {Camera,X} from 'lucide-react';
import {capturePixelSize,type CaptureOptions,type CaptureRatio} from '../lib/captureSvg';
import type {View} from '../state/editor';

export function CaptureDialog({view,hasPlan,sourceSize,onClose,onCapture}:{view:View;hasPlan:boolean;sourceSize:()=>CaptureRatio;onClose:()=>void;onCapture:(options:CaptureOptions)=>Promise<void>}){
 const dialog=useRef<HTMLDialogElement>(null);
 const running=useRef(false);
 const [source,setSource]=useState(sourceSize);
 const [longEdge,setLongEdge]=useState<CaptureOptions['longEdge']>(1920);
 const [ratio,setRatio]=useState('current');
 const [customWidth,setCustomWidth]=useState('16'),[customHeight,setCustomHeight]=useState('9');
 const [includeDimensions,setIncludeDimensions]=useState(true);
 const [includeGrid,setIncludeGrid]=useState(view!=='elevation');
 const [includePlan,setIncludePlan]=useState(true);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const aspectRatio=ratio==='current'?undefined:ratio==='custom'?{width:Number(customWidth),height:Number(customHeight)}:{width:Number(ratio.split(':')[0]),height:Number(ratio.split(':')[1])};
 let output:CaptureRatio|undefined,ratioError='';
 try{output=capturePixelSize(source.width,source.height,longEdge,aspectRatio);}
 catch(cause){ratioError=cause instanceof Error?cause.message:'캡처 비율을 확인해 주세요.';}
 useEffect(()=>{dialog.current?.showModal();},[]);
 useEffect(()=>{
  const workspace=dialog.current?.parentElement;if(!workspace)return;
  const observer=new ResizeObserver(()=>{
   const next=sourceSize();
   setSource(current=>current.width===next.width&&current.height===next.height?current:next);
  });
  observer.observe(workspace);
  const sourceElement=workspace.querySelector('.viewport-stage canvas, .viewport-stage .drawing-view>svg');
  if(sourceElement)observer.observe(sourceElement);
  return ()=>observer.disconnect();
 },[sourceSize]);
 async function save(){
  if(running.current||ratioError)return;
  running.current=true;
  setBusy(true);setError('');
  try{await onCapture({longEdge,aspectRatio,includeDimensions,includeGrid,includePlan});onClose();}
  catch(cause){setError(cause instanceof Error?cause.message:'PNG 저장에 실패했습니다.');}
  finally{running.current=false;setBusy(false);}
 }
 return <dialog className="export-dialog capture-dialog" ref={dialog} onCancel={event=>{if(busy)event.preventDefault();else onClose();}} onClick={event=>{if(event.target===event.currentTarget&&!busy)onClose();}}>
  <div className="dialog-header"><div><h2>{view==='plan'?'평면도':view==='elevation'?'벽면도':'3D 공간'} 캡처</h2><p>현재 시점을 PNG로 저장합니다. 선택 표시와 편집 핸들은 제외됩니다.</p></div><button className="icon-button" aria-label="닫기" disabled={busy} onClick={onClose}><X size={18}/></button></div>
  <div className="capture-options"><label>출력 비율<select disabled={busy} value={ratio} onChange={event=>setRatio(event.target.value)}><option value="current">현재 비율</option><option value="16:9">16:9 · 가로</option><option value="4:3">4:3 · 가로</option><option value="1:1">1:1 · 정사각</option><option value="3:4">3:4 · 세로</option><option value="9:16">9:16 · 세로</option><option value="custom">사용자 지정</option></select></label>
   {ratio==='custom'&&<div className="capture-custom-ratio"><label>비율 가로<input type="number" min={1} max={10000} step="any" disabled={busy} value={customWidth} onChange={event=>setCustomWidth(event.target.value)}/></label><span>:</span><label>비율 세로<input type="number" min={1} max={10000} step="any" disabled={busy} value={customHeight} onChange={event=>setCustomHeight(event.target.value)}/></label></div>}
   <label>긴 변 해상도<select disabled={busy} value={longEdge} onChange={event=>setLongEdge(Number(event.target.value) as CaptureOptions['longEdge'])}><option value={1920}>1920 px · 1080p (16:9)</option><option value={2560}>2560 px · 1440p (16:9)</option><option value={3840}>3840 px · 4K (16:9)</option></select></label>
   <p className="capture-size" role="status">{output?`저장 크기 ${output.width.toLocaleString()} × ${output.height.toLocaleString()} px`:ratioError}</p>
   <p className="field-hint">출력 비율이 다르면 배경 여백을 추가합니다. 현재 화면의 비율과 배치는 유지됩니다.</p>
   <label><input type="checkbox" disabled={busy} checked={includeDimensions} onChange={event=>setIncludeDimensions(event.target.checked)}/> 치수와 주석 표시</label>
   {view!=='elevation'&&<label><input type="checkbox" disabled={busy} checked={includeGrid} onChange={event=>setIncludeGrid(event.target.checked)}/> 격자 표시</label>}
   {view==='plan'&&hasPlan&&<label><input type="checkbox" disabled={busy} checked={includePlan} onChange={event=>setIncludePlan(event.target.checked)}/> 원본 도면 표시</label>}
  </div>
  {error&&<p className="capture-error" role="alert">{error}</p>}
  <button className="button primary full" disabled={busy||!!ratioError} onClick={save}><Camera size={16}/>{busy?'PNG 만드는 중…':'PNG 저장'}</button>
 </dialog>;
}
