import {useEffect,useRef,useState} from 'react';
import type {PlanPage} from '../lib/planImport';
import {cropRect,transformPlan} from '../lib/planTransform';
import type {CropRect,PixelPoint} from '../lib/planTransform';
export function PlanRegionEditor({page,onChange,onBusy}:{page:PlanPage;onChange:(page:PlanPage)=>void;onBusy:(busy:boolean)=>void}){
 const [crop,setCrop]=useState<CropRect|null>(null),[start,setStart]=useState<PixelPoint|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const image=useRef<HTMLImageElement>(null),revision=useRef(0),active=useRef<number|null>(null),alive=useRef(false),input=useRef(page),reportBusy=useRef(onBusy);input.current=page;reportBusy.current=onBusy;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;revision.current++;active.current=null;reportBusy.current(false);};},[]);
 useEffect(()=>{revision.current++;active.current=null;setBusy(false);setCrop(null);setStart(null);setError('');reportBusy.current(false);},[page.imageUrl,page.widthPx,page.heightPx]);
 function point(e:React.PointerEvent){const r=image.current!.getBoundingClientRect();return{x:(e.clientX-r.left)*page.widthPx/r.width,y:(e.clientY-r.top)*page.heightPx/r.height};}
 async function apply(rotation:number,region?:CropRect){
  if(!alive.current||active.current!==null)return;
  const job=++revision.current;active.current=job;
  const current=()=>alive.current&&job===revision.current&&active.current===job&&input.current.imageUrl===page.imageUrl&&input.current.widthPx===page.widthPx&&input.current.heightPx===page.heightPx;
  setBusy(true);reportBusy.current(true);setError('');
  try{const result=await transformPlan(page,rotation,region);if(current()){onChange(result);setCrop(null);}}
  catch(e){if(current())setError(e instanceof Error?e.message:'도면을 변환하지 못했습니다.');}
  finally{if(current()){active.current=null;setBusy(false);reportBusy.current(false);}}
 }
 return <section className="region-editor" aria-label="도면 회전과 영역 선택"><div className="region-actions"><button className="button secondary" disabled={busy} onClick={()=>void apply(270)}>왼쪽 90°</button><button className="button secondary" disabled={busy} onClick={()=>void apply(90)}>오른쪽 90°</button><button className="button primary" disabled={busy||!crop} onClick={()=>crop&&void apply(0,crop)}>선택 영역 자르기</button><button className="button secondary" disabled={busy||!crop} onClick={()=>setCrop(null)}>선택 해제</button></div><p>사용할 평면만 드래그하세요. 회전·자르기는 배치 전 도면에 적용됩니다.</p><div className="region-image" onPointerDown={e=>{if(busy)return;e.currentTarget.setPointerCapture(e.pointerId);setStart(point(e));setCrop(null);}} onPointerMove={e=>{if(!start)return;try{setCrop(cropRect(start,point(e),page.widthPx,page.heightPx));}catch{setCrop(null);}}} onPointerUp={e=>{if(!start)return;try{setCrop(cropRect(start,point(e),page.widthPx,page.heightPx));}catch(e){setError((e as Error).message);}setStart(null);}} onPointerCancel={()=>{setStart(null);setCrop(null);}}><img ref={image} src={page.imageUrl} draggable={false} alt="영역을 선택할 도면"/>{crop&&<div className="crop-outline" style={{left:`${crop.x/page.widthPx*100}%`,top:`${crop.y/page.heightPx*100}%`,width:`${crop.width/page.widthPx*100}%`,height:`${crop.height/page.heightPx*100}%`}}/>}</div><div className="region-numbers">{(['x','y','width','height'] as const).map((key,i)=><label key={key}>{['왼쪽','위','너비','높이'][i]}<input aria-label={`영역 ${key}`} type="number" disabled={busy} min={key==='width'||key==='height'?10:0} value={crop?.[key]??(key==='width'?page.widthPx:key==='height'?page.heightPx:0)} onChange={e=>{const base=crop??{x:0,y:0,width:page.widthPx,height:page.heightPx};setCrop({...base,[key]:Number(e.target.value)});}}/></label>)}</div>{busy&&<p role="status">도면 변환 중…</p>}{error&&<p role="alert">{error}</p>}</section>;
}
