import {TextureEditor} from './TextureEditor';
import {materialPreset,materialPresets,type MaterialPresetId,type SurfaceMaterial} from '../domain/materials';
import {NumberField} from './Controls';
export function MaterialEditor({label,material,color,disabled=false,image=false,legacyRoughness=image?.9:.92,onChange}:{label:string;material?:SurfaceMaterial;color:string;disabled?:boolean;image?:boolean;legacyRoughness?:number;onChange:(material:SurfaceMaterial|undefined,color:string)=>void}){
 const current=material??{...materialPreset(image?'matte-photo-paper':'white-paint').material,roughness:legacyRoughness};
 function change(patch:Partial<SurfaceMaterial>){const next={...current,...patch};if(patch.transmission!==undefined&&patch.transmission>0)next.opacity=1;if(patch.opacity!==undefined&&patch.opacity<1)next.transmission=0;onChange(next,color);}
 return <section className="inspector-section material-editor"><h3>{label}</h3><label className="select-field"><span>프리셋</span><select aria-label={label+' 프리셋'} value={material?.preset??'legacy'} disabled={disabled} onChange={e=>{if(e.target.value==='legacy'){onChange(undefined,color);return;}const next=materialPreset(e.target.value as MaterialPresetId);onChange({...next.material,...(material?.texture?{texture:material.texture}:{})},image?color:next.color);}}><option value="legacy">기존 기본 표현</option>{materialPresets.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
 {!image&&<label className="color-field"><input type="color" aria-label={label+' 색상'} value={color} disabled={disabled} onChange={e=>onChange(material,e.target.value)}/><span>{color.toUpperCase()}</span></label>}
 <NumberField label={label+' 거칠기'} value={current.roughness*100} min={0} max={100} step={1} suffix="%" disabled={disabled} onChange={n=>change({roughness:n/100})}/>
 <NumberField label={label+' 금속성'} value={current.metalness*100} min={0} max={100} step={1} suffix="%" disabled={disabled} onChange={n=>change({metalness:n/100})}/>
 <NumberField label={label+' 불투명도'} value={current.opacity*100} min={0} max={100} step={1} suffix="%" disabled={disabled} onChange={n=>change({opacity:n/100})}/>
 <NumberField label={label+' 투과율'} value={current.transmission*100} min={0} max={100} step={1} suffix="%" disabled={disabled} onChange={n=>change({transmission:n/100})}/>
 <NumberField label={label+' 두께'} value={current.thicknessMm} min={0} max={2000} step={1} disabled={disabled} onChange={n=>change({thicknessMm:n})}/>
 <NumberField label={label+' 굴절률'} value={current.ior} min={1} max={2.333} step={.01} suffix="" disabled={disabled} onChange={n=>change({ior:n})}/>
 {!image&&<TextureEditor key={label} label={label} texture={material?.texture} disabled={disabled} onChange={texture=>onChange({...current,texture},color)}/>}
 <p className="field-hint">기본 프리셋은 색·반사값입니다. 목재 결·천 무늬 등은 직접 선택한 텍스처로 표현합니다.</p>
 <p className="field-hint">{image?'작품 이미지를 유지하며 표면 반사를 조절합니다. ':''}재질 두께는 빛의 투과에 쓰이며 실제 벽·작품 크기를 바꾸지 않습니다. 투과율을 높이면 불투명도는 100%로 유지합니다.</p>
 {material?.preset==='mirror'&&<p className="field-hint">거울은 환경 반사로 근사합니다. 정확한 거울 상·시공 재료 판정은 지원하지 않습니다.</p>}
 </section>;
}
