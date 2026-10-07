import {parseSurfaceTexture,type SurfaceTexture} from './surfaceTexture';
import {parseSurfaceNormal,type SurfaceNormal} from './surfaceNormal';
export const materialPresetIds=['white-paint','matte-paint','concrete','wood','metal','stainless-steel','glass','acrylic','mirror','fabric','matte-photo-paper','glossy-photo-paper','baryta','canvas','epoxy-floor'] as const;
export type MaterialPresetId=typeof materialPresetIds[number];
export interface SurfaceMaterial {texture?:SurfaceTexture;normal?:SurfaceNormal;preset:MaterialPresetId;roughness:number;metalness:number;opacity:number;transmission:number;thicknessMm:number;ior:number;clearcoat:number;sheen:number}
const base={metalness:0,opacity:1,transmission:0,thicknessMm:0,ior:1.5,clearcoat:0,sheen:0};
const preset=(id:MaterialPresetId,label:string,color:string,roughness:number,patch:Partial<SurfaceMaterial>={})=>({id,label,color,material:{...base,preset:id,roughness,...patch} as SurfaceMaterial});
export const materialPresets=[
 preset('white-paint','화이트 페인트','#ffffff',.82),
 preset('matte-paint','무광 페인트','#e7e5df',.96),preset('concrete','콘크리트','#b8b9b5',.94),preset('wood','목재','#b59a76',.65),
 preset('metal','금속','#a4a8ae',.35,{metalness:1}),preset('stainless-steel','스테인리스','#c5cbd1',.18,{metalness:1}),
 preset('glass','유리','#ffffff',.06,{transmission:1,thicknessMm:10}),preset('acrylic','아크릴','#ffffff',.12,{transmission:.92,thicknessMm:5,ior:1.49}),
 preset('mirror','거울 · 환경 반사 근사','#ffffff',.01,{metalness:1}),preset('fabric','천','#ded9cf',.96,{sheen:1}),
 preset('matte-photo-paper','무광 사진용지','#ffffff',.92),preset('glossy-photo-paper','유광 사진용지','#ffffff',.18,{clearcoat:.5}),
 preset('baryta','바리타지','#ffffff',.28,{clearcoat:.3}),preset('canvas','캔버스','#f4f0e7',.9),preset('epoxy-floor','에폭시 바닥','#bfc3c5',.12,{clearcoat:1}),
];
export function materialPreset(id:MaterialPresetId){const found=materialPresets.find(p=>p.id===id);if(!found)throw new Error('지원하지 않는 재질 프리셋입니다.');return {color:found.color,material:{...found.material}};}
export function parseSurfaceMaterial(input:unknown):SurfaceMaterial{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('재질 속성이 올바르지 않습니다.');
 const m=input as SurfaceMaterial;
 if(!materialPresetIds.includes(m.preset))throw new Error('지원하지 않는 재질 프리셋입니다.');
 const unit=(key:keyof SurfaceMaterial)=>{const n=m[key];if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>1)throw new Error('재질 속성은 0~1 사이의 유한한 숫자여야 합니다.');return n;};
 const roughness=unit('roughness'),metalness=unit('metalness'),opacity=unit('opacity'),transmission=unit('transmission'),clearcoat=unit('clearcoat'),sheen=unit('sheen');
 if(!Number.isFinite(m.thicknessMm)||m.thicknessMm<0||m.thicknessMm>2000||!Number.isFinite(m.ior)||m.ior<1||m.ior>2.333)throw new Error('재질 두께/굴절률이 올바르지 않습니다.');
 if(transmission>0&&opacity!==1)throw new Error('빛을 투과하는 재질은 불투명도 100%를 유지해야 합니다.');
 return {preset:m.preset,roughness,metalness,opacity,transmission,thicknessMm:m.thicknessMm,ior:m.ior,clearcoat,sheen,...(m.texture===undefined?{}:{texture:parseSurfaceTexture(m.texture)}),...(m.normal===undefined?{}:{normal:parseSurfaceNormal(m.normal)})};
}
