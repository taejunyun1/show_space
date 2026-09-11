import {readPlanNumbers} from './planNumbers';
import {updateWall,wallLength} from './model';
import type {Project} from './types';
export type DimensionField='length'|'height'|'thickness';
export type DimensionUnit='mm'|'cm'|'m';
export function applyLinkedDimension(project:Project,labelId:string,wallId:string,field:DimensionField,unit:DimensionUnit):Project{
 const label=project.planLabels?.find(l=>l.id===labelId);
 if(!label||label.kind!=='dimension'||label.status!=='confirmed')throw new Error('숫자 표기를 먼저 확인하세요.');
 const numbers=readPlanNumbers(label.correctedText??label.text);
 if(/\d\s*[x×]\s*\d/i.test(label.correctedText??label.text)||numbers.length!==1||numbers[0].values.length!==1)throw new Error('숫자를 하나로 정정하고 확인하세요.');
 if(!['length','height','thickness'].includes(field)||!['mm','cm','m'].includes(unit))throw new Error('치수 종류와 단위를 선택하세요.');
 const number=numbers[0];
 if(number.unit&&number.unit!==unit)throw new Error('선택한 단위가 표기 단위와 다릅니다.');
 if(number.axis&&number.axis!==field)throw new Error('선택한 치수 종류가 표기와 다릅니다.');
 const mm=number.values[0]*({mm:1,cm:10,m:1000}[unit]);
 if(!Number.isFinite(mm)||mm<=0||mm>({length:200000,height:20000,thickness:2000}[field]))throw new Error('연결 가능한 범위는 길이 200m, 높이 20m, 두께 2m 이하입니다. 숫자와 단위를 확인하세요.');
 const wall=project.walls.find(w=>w.id===wallId);
 if(!wall)throw new Error('연결할 벽을 선택하세요.');
 const note=`도면 숫자 연결: ${label.text}${label.correctedText?` → ${label.correctedText}`:''} / ${{length:'길이',height:'높이',thickness:'두께'}[field]} ${mm} mm (${label.source==='ocr'?'OCR':'PDF 텍스트'})`;
 const patch={note:wall.note.endsWith(note)?wall.note:[wall.note,note].filter(Boolean).join('\n')};
 if(field==='height')return updateWall(project,wallId,{...patch,heightMm:mm});
 if(field==='thickness')return updateWall(project,wallId,{...patch,thicknessMm:mm});
 const factor=mm/wallLength(wall);
 return updateWall(project,wallId,{...patch,end:{x:wall.start.x+(wall.end.x-wall.start.x)*factor,z:wall.start.z+(wall.end.z-wall.start.z)*factor}});
}
