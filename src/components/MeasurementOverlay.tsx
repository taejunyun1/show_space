import {resolveAnchor,resolveMeasurement} from '../domain/measurements';
import type {MeasurementAnchor,Point,Project,WorldPoint} from '../domain/types';

interface Draft {view:'plan'|'elevation'|'3d';elevationWallId?:string;start:MeasurementAnchor;end?:MeasurementAnchor}
function mm(value:number){return `${Math.round(value).toLocaleString()} mm`;}

function Segment({a,b,label,color,offset,scale=1,dashed=false}:{a:Point;b:Point;label:string;color:string;offset:number;scale?:number;dashed?:boolean}){
 const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz)||1,nx=-dz/length,nz=dx/length;
 const first={x:a.x+nx*offset,z:a.z+nz*offset},last={x:b.x+nx*offset,z:b.z+nz*offset};
 return <g pointerEvents="none"><line x1={a.x} y1={a.z} x2={first.x} y2={first.z} stroke={color} strokeWidth={Math.max(10,scale/900)}/><line x1={b.x} y1={b.z} x2={last.x} y2={last.z} stroke={color} strokeWidth={Math.max(10,scale/900)}/><line x1={first.x} y1={first.z} x2={last.x} y2={last.z} stroke={color} strokeWidth={Math.max(15,scale/650)} strokeDasharray={dashed?`${scale/130} ${scale/180}`:undefined}/><circle cx={a.x} cy={a.z} r={Math.max(25,scale/280)} fill={color}/><circle cx={b.x} cy={b.z} r={Math.max(25,scale/280)} fill={color}/><text x={(first.x+last.x)/2} y={(first.z+last.z)/2-Math.max(45,scale/100)} textAnchor="middle" fontSize={Math.max(90,scale/75)} fill={color} stroke="white" strokeWidth={Math.max(10,scale/700)} paintOrder="stroke">{label}</text></g>;
}

export function PlanMeasurements({project,draft,showDimensions,scale}:{project:Project;draft:Draft|null;showDimensions:boolean;scale:number}){
 const uncertain=!!project.planImageUrl&&!project.planReference?.calibrated;
 const provisional=!!project.planDraft&&!project.planReference?.calibrated;
 const distance=(value:number)=>`${Math.round(value).toLocaleString()} ${provisional?'px':'mm'}`;
 return <g aria-label="평면 치수선">{showDimensions&&(project.dimensions??[]).filter(item=>item.view==='plan').map(item=>{const r=resolveMeasurement(project,item);return <Segment key={item.id} a={r.start} b={r.end} offset={item.offsetMm} scale={scale} color={r.detached?'#b54437':'#365cf5'} label={`${r.detached?'연결 끊김 · ':uncertain&&!provisional?'모델상 · ':''}${distance(r.distanceMm)}`}/>;})}{draft?.view==='plan'&&<g data-capture-draft="true">{draft.end?<DraftPlanSegment project={project} start={draft.start} end={draft.end} scale={scale}/>:<circle cx={resolveAnchor(project,draft.start).point.x} cy={resolveAnchor(project,draft.start).point.z} r={Math.max(35,scale/240)} fill="#365cf5" pointerEvents="none"/>}</g>}</g>;
}

function DraftPlanSegment({project,start,end,scale}:{project:Project;start:MeasurementAnchor;end:MeasurementAnchor;scale:number}){
 const a=resolveAnchor(project,start).point,b=resolveAnchor(project,end).point;
 return <Segment a={a} b={b} offset={0} scale={scale} color="#16816b" dashed label={`${Math.round(Math.hypot(b.x-a.x,b.z-a.z)).toLocaleString()} ${project.planDraft&&!project.planReference?.calibrated?'px':'mm'}`}/>;
}

function onWall(point:WorldPoint,wall:{start:Point;end:Point;heightMm:number},back:boolean):Point{
 const dx=wall.end.x-wall.start.x,dz=wall.end.z-wall.start.z,length=Math.hypot(dx,dz);
 const along=((point.x-wall.start.x)*dx+(point.z-wall.start.z)*dz)/length;
 return {x:back?length-along:along,z:wall.heightMm-point.y};
}

export function ElevationMeasurements({project,draft,showDimensions,wallId,back}:{project:Project;draft:Draft|null;showDimensions:boolean;wallId:string;back:boolean}){
 const wall=project.walls.find(item=>item.id===wallId);if(!wall)return null;
 const scale=Math.max(Math.hypot(wall.end.x-wall.start.x,wall.end.z-wall.start.z),wall.heightMm);
 return <g aria-label="벽면 치수선">{showDimensions&&(project.dimensions??[]).filter(item=>item.view==='elevation'&&item.elevationWallId===wallId).map(item=>{const r=resolveMeasurement(project,item);return <Segment key={item.id} a={onWall(r.start,wall,back)} b={onWall(r.end,wall,back)} offset={item.offsetMm} scale={scale} color={r.detached?'#b54437':'#365cf5'} label={`${r.detached?'연결 끊김 · ':''}${mm(r.distanceMm)}`}/>;})}{draft?.view==='elevation'&&draft.elevationWallId===wallId&&<g data-capture-draft="true">{draft.end?(()=>{const a=resolveAnchor(project,draft.start).point,b=resolveAnchor(project,draft.end).point;return <Segment a={onWall(a,wall,back)} b={onWall(b,wall,back)} offset={0} scale={scale} color="#16816b" dashed label={mm(Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z))}/>;})():<circle {...(()=>{const p=onWall(resolveAnchor(project,draft.start).point,wall,back);return {cx:p.x,cy:p.z};})()} r={Math.max(35,scale/240)} fill="#365cf5" pointerEvents="none"/>}</g>}</g>;
}
