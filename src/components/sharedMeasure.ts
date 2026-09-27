import type {Wall,WorldPoint} from '../domain/types';

interface DrawingPoint {x:number;y:number}
type ElevationWall=Pick<Wall,'start'|'end'|'heightMm'>;

export function nextMeasurePoints(current:readonly WorldPoint[],point:WorldPoint):WorldPoint[]{
  return current.length===1?[current[0],point]:[point];
}

export function measurementDistance(start:WorldPoint,end:WorldPoint):number{
  return Math.hypot(end.x-start.x,end.y-start.y,end.z-start.z);
}

export function elevationPoint(wall:ElevationWall,side:'front'|'back',drawing:DrawingPoint):WorldPoint{
  const dx=wall.end.x-wall.start.x,dz=wall.end.z-wall.start.z;
  const width=Math.hypot(dx,dz);
  const along=side==='back'?width-drawing.x:drawing.x;
  const t=width?along/width:0;
  return {x:wall.start.x+dx*t,y:wall.heightMm-drawing.y,z:wall.start.z+dz*t};
}

export function projectElevationPoint(wall:ElevationWall,side:'front'|'back',point:WorldPoint):DrawingPoint{
  const dx=wall.end.x-wall.start.x,dz=wall.end.z-wall.start.z;
  const width=Math.hypot(dx,dz);
  const along=width?((point.x-wall.start.x)*dx+(point.z-wall.start.z)*dz)/width:0;
  return {x:side==='back'?width-along:along,y:wall.heightMm-point.y};
}

export function svgDrawingPoint(svg:SVGSVGElement,clientX:number,clientY:number):DrawingPoint|null{
  const matrix=svg.getScreenCTM();
  if(!matrix)return null;
  const result=new DOMPoint(clientX,clientY).matrixTransform(matrix.inverse());
  return Number.isFinite(result.x)&&Number.isFinite(result.y)?{x:result.x,y:result.y}:null;
}
