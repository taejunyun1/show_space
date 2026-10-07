import type {Project} from './types';
/** Counts for the current layout only. Never include images, Notes or other Scenes. */
export function modelExportOmissions(project:Pick<Project,'lights'>){
 const visible=(project.lights??[]).filter(l=>l.visible);
 return {projectors:visible.filter(l=>!!l.projection).length,areaLights:visible.filter(l=>l.kind==='area').length};
}
export function modelExportOmissionNotice(project:Pick<Project,'lights'>){
 const counts=modelExportOmissions(project),parts=[counts.projectors?`프로젝터 ${counts.projectors}대`:null,counts.areaLights?`면 조명 ${counts.areaLights}개`:null].filter(Boolean);
 return parts.length?`${parts.join('·')}는 GLB·glTF에 포함되지 않습니다. 투사 모습은 PNG·PDF 3D, 편집 설정은 프로젝트 자산 백업으로 전달하세요.`:'';
}
