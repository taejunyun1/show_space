import {sceneProject} from './sceneProject';
import type {Project} from './types';
import type {NoteDetails} from './notes';
import type {SurfaceMaterial} from './materials';
export type ArchiveSection='space'|'layout'|'materials'|'lighting'|'notes'|'scenes'|'photos';
export const ARCHIVE_SECTIONS:[ArchiveSection,string][]=[['space','공간'],['layout','작품 배치'],['materials','재질'],['lighting','조명'],['notes','메모'],['scenes','Scene'],['photos','참고 사진']];
export interface ArchiveSummary {id:string;name:string;venue:string;revision:number;createdAt:string;updatedAt:string;archived:boolean}
export interface ArchiveNote {key:string;label:string;text:string;details:NoteDetails}
export function archiveLayout(project:Project,sceneId:string|null){if(sceneId===null)return project;const scene=project.scenes.find(s=>s.id===sceneId);if(!scene)throw new Error('아카이브 Scene을 찾을 수 없습니다.');return sceneProject({...project,scenes:[]},scene);}
export function archiveNotes(project:Project):ArchiveNote[]{
 const notes:ArchiveNote[]=[];
 const add=(key:string,label:string,source:{note?:string;noteDetails?:NoteDetails})=>{const details=source.noteDetails??{checklist:[],images:[]};if(source.note?.trim()||details.checklist.length||details.images.length||Object.keys(details.installation??{}).length)notes.push({key,label,text:source.note??'',details});};
 add('project','프로젝트',project);add('floor','바닥',{note:project.floorNote,noteDetails:project.floorNoteDetails});
 for(const [kind,label,items] of [['wall','벽',project.walls],['artwork','작품',project.artworks],['unplaced','미배치 작품',project.unplacedArtworks??[]],['modelArtwork','3D 작품',project.modelArtworks??[]],['light','조명',project.lights??[]]] as const)for(const item of items)add(`${kind}:${item.id}`,`${label} · ${item.name}`,item);
 if(project.referenceModel)add('referenceModel','참고 공간 · '+project.referenceModel.name,project.referenceModel);
 return notes;
}
/** Private gallery includes Scene-only attachments, with repeated bytes shown once. */
export function archivePhotos(project:Project){
 const photos=new Map<string,{id:string;name:string;imageUrl:string;sources:string[]}>();
 const add=(scope:Project,label:string)=>{for(const note of archiveNotes(scope))for(const image of note.details.images){const source=`${label} · ${note.label}`,existing=photos.get(image.imageUrl);if(existing){if(!existing.sources.includes(source))existing.sources.push(source);}else photos.set(image.imageUrl,{id:'archive-photo-'+photos.size,name:image.name,imageUrl:image.imageUrl,sources:[source]});}};
 add(project,'현재 배치');for(const scene of project.scenes)add(sceneProject({...project,scenes:[]},scene),scene.name);return [...photos.values()];
}
export function archiveMaterials(project:Project){
 const values:Array<{key:string;label:string;color:string;material?:SurfaceMaterial}>=[{key:'floor',label:'바닥',color:project.floorColor,material:project.floorMaterial}];
 for(const wall of project.walls)values.push({key:'wall:'+wall.id,label:'벽 · '+wall.name,color:wall.color,material:wall.material});
 for(const a of [...project.artworks,...project.unplacedArtworks??[]])if(!a.video)values.push({key:'artwork:'+a.id,label:'작품 · '+a.name,color:'#ffffff',material:a.material});
 return values;
}
export const archiveYear=(summary:ArchiveSummary)=>new Intl.DateTimeFormat('en-US',{year:'numeric',timeZone:'Asia/Seoul'}).format(new Date(summary.updatedAt));
export function filterArchiveProjects(items:ArchiveSummary[],query:string,status:'all'|'active'|'archived',year:string,sort:'updated'|'name'){
 const terms=query.normalize('NFKC').toLocaleLowerCase('ko-KR').trim().split(/\s+/).filter(Boolean);
 return items.filter(p=>(status==='all'||p.archived===(status==='archived'))&&(!year||archiveYear(p)===year)&&terms.every(term=>`${p.name} ${p.venue} ${archiveYear(p)}`.normalize('NFKC').toLocaleLowerCase('ko-KR').includes(term))).sort((a,b)=>sort==='name'?a.name.localeCompare(b.name,'ko-KR')||a.id.localeCompare(b.id):Date.parse(b.updatedAt)-Date.parse(a.updatedAt)||a.id.localeCompare(b.id));
}
