import type {Project,Artwork,UnplacedArtwork,ModelArtwork} from './types';
import {materialPresets,type SurfaceMaterial} from './materials';
import {artworkTypeLabels,presentationTypeLabels} from './artworkInformation';
import {resolvedFrameSettings} from './artworkPresentation';

export type OutlinerObjectType='wall'|'floor'|'light'|'artwork'|'unplacedArtwork'|'modelArtwork'|'referenceModel';
export interface OutlinerSearchResult {type:OutlinerObjectType;id:string}
const normalized=(s:string)=>s.normalize('NFC').toLocaleLowerCase();
const materialText=(m?:SurfaceMaterial)=>m?[m.preset,materialPresets.find(p=>p.id===m.preset)?.label??'']:['기본 재질'];
function artworkText(a:Artwork|UnplacedArtwork|ModelArtwork):string[]{
 const fields=[a.name,a.artist,a.medium??'',a.artworkType?artworkTypeLabels[a.artworkType]:'',a.presentationType?presentationTypeLabels[a.presentationType]:''];
 if('frame' in a)fields.push(...materialText(a.material));
 if('frame' in a&&a.frame!=='none'){
  const frame=resolvedFrameSettings(a);fields.push('액자',{wood:'목재 wood',metal:'금속 metal',paint:'도장 paint'}[frame.material]);
  if(frame.cover!=='none')fields.push(frame.cover==='glass'?'유리 glass':'아크릴 acrylic');
 }
 return fields;
}
/** Search current objects only. Do not index history, private notes or encoded assets. */
export function searchProjectObjects(project:Project,query:string,scope:'all'|'artwork'='all'):OutlinerSearchResult[]{
 const terms=normalized(query.trim()).split(/\s+/).filter(Boolean),results:OutlinerSearchResult[]=[];
 const add=(type:OutlinerObjectType,id:string,fields:string[])=>{
  const text=normalized(fields.join(' '));if(terms.every(term=>text.includes(term)))results.push({type,id});
 };
 if(scope==='all'){
  for(const w of project.walls)add('wall',w.id,[w.name,'벽 wall',w.role==='partition'?'가벽 내부벽 partition':'바닥 경계 boundary',...materialText(w.material)]);
  add('floor','',['바닥 floor',...materialText(project.floorMaterial)]);
  for(const l of project.lights??[])add('light',l.id,[l.name,'조명 light',l.kind==='spot'?'스팟 spot':'면조명 area']);
  if(project.referenceModel)add('referenceModel','',[project.referenceModel.name,'전시장 참고 모델 3D 공간']);
 }
 for(const a of project.artworks){const wall=project.walls.find(w=>w.id===a.wallId);add('artwork',a.id,[...artworkText(a),'작품 artwork',wall?.name??'',a.wallSide==='back'?'B면':'A면']);}
 for(const a of project.unplacedArtworks??[])add('unplacedArtwork',a.id,[...artworkText(a),'작품 미배치 unplaced']);
 for(const a of project.modelArtworks??[])add('modelArtwork',a.id,[...artworkText(a),a.model.name,'3D 작품 바닥',artworkTypeLabels[a.kind==='custom'?'custom':a.kind]]);
 return results;
}
