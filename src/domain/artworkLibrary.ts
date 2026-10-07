import {parseArtworkInformation} from './artworkInformation';
import {parseFrameSettings,rotatedArtworkOuterSize} from './artworkPresentation';
import {parseSurfaceMaterial} from './materials';
import {addArtwork,createDemoProject,parseProject,wallLength} from './model';
import {addModelArtwork,parseModelArtwork} from './modelArtworks';
import {textureHeaderSize} from '../lib/artworkModelPayload';
import type {Artwork,ModelArtwork,Project,EntitySelection} from './types';
type ImageDesign=Pick<Artwork,'name'|'artist'|'widthMm'|'heightMm'|'depthMm'|'frame'|'frameSettings'|'material'|'imageUrl'|'year'|'medium'|'description'|'artworkType'|'presentationType'>;
type ModelDesign=Pick<ModelArtwork,'name'|'artist'|'year'|'kind'|'model'|'widthMm'|'heightMm'|'depthMm'|'medium'|'description'|'artworkType'|'presentationType'>;
export type ArtworkTemplate={kind:'image';artwork:ImageDesign}|{kind:'model';artwork:ModelDesign};
export const ARTWORK_LIBRARY_IMAGE_MAX=5*1024*1024;
const record=(v:unknown)=>{if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('라이브러리 작품 형식이 올바르지 않습니다.');return v as Record<string,unknown>;};
export function libraryImageBytes(value:unknown,maxBytes=ARTWORK_LIBRARY_IMAGE_MAX,maxEdge=2048){
 if(typeof value!=='string'||value.length>Math.ceil(maxBytes/3)*4+64)throw new Error('라이브러리 이미지 용량을 초과했습니다.');
 const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);if(!match)throw new Error('라이브러리에는 내장 JPG·PNG·WebP 이미지만 저장합니다.');
 let bytes:Uint8Array;try{bytes=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0));}catch{throw new Error('라이브러리 이미지가 손상됐습니다.');}
 if(!bytes.length||bytes.length>maxBytes)throw new Error('라이브러리 이미지 용량을 초과했습니다.');
 const starts=(s:number[])=>s.every((n,i)=>bytes[i]===n);
 if(!(match[1]==='png'?starts([137,80,78,71,13,10,26,10]):match[1]==='jpeg'?starts([255,216,255]):starts([82,73,70,70])&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP'))throw new Error('라이브러리 이미지의 실제 형식이 다릅니다.');
 const [w,h]=textureHeaderSize(bytes,'image/'+match[1]);if(w<1||h<1||Math.max(w,h)>maxEdge)throw new Error(`라이브러리 이미지의 긴 변은 ${maxEdge}px 이하여야 합니다.`);
 return bytes.length;
}
/** A portable design, with no installation location, identity, grouping or private notes. */
export function parseArtworkTemplate(value:unknown):ArtworkTemplate{
 const input=record(value),raw=record(input.artwork);
 for(const key of ['name','artist'])if(typeof raw[key]!=='string'||(raw[key] as string).length>200||(key==='name'&&!(raw[key] as string).trim()))throw new Error('작품 제목·작가는 200자 이하로 입력하세요.');
 const shared={name:raw.name as string,artist:raw.artist as string,widthMm:raw.widthMm as number,heightMm:raw.heightMm as number,depthMm:raw.depthMm as number,...parseArtworkInformation(raw)};
 if(input.kind==='image'){
  libraryImageBytes(raw.imageUrl);
  const a:ImageDesign={...shared,frame:raw.frame as Artwork['frame'],imageUrl:raw.imageUrl as string,...(raw.frameSettings!==undefined?{frameSettings:parseFrameSettings(raw.frameSettings)}:{}),...(raw.material!==undefined?{material:parseSurfaceMaterial(raw.material)}:{})};
  if(a.material?.normal)libraryImageBytes(a.material.normal.imageUrl,5_000_000,1024);
  const p=createDemoProject();parseProject({...p,artworks:[{...a,id:'template',wallId:p.walls[0].id,alongMm:0,centerHeightMm:1500,visible:true,locked:false,note:''}]});
  return structuredClone({kind:'image',artwork:a});
 }
 if(input.kind==='model'){
  const model=record(raw.model);
  const a:ModelDesign={...shared,year:raw.year as string,kind:raw.kind as ModelArtwork['kind'],model:{name:model.name as string,dataUrl:model.dataUrl as string,sizeMm:model.sizeMm as [number,number,number],sourceOffsetM:model.sourceOffsetM as [number,number,number]}};
  parseModelArtwork({...a,id:'template',position:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0},visible:true,locked:false,note:''});
  return structuredClone({kind:'model',artwork:a});
 }
 throw new Error('라이브러리에는 이미지 작품 또는 3D 작품을 저장합니다.');
}
export function artworkTemplate(kind:'image',artwork:Artwork):Extract<ArtworkTemplate,{kind:'image'}>;
export function artworkTemplate(kind:'model',artwork:ModelArtwork):Extract<ArtworkTemplate,{kind:'model'}>;
export function artworkTemplate(kind:'image'|'model',artwork:Artwork|ModelArtwork):ArtworkTemplate;
export function artworkTemplate(kind:'image'|'model',artwork:Artwork|ModelArtwork){return parseArtworkTemplate({kind,artwork});}
export function installArtworkTemplate(project:Project,input:ArtworkTemplate,wallId=project.walls[0]?.id):{project:Project;selection:EntitySelection}{
 if(project.planDraft&&!project.planReference?.calibrated)throw new Error('도면 축척을 보정한 뒤 작품을 배치하세요.');
 const template=parseArtworkTemplate(input);
 if(template.kind==='model'){
  const a=template.artwork,result=addModelArtwork(project,{...a.model,visible:true,positionMm:[0,0,0],rotationDeg:0,scale:1});
  const artwork={...result.artwork,...a};
  return {project:{...result.project,modelArtworks:result.project.modelArtworks!.map(item=>item.id===artwork.id?artwork:item)},selection:{type:'modelArtwork',id:artwork.id}};
 }
 const wall=project.walls.find(w=>w.id===wallId);if(!wall)throw new Error('배치할 벽을 선택하세요.');
 const next=addArtwork(project,template.artwork.imageUrl,template.artwork.name),base=next.artworks.at(-1)!;
 const artwork:Artwork={...base,...template.artwork,wallId:wall.id};
 const outer=rotatedArtworkOuterSize(artwork),margin=Math.min(outer.heightMm/2,wall.heightMm/2);
 artwork.alongMm=Math.min(outer.widthMm/2,wallLength(wall)/2);artwork.centerHeightMm=Math.max(margin,Math.min(wall.heightMm-margin,1500));
 return {project:{...next,artworks:next.artworks.map(item=>item.id===artwork.id?artwork:item)},selection:{type:'artwork',id:artwork.id}};
}
