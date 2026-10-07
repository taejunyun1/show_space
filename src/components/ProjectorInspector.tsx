import {useEffect,useRef,useState} from 'react';
import {NumberField,IconButton} from './Controls';
import {LockKeyhole,UnlockKeyhole} from 'lucide-react';
import type {ExhibitionLight} from '../domain/lighting';
import {projectionGeometry,projectorDistance,type ProjectionSettings} from '../domain/projection';
import {PROJECTION_PATTERN} from '../domain/projectionPattern';
import {readImage} from '../lib/art';
import {useEditor} from '../state/editor';
import {useLengthFormatter} from './LengthUnits';

export function ProjectorInspector({light}:{light:ExhibitionLight}){
 const p=light.projection!,g=projectionGeometry({...light,projection:p}),format=useLengthFormatter(),input=useRef<HTMLInputElement>(null),mounted=useRef(true),currentId=useRef(light.id),[busy,setBusy]=useState(false),[error,setError]=useState('');currentId.current=light.id;
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[light.id]);
 const patch=(value:Partial<ProjectionSettings>)=>useEditor.getState().patchLight(light.id,{projection:{...p,...value}});
 async function upload(file:File){
  const project=useEditor.getState().project;setBusy(true);setError('');
  try{const imageUrl=await readImage(file),current=useEditor.getState();if(!mounted.current||currentId.current!==light.id)return;if(current.project!==project||current.project.lights?.find(l=>l.id===light.id)!==light)throw new Error('편집 중인 프로젝트가 변경됐습니다. 이미지를 다시 선택해주세요.');patch({imageUrl});}
  catch(cause){if(mounted.current)setError(cause instanceof Error?cause.message:'투사 이미지를 읽지 못했습니다.');}
  finally{if(mounted.current)setBusy(false);}
 }
 return <section className="inspector-section" aria-label="프로젝터 설정"><h3>프로젝터 <IconButton label={light.locked?'조명 잠금 해제':'조명 잠금'} active={light.locked} onClick={()=>useEditor.getState().patchLight(light.id,{locked:!light.locked})}>{light.locked?<LockKeyhole size={16}/>:<UnlockKeyhole size={16}/>}</IconButton></h3>
  <img src={p.imageUrl} alt="투사 이미지" style={{width:'100%',maxHeight:160,objectFit:'contain',background:'#171717'}}/>
  <input hidden ref={input} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void upload(file);}}/>
  <button className="button secondary full" disabled={light.locked||busy} onClick={()=>input.current?.click()}>{busy?'이미지 준비 중…':'투사 이미지 불러오기'}</button>
  <button className="text-button" disabled={light.locked||busy} onClick={()=>patch({imageUrl:PROJECTION_PATTERN})}>테스트 패턴으로</button>
  {error&&<p role="alert" className="field-hint">{error}</p>}
  <NumberField label="렌즈 투사비" suffix="" step={.01} precision={4} min={.3} max={10} value={p.throwRatio} disabled={light.locked} onChange={throwRatio=>patch({throwRatio})}/>
  <NumberField label="투사 거리" min={100} max={100000} value={g.distanceMm} disabled={light.locked} onChange={distance=>useEditor.getState().patchLight(light.id,{position:projectorDistance(light,distance)})}/>
  <label className="select-field"><span>화면 비율</span><select aria-label="프로젝터 화면 비율" disabled={light.locked} value={[16/9,4/3,1].includes(p.aspectRatio)?String(p.aspectRatio):'custom'} onChange={e=>{if(e.target.value!=='custom')patch({aspectRatio:Number(e.target.value)});}}><option value={16/9}>16:9</option><option value={4/3}>4:3</option><option value={1}>1:1</option><option value="custom">사용자 비율</option></select></label>
  <NumberField label="가로·세로 비율" suffix="" step={.01} precision={4} min={.5} max={3} value={p.aspectRatio} disabled={light.locked} onChange={aspectRatio=>patch({aspectRatio})}/>
  <label className="select-field"><span>이미지 채우기</span><select aria-label="프로젝터 이미지 채우기" value={p.fit} disabled={light.locked} onChange={e=>patch({fit:e.target.value as ProjectionSettings['fit']})}><option value="contain">전체 이미지 · 여백 유지</option><option value="cover">투사면 채우기 · 가장자리 잘림</option></select></label>
  <NumberField label="프로젝터 밝기" suffix="lm" step={100} min={0} max={50000} value={p.brightnessLumens} disabled={light.locked} onChange={brightnessLumens=>patch({brightnessLumens})}/>
  <p className="field-hint" role="status">조준점에서 투사 크기 {format(g.widthMm)} × {format(g.heightMm)}</p>
  <p className="field-hint">투사 폭 = 거리 ÷ 렌즈 투사비. 크기는 광축에 수직인 면 기준입니다. 비스듬한 벽·바닥에서는 실제 표면에 따라 모양이 달라집니다. 이미지 비율을 유지하며 여백을 넣거나 가장자리를 자릅니다.</p>
  <p className="field-hint">정지 이미지 투사 · 최대 2대. 물체에 가려지는 빛을 표시합니다. 밝기는 배치안 비교용이며 실제 장비의 밝기·색·키스톤 보정을 보증하지 않습니다.</p>
 </section>;
}
