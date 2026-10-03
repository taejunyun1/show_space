export const artworkTypes=['photo','painting','print','video','projection','sculpture','installation','object','custom'] as const;
export const presentationTypes=['photo-print','framed-print','mounted-print','acrylic-mount','canvas','screen','projection','object','sculpture','custom'] as const;
export type ArtworkType=typeof artworkTypes[number];
export type PresentationType=typeof presentationTypes[number];
export interface ArtworkInformation {year?:string;medium?:string;description?:string;artworkType?:ArtworkType;presentationType?:PresentationType}
export const artworkTypeLabels:Record<ArtworkType,string>={photo:'사진',painting:'회화',print:'프린트',video:'영상',projection:'프로젝션',sculpture:'조각',installation:'설치',object:'오브젝트',custom:'기타'};
export const presentationTypeLabels:Record<PresentationType,string>={'photo-print':'사진 프린트','framed-print':'액자 프린트','mounted-print':'마운트 프린트','acrylic-mount':'아크릴 마운트',canvas:'캔버스',screen:'스크린',projection:'프로젝션',object:'오브젝트',sculpture:'조각',custom:'기타'};
export const ARTWORK_YEAR_MAX=200,ARTWORK_MEDIUM_MAX=300,ARTWORK_DESCRIPTION_MAX=2000;
/** Text and enums only. Private notes and asset references are never inferred or copied. */
export function parseArtworkInformation(input:unknown):ArtworkInformation{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('작품 정보 형식이 올바르지 않습니다.');
 const raw=input as Record<string,unknown>,result:ArtworkInformation={};
 for(const [key,max] of [['year',ARTWORK_YEAR_MAX],['medium',ARTWORK_MEDIUM_MAX],['description',ARTWORK_DESCRIPTION_MAX]] as const){const value=raw[key];if(value!==undefined){if(typeof value!=='string'||value.length>max)throw new Error(`작품 ${key}는 ${max}자 이하의 텍스트여야 합니다.`);result[key]=value;}}
 if(raw.artworkType!==undefined){if(!artworkTypes.includes(raw.artworkType as ArtworkType))throw new Error('작품 종류가 올바르지 않습니다.');result.artworkType=raw.artworkType as ArtworkType;}
 if(raw.presentationType!==undefined){if(!presentationTypes.includes(raw.presentationType as PresentationType))throw new Error('작품 설치 형식이 올바르지 않습니다.');result.presentationType=raw.presentationType as PresentationType;}
 return result;
}
/** Year is basic public information; other descriptive fields require explicit publication. */
export function publicArtworkInformation(input:unknown,includeDetails:boolean):ArtworkInformation{
 const raw=input as Record<string,unknown>;
 const parsed=parseArtworkInformation(includeDetails?input:{year:raw.year});
 return includeDetails?parsed:(parsed.year===undefined?{}:{year:parsed.year});
}
