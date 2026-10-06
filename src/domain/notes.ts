import {textureHeaderSize} from '../lib/artworkModelPayload';
import type {EntitySelection,Project} from './types';
export const INSTALLATION_STAGES=[['printed','출력 완료'],['framed','액자·마감 완료'],['delivered','운송 완료'],['installed','설치 완료'],['lightingChecked','조명 확인']] as const;
export type InstallationStage=typeof INSTALLATION_STAGES[number][0];
export type InstallationStatus=Partial<Record<InstallationStage,boolean>>;
export interface NoteDetails {checklist:NoteCheck[];images:NoteImage[];installation?:InstallationStatus}
export interface NoteCheck {id:string;text:string;done:boolean}
export interface NoteImage {id:string;name:string;imageUrl:string}
export type NoteTarget=EntitySelection|{type:'project'}|{type:'floor'}|{type:'referenceModel'};
export const NOTE_TEXT_MAX=20000,NOTE_CHECKS_MAX=100,NOTE_IMAGES_MAX=8,NOTE_IMAGE_MAX_BYTES=2*1024*1024,NOTE_IMAGES_TOTAL_BYTES=8*1024*1024;
const record=(v:unknown)=>{if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('메모 형식이 올바르지 않습니다.');return v as Record<string,unknown>;};
function text(v:unknown,max:number){if(typeof v!=='string'||v.length>max)throw new Error('메모 텍스트가 허용 길이를 초과했거나 올바르지 않습니다.');return v;}
function id(v:unknown){const s=text(v,200);if(!/^[a-zA-Z0-9_.:-]+$/.test(s))throw new Error('메모 항목 ID가 올바르지 않습니다.');return s;}
export function noteImageBytes(url:unknown){
 const s=text(url,Math.ceil(NOTE_IMAGE_MAX_BYTES/3)*4+64),match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(s);
 if(!match)throw new Error('메모 이미지는 내장 JPG·PNG·WebP만 지원합니다.');
 let bytes:string;try{bytes=atob(match[2]);}catch{throw new Error('메모 이미지 데이터가 손상됐습니다.');}
 const starts=(values:number[])=>values.every((n,i)=>bytes.charCodeAt(i)===n);
 if(bytes.length>NOTE_IMAGE_MAX_BYTES||!bytes.length)throw new Error('저장할 메모 이미지는 2MiB 이하여야 합니다.');
 const valid=match[1]==='png'?starts([137,80,78,71,13,10,26,10]):match[1]==='jpeg'?starts([255,216,255]):starts([82,73,70,70])&&bytes.slice(8,12)==='WEBP';
 if(!valid)throw new Error('메모 이미지의 실제 파일 형식이 일치하지 않습니다.');
 const [w,h]=textureHeaderSize(Uint8Array.from(bytes,c=>c.charCodeAt(0)),'image/'+match[1]);if(w<1||h<1||Math.max(w,h)>2048||w*h>4194304)throw new Error('저장할 메모 이미지는 긴 변 2,048px 이하여야 합니다.');return bytes.length;
}
export function parseNoteDetails(value:unknown):NoteDetails{
 const v=record(value);if(!Array.isArray(v.checklist)||v.checklist.length>NOTE_CHECKS_MAX||!Array.isArray(v.images)||v.images.length>NOTE_IMAGES_MAX)throw new Error('메모는 체크 항목 100개·이미지 8개까지 저장합니다.');
 const ids=new Set<string>(),unique=(value:unknown)=>{const key=id(value);if(ids.has(key))throw new Error('중복된 메모 항목 ID가 있습니다.');ids.add(key);return key;};
 const checklist=v.checklist.map(value=>{const c=record(value);if(typeof c.done!=='boolean')throw new Error('체크 항목 상태가 올바르지 않습니다.');return {id:unique(c.id),text:text(c.text,1000),done:c.done};});
 let size=0;const images=v.images.map(value=>{const i=record(value);size+=noteImageBytes(i.imageUrl);return {id:unique(i.id),name:text(i.name,200),imageUrl:i.imageUrl as string};});
 if(size>NOTE_IMAGES_TOTAL_BYTES)throw new Error('한 메모의 이미지 총합은 8MiB 이하여야 합니다.');
 let installation:InstallationStatus|undefined;
 if(v.installation!==undefined){const raw=record(v.installation);installation={};for(const [key,value] of Object.entries(raw)){if(!INSTALLATION_STAGES.some(([stage])=>stage===key)||typeof value!=='boolean')throw new Error('설치 확인 상태가 올바르지 않습니다.');installation[key as InstallationStage]=value;}}
 return {checklist,images,...(installation?{installation}:{})};
}
export function readNote(project:Project,target:NoteTarget):{text:string;details:NoteDetails}{
 const source=noteSource(project,target);return {text:source.note??'',details:source.noteDetails??{checklist:[],images:[]}};
}
function noteSource(project:Project,target:NoteTarget):{note?:string;noteDetails?:NoteDetails}{
 if(target.type==='project')return project;
 if(target.type==='floor')return {note:project.floorNote,noteDetails:project.floorNoteDetails};
 const entity=target.type==='referenceModel'?project.referenceModel:target.type==='wall'?project.walls.find(w=>w.id===target.id):target.type==='light'?project.lights?.find(l=>l.id===target.id):target.type==='modelArtwork'?project.modelArtworks?.find(a=>a.id===target.id):[...project.artworks,...project.unplacedArtworks??[]].find(a=>a.id===target.id);
 if(!entity)throw new Error('메모를 기록할 객체가 없습니다.');return entity;
}
export function updateNote(project:Project,target:NoteTarget,patch:{text?:string;details?:NoteDetails}):Project{
 const source=noteSource(project,target),next={...source,...(patch.text!==undefined?{note:text(patch.text,NOTE_TEXT_MAX)}:{}),...(patch.details!==undefined?{noteDetails:parseNoteDetails(patch.details)}:{})};
 if(target.type==='project')return {...project,note:next.note,noteDetails:next.noteDetails};
 if(target.type==='floor')return {...project,floorNote:next.note,floorNoteDetails:next.noteDetails};
 if(target.type==='referenceModel')return {...project,referenceModel:{...project.referenceModel!,...next}};
 if(target.type==='wall')return {...project,walls:project.walls.map(w=>w.id===target.id?{...w,...next}:w)};
 if(target.type==='light')return {...project,lights:project.lights?.map(l=>l.id===target.id?{...l,...next}:l)};
 if(target.type==='modelArtwork')return {...project,modelArtworks:project.modelArtworks?.map(a=>a.id===target.id?{...a,...next}:a)};
 return {...project,artworks:project.artworks.map(a=>a.id===target.id?{...a,...next}:a),unplacedArtworks:project.unplacedArtworks?.map(a=>a.id===target.id?{...a,...next}:a)};
}
/** Validate every private note, including historical Scene entities, before loading a project. */
export function validateProjectNotes(project:unknown){
 const p=record(project),seenImages=new Set<string>();let size=0;
 const note=(raw:unknown)=>{const n=record(raw);if(n.note!==undefined)text(n.note,NOTE_TEXT_MAX);if(n.noteDetails!==undefined){const details=parseNoteDetails(n.noteDetails);for(const i of details.images)if(!seenImages.has(i.imageUrl)){seenImages.add(i.imageUrl);size+=noteImageBytes(i.imageUrl);}}};
 const entities=(scope:Record<string,unknown>)=>{for(const key of ['walls','artworks','unplacedArtworks','modelArtworks','lights'] as const){const values=scope[key];if(Array.isArray(values))values.forEach(note);}if(scope.referenceModel!==undefined)note(scope.referenceModel);};
 note(p);note({note:p.floorNote,noteDetails:p.floorNoteDetails});entities(p);
 if(Array.isArray(p.scenes))for(const value of p.scenes){const s=record(value);entities(s);if(s.structure!==undefined)entities(record(s.structure));}
 if(p.planDraft!==undefined){const draft=record(p.planDraft);if(Array.isArray(draft.originalWalls))draft.originalWalls.forEach(note);}
 if(size>32*1024*1024)throw new Error('프로젝트의 서로 다른 메모 이미지 총합은 32MiB 이하여야 합니다.');
}

/** Scene changes restore placement; notes on surviving objects keep the latest installation information. */
export function preserveCurrentNotes(current:Project,restored:Project):Project{
 const keep=<T extends {id:string;note:string;noteDetails?:NoteDetails}>(items:T[]|undefined,previous:readonly {id:string;note:string;noteDetails?:NoteDetails}[])=>items?.map(item=>{const source=previous.find(v=>v.id===item.id);return source?{...item,note:source.note,noteDetails:source.noteDetails}:item;});
 const previousArtworks=[...current.artworks,...current.unplacedArtworks??[]];
 const reference=restored.referenceModel,currentReference=current.referenceModel;
 return {...restored,note:current.note,noteDetails:current.noteDetails,floorNote:current.floorNote,floorNoteDetails:current.floorNoteDetails,walls:keep(restored.walls,current.walls)!,artworks:keep(restored.artworks,previousArtworks)!,unplacedArtworks:keep(restored.unplacedArtworks,previousArtworks),modelArtworks:keep(restored.modelArtworks,current.modelArtworks??[]),lights:keep(restored.lights,current.lights??[]),referenceModel:reference&&currentReference?.dataUrl===reference.dataUrl?{...reference,note:currentReference.note,noteDetails:currentReference.noteDetails}:reference};
}
