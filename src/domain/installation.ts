import {INSTALLATION_STAGES,readNote,type NoteTarget,type InstallationStage} from './notes';
import type {Project,Artwork,UnplacedArtwork,ModelArtwork} from './types';
type RowBase={location:string;status:'배치됨'|'숨김'|'미배치'};
export type InstallationRow=RowBase&({kind:'mounted';artwork:Artwork;target:{type:'artwork';id:string}}|{kind:'unplaced';artwork:UnplacedArtwork;target:{type:'artwork';id:string}}|{kind:'model';artwork:ModelArtwork;target:{type:'modelArtwork';id:string}});
export function installationArtworks(project:Project):InstallationRow[]{
 return [...project.artworks.map(a=>({kind:'mounted' as const,artwork:a,target:{type:'artwork' as const,id:a.id},location:project.walls.find(w=>w.id===a.wallId)?.name??'벽 연결 없음',status:!a.visible||!project.walls.find(w=>w.id===a.wallId)?.visible?'숨김' as const:'배치됨' as const})),...(project.unplacedArtworks??[]).map(a=>({kind:'unplaced' as const,artwork:a,target:{type:'artwork' as const,id:a.id},location:'미배치',status:'미배치' as const})),...(project.modelArtworks??[]).map(a=>({kind:'model' as const,artwork:a,target:{type:'modelArtwork' as const,id:a.id},location:'바닥 · 3D 작품',status:a.visible?'배치됨' as const:'숨김' as const}))];
}
export function installationNotes(project:Project):Array<{label:string;target:NoteTarget}>{
 return [{label:'프로젝트',target:{type:'project'}},{label:'바닥',target:{type:'floor'}},...project.walls.map(w=>({label:w.name,target:{type:'wall' as const,id:w.id}})),...installationArtworks(project).map(r=>({label:r.artwork.name,target:r.target})),...(project.lights??[]).map(l=>({label:l.name,target:{type:'light' as const,id:l.id}})),...(project.referenceModel?[{label:'전시장 참고 모델',target:{type:'referenceModel' as const}}]:[])];
}
export function installationProgress(project:Project){
 const artworks=installationArtworks(project),notes=installationNotes(project),checks=notes.flatMap(n=>readNote(project,n.target).details.checklist);
 return {artworks:artworks.length,steps:artworks.length*INSTALLATION_STAGES.length,done:artworks.reduce((sum,r)=>sum+INSTALLATION_STAGES.filter(([key])=>r.artwork.noteDetails?.installation?.[key]).length,0),installed:artworks.filter(r=>r.artwork.noteDetails?.installation?.installed).length,checks:checks.length,checksDone:checks.filter(c=>c.done).length};
}
export function installationDetails(project:Project,target:NoteTarget,stage:InstallationStage,done:boolean){
 if(target.type!=='artwork'&&target.type!=='modelArtwork')throw new Error('작품을 선택한 뒤 설치 상태를 확인하세요.');
 const current=readNote(project,target).details;
 return {...current,installation:{...current.installation,[stage]:done}};
}
