import {useEffect,useRef,useState} from 'react';
import type {SurfaceTexture} from '../domain/surfaceTexture';
import {NumberField} from './Controls';
import {readSurfaceTexture,checkerSurfaceTexture} from '../lib/readSurfaceTexture';
export function TextureEditor({label,texture,disabled,onChange}:{label:string;texture?:SurfaceTexture;disabled:boolean;onChange:(texture?:SurfaceTexture)=>void}){
 const change=useRef(onChange);change.current=onChange;
 const input=useRef<HTMLInputElement>(null),alive=useRef(true),request=useRef(0),disabledNow=useRef(disabled);disabledNow.current=disabled;
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;request.current++;};},[]);
 async function load(file?:File){const id=++request.current;setBusy(true);setError('');try{const next=await(file?readSurfaceTexture(file):checkerSurfaceTexture());if(alive.current&&id===request.current&&!disabledNow.current)change.current(next);}catch(e){if(alive.current&&id===request.current)setError((e as Error).message);}finally{if(alive.current&&id===request.current)setBusy(false);}}
 return <div className="surface-texture-editor"><h4>표면 텍스처</h4><input ref={input} hidden type="file" accept="image/png,image/jpeg,image/webp" aria-label={label+' 텍스처 파일'} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void load(file);}}/>
 <div className="rotation-buttons"><button className="button secondary" disabled={disabled||busy} onClick={()=>input.current?.click()}>{busy?'이미지 처리 중':'텍스처 불러오기'}</button><button className="button secondary" disabled={disabled||busy} onClick={()=>void load()}>격자 예제</button></div>
 {error&&<p className="warning" role="alert">{error}</p>}
 {texture&&<><img className="surface-texture-preview" src={texture.imageUrl} alt={label+' 텍스처 미리보기'}/><NumberField label={label+' 텍스처 폭'} value={texture.widthMm} min={1} max={1_000_000} disabled={disabled||busy} onChange={widthMm=>onChange({...texture,widthMm})}/><NumberField label={label+' 텍스처 높이'} value={texture.heightMm} min={1} max={1_000_000} disabled={disabled||busy} onChange={heightMm=>onChange({...texture,heightMm})}/><button className="button secondary full" disabled={disabled||busy} onClick={()=>onChange(undefined)}>텍스처 제거</button></>}
 <p className="field-hint">이미지 한 장이 차지하는 실제 폭·높이입니다. JPG·PNG·WebP를 그대로 반복하며 사진에서 재질을 생성하지 않습니다. 표면 색을 흰색으로 하면 이미지 본래 색을 유지합니다.</p></div>;
}
