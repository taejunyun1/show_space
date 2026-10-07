import {TextureEditor} from './TextureEditor';
import {materialPreset,materialPresets,type MaterialPresetId,type SurfaceMaterial} from '../domain/materials';
import {NumberField} from './Controls';
import {lazy,Suspense,useState} from 'react';
import type {MaterialTarget} from '../domain/materialLibrary';
import {materialFinish,materialFinishes,setMaterialFinish,materialTransparency,transparencyMode,setTransparencyMode,setMaterialTransparency,patchSurfaceMaterial,type MaterialFinishId,type TransparencyMode} from '../domain/materialEditing';
const MaterialLibraryDialog=lazy(()=>import('./MaterialLibraryDialog'));
export function MaterialEditor({label,material,color,disabled=false,image=false,legacyRoughness=image?.9:.92,libraryTarget,onChange}:{label:string;material?:SurfaceMaterial;color:string;disabled?:boolean;image?:boolean;legacyRoughness?:number;libraryTarget?:MaterialTarget;onChange:(material:SurfaceMaterial|undefined,color:string)=>void}){
 const [libraryOpen,setLibraryOpen]=useState(false);
 const current=material??{...materialPreset(image?'matte-photo-paper':'white-paint').material,roughness:legacyRoughness};
 function change(patch:Partial<SurfaceMaterial>){onChange(patchSurfaceMaterial(current,patch),color);}
 return <section className="inspector-section material-editor"><h3>{label}</h3>{libraryTarget&&<button className="button secondary full" aria-label={label+' 라이브러리'} disabled={disabled} onClick={()=>setLibraryOpen(true)}>재질 라이브러리 · 저장·적용</button>}<label className="select-field"><span>프리셋</span><select aria-label={label+' 프리셋'} value={material?.preset??'legacy'} disabled={disabled} onChange={e=>{if(e.target.value==='legacy'){onChange(undefined,color);return;}const next=materialPreset(e.target.value as MaterialPresetId);onChange({...next.material,...(material?.texture?{texture:material.texture}:{})},image?color:next.color);}}><option value="legacy">기존 기본 표현</option>{materialPresets.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
 {!image&&<label className="color-field"><input type="color" aria-label={label+' 색상'} value={color} disabled={disabled} onChange={e=>onChange(material,e.target.value)}/><span>{color.toUpperCase()}</span></label>}
 <label className="select-field"><span>표면 마감</span><select aria-label={label+' 표면 마감'} value={materialFinish(current)} disabled={disabled} onChange={e=>{if(e.target.value!=='custom')onChange(setMaterialFinish(current,e.target.value as MaterialFinishId),color);}}><option value="custom" disabled>프리셋 / 직접 설정</option>{materialFinishes.map(f=><option key={f.id} value={f.id}>{f.label}</option>)}</select></label>
 <label className="select-field"><span>투명 표현</span><select aria-label={label+' 투명 표현'} value={transparencyMode(current)} disabled={disabled} onChange={e=>onChange(setTransparencyMode(current,e.target.value as TransparencyMode),color)}><option value="opaque">불투명</option><option value="opacity">반투명</option><option value="transmission">유리 · 빛 투과</option></select></label>
 <NumberField label={label+' 투명도'} value={materialTransparency(current)*100} min={0} max={100} step={1} suffix="%" disabled={disabled} onChange={n=>onChange(setMaterialTransparency(current,n/100),color)}/>
 <p className="field-hint">0%는 불투명이며 값이 높을수록 더 투명하게 표현합니다. 유리는 반사·색·두께에 따라 모습이 달라집니다.</p>
 {!image&&<TextureEditor key={label} label={label} texture={material?.texture} disabled={disabled} onChange={texture=>onChange({...current,texture},color)}/>}
 <p className="field-hint">기본 프리셋은 색·반사값입니다. 목재 결·천 무늬 등은 직접 선택한 텍스처로 표현합니다.</p>
 {image&&<p className="field-hint">작품 이미지를 유지하며 표면 반사를 조절합니다.</p>}
 <details className="material-advanced"><summary aria-label={label+' 고급 설정'}>고급 설정 · 세부 물성</summary>
 <NumberField label={label+' 거칠기'} value={current.roughness*100} min={0} max={100} step={1} suffix="%" disabled={disabled} onChange={n=>change({roughness:n/100})}/>
 <NumberField label={label+' 금속성'} value={current.metalness*100} min={0} max={100} step={1} suffix="%" disabled={disabled} onChange={n=>change({metalness:n/100})}/>
 <NumberField label={label+' 불투명도'} value={current.opacity*100} min={0} max={100} step={1} suffix="%" disabled={disabled} onChange={n=>change({opacity:n/100})}/>
 <NumberField label={label+' 투과율'} value={current.transmission*100} min={0} max={100} step={1} suffix="%" disabled={disabled} onChange={n=>change({transmission:n/100})}/>
 <NumberField label={label+' 두께'} value={current.thicknessMm} min={0} max={2000} step={1} disabled={disabled} onChange={n=>change({thicknessMm:n})}/>
 <NumberField label={label+' 굴절률'} value={current.ior} min={1} max={2.333} step={.01} suffix="" disabled={disabled} onChange={n=>change({ior:n})}/>
 <NumberField label={label+' 코팅 광택'} value={current.clearcoat*100} min={0} max={100} step={1} suffix="%" disabled={disabled} onChange={n=>change({clearcoat:n/100})}/>
 <NumberField label={label+' 섬유 광택'} value={current.sheen*100} min={0} max={100} step={1} suffix="%" disabled={disabled} onChange={n=>change({sheen:n/100})}/>
 <p className="field-hint">재질 두께는 빛의 투과에 쓰이며 실제 벽·작품 크기를 바꾸지 않습니다. 투과율을 높이면 불투명도는 100%로 유지하고, 불투명도를 낮추면 투과율은 0%로 바뀝니다.</p>
 </details>
 {material?.preset==='mirror'&&<p className="field-hint">거울은 환경 반사로 근사합니다. 정확한 거울 상·시공 재료 판정은 지원하지 않습니다.</p>}
 {libraryOpen&&libraryTarget&&<Suspense fallback={<p role="status">재질 라이브러리 여는 중…</p>}><MaterialLibraryDialog target={libraryTarget} source={{name:label,category:libraryTarget.type==='floor'?'floor':image?'artwork':'architecture',color,material:current}} onClose={()=>setLibraryOpen(false)}/></Suspense>}
 </section>;
}
