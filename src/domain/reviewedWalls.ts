import type {Project,Point,Wall} from './types';
import {validatePlanReference} from './plan';
export interface PixelSegment {start:{x:number;y:number};end:{x:number;y:number}}
export function addReviewedWalls(project:Project,segments:PixelSegment[],heightMm:number,thicknessMm:number):Project{
 const r=project.planReference;
 if(!r||!project.planImageUrl||!r.calibrated)throw new Error('도면의 두 점 축척을 먼저 보정하세요.');
 validatePlanReference(r);
 if(!segments.length)throw new Error('추가할 벽 후보를 선택하세요.');
 if(![heightMm,thicknessMm].every(n=>Number.isFinite(n)&&n>0)||heightMm>20000||thicknessMm>2000)throw new Error('벽 높이·두께를 확인하세요.');
 const same=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.z-b.z)<5;
 const toPoint=(p:{x:number;y:number})=>{if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.y<0||p.x>r.widthPx||p.y>r.heightPx)throw new Error('후보 좌표가 도면 밖에 있습니다.');return {x:Math.round((r.origin.x+p.x*r.mmPerPixel)*10)/10,z:Math.round((r.origin.z+p.y*r.mmPerPixel)*10)/10};};
 const walls=[...project.walls];const ids=new Set([...project.walls,...project.artworks].map(e=>e.id));let index=1;
 for(const segment of segments){const start=toPoint(segment.start),end=toPoint(segment.end);if(same(start,end))throw new Error('벽 후보 길이가 너무 짧습니다.');if(walls.some(w=>same(w.start,start)&&same(w.end,end)||same(w.start,end)&&same(w.end,start)))continue;
 if(walls.length>=200)throw new Error('벽은 최대 200개까지 추가할 수 있습니다.');
 while(ids.has(`detected-wall-${index}`))index++;const id=`detected-wall-${index++}`;ids.add(id);
 const wall:Wall={id,name:`검토한 벽 ${index-1}`,start,end,heightMm,thicknessMm,role:'partition',color:'#ffffff',visible:true,locked:false,note:'도면 직선 후보에서 사용자가 선택한 벽. 높이·두께는 입력값이며 자동 실측값이 아닙니다.'};walls.push(wall);
 }
 if(walls.length===project.walls.length)throw new Error('선택한 후보가 기존 벽과 중복됩니다.');
 return {...project,walls};
}
