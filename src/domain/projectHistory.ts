import type {Project} from './types';

export interface RestorePointSummary {
 id:string;projectId:string;label:string;projectName:string;venue:string;createdAt:string;sourceRevision:number;
 contentHash:string;bytes:number;walls:number;artworks:number;scenes:number;archived:boolean;
}
const sections:Record<keyof Project,string>={schemaVersion:'저장 형식',id:'프로젝트',name:'프로젝트 이름',venue:'전시장',displayUnit:'표시 단위',walls:'벽',artworks:'작품',unplacedArtworks:'미배치 작품',modelArtworks:'3D 작품',scenes:'Scene',floorColor:'바닥 색상',floorMaterial:'바닥 재질',importedFloor:'바닥 경계',referenceModel:'3D 참고 공간',lights:'개별 조명',lighting:'공간 조명',outdoor:'야외 환경',note:'프로젝트 메모',noteDetails:'프로젝트 체크·참고 이미지',floorNote:'바닥 메모',floorNoteDetails:'바닥 체크·참고 이미지',dimensions:'측정',openings:'문·개구부 후보',planImageUrl:'도면 이미지',sourcePlan:'원본 도면',planReference:'도면 축척·위치',planDraft:'벽 초안',planAnalysis:'도면 분석',planLabels:'도면 표기',planOpacity:'도면 투명도'};
/** Values are schema-normalized projects. Includes every root field, not just object counts. */
export function projectVersionChanges(current:Project,version:Project):string[]{
 const a=current as unknown as Record<string,unknown>,b=version as unknown as Record<string,unknown>;
 return [...new Set([...Object.keys(a),...Object.keys(b)])].filter(k=>JSON.stringify(a[k])!==JSON.stringify(b[k])).map(k=>sections[k as keyof Project]??'기타 프로젝트 정보');
}
