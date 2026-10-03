import {artworkElevationDimensions} from '../domain/artworkElevationDimensions';
import {wallLength} from '../domain/model';
import type {Project} from '../domain/types';
export function ArtworkElevationDimensions({project,wallId,side,selectedIds}:{project:Project;wallId:string;side:'front'|'back';selectedIds:string[]}){
 const wall=project.walls.find(w=>w.id===wallId);if(!wall)return null;
 const width=wallLength(wall),scale=Math.max(width,wall.heightMm),tick=scale/110,font=scale/80;
 const x=(value:number)=>side==='back'?width-value:value,y=(value:number)=>wall.heightMm-value;
 return <g className="svg-dimensions artwork-installation-dimensions" aria-label="작품 설치 치수" pointerEvents="none">{artworkElevationDimensions(project,wallId,side,selectedIds).map(d=>{
  const label=d.kind==='gap'?`외곽 ${d.axis==='horizontal'?'가로':'세로'} 간격`:d.kind==='floor'?'바닥':d.kind==='left'?'벽 왼쪽':'벽 오른쪽';
  const value=`${d.distanceMm.toLocaleString('ko-KR',{maximumFractionDigits:1})} mm`,description=`${label} ${value}`;
  const compact=d.kind==='gap'&&selectedIds.length>1;
  return <g key={d.key} aria-label={description} data-artwork-dimension={d.kind} data-distance-mm={d.distanceMm}><line x1={x(d.start.x)} y1={y(d.start.y)} x2={x(d.end.x)} y2={y(d.end.y)}/>{[d.start,d.end].map((p,i)=><line key={i} x1={x(p.x)-(d.axis==='vertical'?tick/2:0)} x2={x(p.x)+(d.axis==='vertical'?tick/2:0)} y1={y(p.y)-(d.axis==='horizontal'?tick/2:0)} y2={y(p.y)+(d.axis==='horizontal'?tick/2:0)}/>)}<text x={x((d.start.x+d.end.x)/2)+(d.axis==='vertical'?tick:0)} y={y((d.start.y+d.end.y)/2)-(d.axis==='horizontal'?tick:0)} style={{fontSize:compact?font*.75:font,fill:'#16816b'}} textAnchor={d.axis==='horizontal'?'middle':'start'}>{compact?value:description}</text></g>;
 })}</g>;
}
