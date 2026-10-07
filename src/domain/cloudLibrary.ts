import {uuidPattern} from './cloudProject';
import {parseArtworkTemplate,libraryImageBytes,type ArtworkTemplate} from './artworkLibrary';
import {parseMaterialTemplate,type MaterialTemplate} from './materialLibrary';
export type LibraryKind='artwork'|'material';
export const CLOUD_LIBRARY_LIMITS={artwork:{items:500,bytes:32*1024*1024},material:{items:200,bytes:16*1024*1024}};
export const CLOUD_LIBRARY_ACCOUNT_BYTES=1024*1024*1024;
export type CloudLibraryDocument={format:'gonggan-library-item';version:1;kind:'artwork';template:ArtworkTemplate;thumbnail:string}|{format:'gonggan-library-item';version:1;kind:'material';template:MaterialTemplate;thumbnail?:string};
export interface CloudLibraryMetadata {sourceItemId:string;name:string;detail:string;archived:boolean}
export interface CloudLibrarySummary extends CloudLibraryMetadata {id:string;kind:LibraryKind;revision:number;sha256:string;bytes:number;createdAt:string;updatedAt:string}
export function parseLibraryKind(value:unknown):LibraryKind{if(value!=='artwork'&&value!=='material')throw new Error('라이브러리 종류가 올바르지 않습니다.');return value;}
export function parseLibraryMetadata(value:unknown):CloudLibraryMetadata{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('라이브러리 정보가 올바르지 않습니다.');const r=value as Record<string,unknown>;
 for(const k of ['sourceItemId','name','detail'])if(typeof r[k]!=='string'||(r[k] as string).length>500||(r[k] as string).includes('\0'))throw new Error('라이브러리 이름·정보가 올바르지 않습니다.');
 if(!(r.sourceItemId as string)||!(r.name as string).trim()||typeof r.archived!=='boolean')throw new Error('항목 이름과 보관 상태가 필요합니다.');return {sourceItemId:r.sourceItemId as string,name:r.name as string,detail:r.detail as string,archived:r.archived};
}
export function libraryMetadata(document:CloudLibraryDocument,sourceItemId:string,archived:boolean):CloudLibraryMetadata{
 const t=document.template;return parseLibraryMetadata({sourceItemId,name:document.kind==='artwork'?(t as ArtworkTemplate).artwork.name:(t as MaterialTemplate).name,detail:document.kind==='artwork'?[document.template.artwork.artist,document.template.artwork.year??'',document.template.kind==='model'?'3D 작품':document.template.artwork.video?'영상 작품':'이미지 작품'].filter(Boolean).join(' · '):(t as MaterialTemplate).category,archived});
}
export function parseLibraryDocument(value:unknown):CloudLibraryDocument{
 const r=value as CloudLibraryDocument;if(!r||r.format!=='gonggan-library-item'||r.version!==1)throw new Error('라이브러리 파일 형식이 올바르지 않습니다.');
 const kind=parseLibraryKind(r.kind);if(kind==='artwork'){libraryImageBytes(r.thumbnail,128*1024,256);return {format:r.format,version:1,kind,template:parseArtworkTemplate(r.template),thumbnail:r.thumbnail!};}
 if(r.thumbnail!==undefined)libraryImageBytes(r.thumbnail,128*1024,256);return {format:r.format,version:1,kind,template:parseMaterialTemplate(r.template),...(r.thumbnail!==undefined?{thumbnail:r.thumbnail}:{})};
}
export function parseLibrarySummary(value:unknown):CloudLibrarySummary{
 const meta=parseLibraryMetadata(value),r=value as Record<string,unknown>,kind=parseLibraryKind(r.kind);
 if(typeof r.id!=='string'||!uuidPattern.test(r.id)||!Number.isSafeInteger(r.revision)||(r.revision as number)<1||typeof r.sha256!=='string'||!/^[0-9a-f]{64}$/.test(r.sha256)||!Number.isSafeInteger(r.bytes)||(r.bytes as number)<2||(r.bytes as number)>CLOUD_LIBRARY_LIMITS[kind].bytes||typeof r.createdAt!=='string'||!Number.isFinite(Date.parse(r.createdAt))||typeof r.updatedAt!=='string'||!Number.isFinite(Date.parse(r.updatedAt)))throw new Error('계정 라이브러리 응답이 올바르지 않습니다.');
 return {...meta,id:r.id,kind,revision:r.revision as number,sha256:r.sha256,bytes:r.bytes as number,createdAt:r.createdAt,updatedAt:r.updatedAt};
}
export function encodeLibraryMetadata(value:CloudLibraryMetadata){const b=new TextEncoder().encode(JSON.stringify(parseLibraryMetadata(value)));if(b.length>5000)throw new Error('라이브러리 정보가 너무 깁니다.');return btoa(String.fromCharCode(...b));}
export function decodeLibraryMetadata(value:string|null){if(!value||value.length>7000)throw new Error('라이브러리 정보가 필요합니다.');return parseLibraryMetadata(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(value),c=>c.charCodeAt(0)))));}
