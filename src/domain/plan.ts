import type { PlanReference, Point } from './types';
export function validatePlanReference(p: PlanReference) {
 if (!p || !p.origin || !Number.isFinite(p.origin.x) || !Number.isFinite(p.origin.z) || ![p.widthPx,p.heightPx,p.mmPerPixel].every(v=>Number.isFinite(v)&&v>0) || p.widthPx>10000 || p.heightPx>10000 || typeof p.calibrated!=='boolean') throw new Error('도면 축척 정보가 올바르지 않습니다.');
}
export function fitPlan(widthPx:number,heightPx:number,origin:Point,widthMm:number):PlanReference {
 const p={widthPx,heightPx,origin:{...origin},mmPerPixel:widthMm/widthPx,calibrated:false}; validatePlanReference(p); return p;
}
export function calibratePlan(p:PlanReference,a:Point,b:Point,lengthMm:number):PlanReference {
 validatePlanReference(p);
 if (![a,b].every(v=>Number.isFinite(v.x)&&Number.isFinite(v.z)&&v.x>=0&&v.z>=0&&v.x<=p.widthPx&&v.z<=p.heightPx)) throw new Error('도면 내부에서 두 점을 선택해 주세요.');
 const distance=Math.hypot(b.x-a.x,b.z-a.z);
 if (distance<1 || !Number.isFinite(lengthMm) || lengthMm<=0) throw new Error('서로 다른 두 점과 0보다 큰 실제 길이를 입력해 주세요.');
 const mmPerPixel=lengthMm/distance;
 const next={...p,mmPerPixel,origin:{x:p.origin.x+a.x*(p.mmPerPixel-mmPerPixel),z:p.origin.z+a.z*(p.mmPerPixel-mmPerPixel)},calibrated:true}; validatePlanReference(next); return next;
}
