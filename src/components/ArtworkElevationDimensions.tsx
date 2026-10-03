import {artworkElevationDimensions,installationDimensionLabel,type InstallationDrawing} from '../domain/artworkElevationDimensions';
import {wallLength} from '../domain/wallGeometry';
export function ArtworkElevationDimensions({project,wallId,side,selectedIds}:{project:InstallationDrawing;wallId:string;side:'front'|'back';selectedIds:readonly string[]}){
 const wall=project.walls.find(w=>w.id===wallId);if(!wall)return null;
 const width=wallLength(wall),scale=Math.max(width,wall.heightMm),tick=scale/110,font=scale/80;
 const x=(value:number)=>side==='back'?width-value:value,y=(value:number)=>wall.heightMm-value;
 return <g className="svg-dimensions artwork-installation-dimensions" aria-label="작품 설치 치수" pointerEvents="none" style={{stroke:'#16816b',strokeWidth:12,fill:'none'}}>{artworkElevationDimensions(project,wallId,side,selectedIds).map(d=>{
  const label=installationDimensionLabel(d);
  const value=`${d.distanceMm.toLocaleString('ko-KR',{maximumFractionDigits:1})} mm`,description=`${label} ${value}`;
  const compact=d.kind==='gap';
  return <g key={d.key} aria-label={description} data-artwork-dimension={d.kind} data-distance-mm={d.distanceMm}><line x1={x(d.start.x)} y1={y(d.start.y)} x2={x(d.end.x)} y2={y(d.end.y)}/>{[d.start,d.end].map((p,i)=><line key={i} x1={x(p.x)-(d.axis==='vertical'?tick/2:0)} x2={x(p.x)+(d.axis==='vertical'?tick/2:0)} y1={y(p.y)-(d.axis==='horizontal'?tick/2:0)} y2={y(p.y)+(d.axis==='horizontal'?tick/2:0)}/>)}<text x={x((d.start.x+d.end.x)/2)+(d.axis==='vertical'?tick:0)} y={y((d.start.y+d.end.y)/2)-(d.axis==='horizontal'?tick:0)} style={{fontSize:compact?font*.75:font,fill:'#16816b',stroke:'#fff',strokeWidth:18,paintOrder:'stroke'}} textAnchor={d.axis==='horizontal'?'middle':'start'}>{compact?value:description}</text></g>;
 })}</g>;
}
