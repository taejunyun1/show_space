import {useEffect,useRef,useState} from 'react';
import {NumberField} from './Controls';
import type {SurfaceNormal} from '../domain/surfaceNormal';
import {readSurfaceNormal,type NormalConvention} from '../lib/readSurfaceNormal';

export function NormalMapEditor({label,normal,disabled,onChange}:{label:string;normal?:SurfaceNormal;disabled:boolean;onChange:(normal?:SurfaceNormal)=>void}){
 const input=useRef<HTMLInputElement>(null),alive=useRef(true),request=useRef(0),change=useRef(onChange),disabledNow=useRef(disabled);change.current=onChange;disabledNow.current=disabled;
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[convention,setConvention]=useState<NormalConvention>('opengl');
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;request.current++;};},[]);
 async function load(file:File){const id=++request.current;setBusy(true);setError('');try{const next=await readSurfaceNormal(file,convention);if(alive.current&&id===request.current&&!disabledNow.current)change.current(next);}catch(e){if(alive.current&&id===request.current)setError(e instanceof Error?e.message:'노멀 맵을 읽지 못했습니다.');}finally{if(alive.current&&id===request.current)setBusy(false);}}
 return <div className="surface-texture-editor"><h4>노멀 맵 · 표면 요철</h4>
  <label className="select-field"><span>불러올 맵 형식</span><select aria-label={label+' 노멀 맵 형식'} value={convention} disabled={disabled||busy} onChange={e=>setConvention(e.target.value as NormalConvention)}><option value="opengl">OpenGL (+Y)</option><option value="directx">DirectX (-Y) · 변환해서 저장</option></select></label>
  <input ref={input} hidden type="file" accept="image/png,image/jpeg,image/webp" aria-label={label+' 노멀 맵 파일'} onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';if(file)void load(file);}}/>
  <button className="button secondary full" aria-label={label+' 노멀 맵 불러오기'} disabled={disabled||busy} onClick={()=>input.current?.click()}>{busy?'노멀 맵 처리 중…':'노멀 맵 불러오기'}</button>
  {error&&<p className="warning" role="alert">{error}</p>}
  {normal&&<><img className="surface-texture-preview" src={normal.imageUrl} alt={label+' 노멀 맵 미리보기'}/>
   <NumberField label={label+' 노멀 강도'} value={normal.strength*100} min={0} max={500} step={5} suffix="%" disabled={disabled||busy} onChange={n=>onChange({...normal,strength:n/100})}/>
   <NumberField label={label+' 노멀 맵 폭'} value={normal.widthMm} min={1} max={1_000_000} disabled={disabled||busy} onChange={widthMm=>onChange({...normal,widthMm})}/>
   <NumberField label={label+' 노멀 맵 높이'} value={normal.heightMm} min={1} max={1_000_000} disabled={disabled||busy} onChange={heightMm=>onChange({...normal,heightMm})}/>
   <button className="button secondary full" disabled={disabled||busy} onClick={()=>onChange(undefined)}>노멀 맵 제거</button></>}
  <p className="field-hint">기존 노멀 맵을 선택하세요. 최대 1,024px의 PNG로 저장합니다. 강도 0%는 요철을 끄고 100%는 원래 강도입니다. 색상 이미지와 따로 반복하며 실제 벽·작품 크기나 실루엣은 바꾸지 않습니다.</p>
 </div>;
}
