import {parseNoteDetails,type NoteDetails} from './notes';
import type {Project,WorldPoint} from './types';
export interface ExhibitionLight {
 noteDetails?:NoteDetails
 id:string;name:string;kind:'spot'|'area';position:WorldPoint;target:WorldPoint;
 intensity:number;kelvin:number;beamDeg:number;penumbra:number;distanceMm:number;
 widthMm:number;heightMm:number;shadow:boolean;visible:boolean;locked:boolean;note:string;
}
export interface LightingSettings {ambient:number;hemisphere:number;fill:number;environment:number}
export const DEFAULT_LIGHTING:LightingSettings={ambient:.65,hemisphere:.7,fill:2.3,environment:.35};
export const CUSTOM_LIGHTING:LightingSettings={ambient:.12,hemisphere:.15,fill:0,environment:.08};
export const MAX_LIGHTS=20,MAX_SPOT_SHADOWS=4;
const record=(v:unknown)=>{if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('조명 형식이 올바르지 않습니다.');return v as Record<string,unknown>;};
const number=(v:unknown,min:number,max:number)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new Error('조명 값이 허용 범위를 벗어났습니다.');return v;};
const text=(v:unknown,max:number)=>{if(typeof v!=='string'||v.length>max)throw new Error('조명 텍스트가 올바르지 않습니다.');return v;};
const bool=(v:unknown)=>{if(typeof v!=='boolean')throw new Error('조명 표시/잠금 값이 올바르지 않습니다.');return v;};
function point(v:unknown):WorldPoint{const p=record(v);return {x:number(p.x,-1e6,1e6),y:number(p.y,-1e6,1e6),z:number(p.z,-1e6,1e6)};}
export function parseLight(v:unknown):ExhibitionLight{
 const p=record(v),id=text(p.id,100);if(!/^[a-zA-Z0-9_.:-]+$/.test(id)||!['spot','area'].includes(String(p.kind)))throw new Error('조명 ID/종류가 올바르지 않습니다.');
 const position=point(p.position),target=point(p.target);if(Math.hypot(position.x-target.x,position.y-target.y,position.z-target.z)<1)throw new Error('조명과 조준점을 서로 다르게 지정해주세요.');
 return {id,name:text(p.name,200),kind:p.kind as 'spot'|'area',position,target,intensity:number(p.intensity,0,100000),kelvin:number(p.kelvin,2700,6500),beamDeg:number(p.beamDeg,1,150),penumbra:number(p.penumbra,0,1),distanceMm:number(p.distanceMm,0,100000),widthMm:number(p.widthMm,1,20000),heightMm:number(p.heightMm,1,20000),shadow:bool(p.shadow),visible:bool(p.visible),locked:bool(p.locked),note:text(p.note,20000),...(p.noteDetails!==undefined?{noteDetails:parseNoteDetails(p.noteDetails)}:{})};
}
export function parseLights(v:unknown,otherIds:Iterable<string>=[]){
 if(!Array.isArray(v)||v.length>MAX_LIGHTS)throw new Error(`조명은 최대 ${MAX_LIGHTS}개까지 만들 수 있습니다.`);
 const used=new Set(otherIds);return v.map(item=>{const l=parseLight(item);if(used.has(l.id))throw new Error('중복된 조명 ID가 있습니다.');used.add(l.id);return l;});
}
export function parseLighting(v:unknown):LightingSettings{const p=record(v);return {ambient:number(p.ambient,0,5),hemisphere:number(p.hemisphere,0,5),fill:number(p.fill,0,5),environment:number(p.environment??.35,0,2)};}
export function patchLight(project:Project,id:string,patch:Partial<ExhibitionLight>):Project{
 const source=project.lights?.find(l=>l.id===id);if(!source)throw new Error('조명을 찾을 수 없습니다.');
 if(source.locked&&Object.keys(patch).some(k=>!['locked','visible'].includes(k)))throw new Error('잠긴 조명은 수정할 수 없습니다.');
 if(patch.id!==undefined&&patch.id!==id)throw new Error('조명 ID를 변경할 수 없습니다.');
 const next=parseLight({...source,...patch});return {...project,lights:project.lights!.map(l=>l.id===id?next:l)};
}
export function translatedLight(light:ExhibitionLight,position:WorldPoint){const delta={x:position.x-light.position.x,y:position.y-light.position.y,z:position.z-light.position.z};return {position,target:{x:light.target.x+delta.x,y:light.target.y+delta.y,z:light.target.z+delta.z}};}
export function newLight(project:Project,kind:'spot'|'area'):ExhibitionLight{
 if((project.lights?.length??0)>=MAX_LIGHTS)throw new Error(`조명은 최대 ${MAX_LIGHTS}개까지 만들 수 있습니다.`);
 const used=new Set([...project.walls,...project.artworks,...(project.unplacedArtworks??[]),...(project.lights??[]),...(project.modelArtworks??[])].map(o=>o.id));let index=1;while(used.has(`light-${index}`))index++;
 const art=project.artworks.find(a=>a.visible),wall=project.walls.find(w=>w.id===art?.wallId)??project.walls[0];
 const dx=wall.end.x-wall.start.x,dz=wall.end.z-wall.start.z,length=Math.hypot(dx,dz),side=art?.wallSide==='back'?-1:1;
 const nx=-dz/length*side,nz=dx/length*side,along=art?.alongMm??length/2;
 const target={x:wall.start.x+dx/length*along+nx*(wall.thicknessMm/2+20),y:art?.centerHeightMm??1500,z:wall.start.z+dz/length*along+nz*(wall.thicknessMm/2+20)};
 return parseLight({id:`light-${index}`,name:`${kind==='spot'?'스팟':'면'} 조명 ${index}`,kind,position:{x:target.x+nx*1200,y:Math.max(wall.heightMm-200,target.y+1000),z:target.z+nz*1200},target,intensity:kind==='spot'?60:15,kelvin:4000,beamDeg:40,penumbra:.3,distanceMm:0,widthMm:1000,heightMm:500,shadow:kind==='spot',visible:true,locked:false,note:''});
}
/** Tanner Helland's sRGB approximation, limited to the supported 2700–6500 K range. */
export function kelvinRgb(kelvin:number):[number,number,number]{const t=number(kelvin,2700,6500)/100,clamp=(v:number)=>Math.min(1,Math.max(0,v/255));return [1,clamp(99.4708025861*Math.log(t)-161.1195681661),clamp(138.5177312231*Math.log(t-10)-305.0447927307)];}
export function spotShadowIds(lights:readonly Pick<ExhibitionLight,'id'|'kind'|'shadow'|'visible'|'intensity'>[]){return lights.filter(l=>l.visible&&l.kind==='spot'&&l.shadow&&l.intensity>0).slice(0,MAX_SPOT_SHADOWS).map(l=>l.id);}
