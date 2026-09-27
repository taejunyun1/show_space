import type {Wall} from '../domain/types';

type CameraWall=Pick<Wall,'start'|'end'|'heightMm'>;

export function fitSharedCameraZoom(authoredZoom:number,viewport:{width:number;height:number},walls:readonly CameraWall[]):number{
  const points=walls.flatMap(wall=>[wall.start,wall.end]);
  if(!points.length)return authoredZoom;
  const minX=Math.min(...points.map(point=>point.x)),maxX=Math.max(...points.map(point=>point.x));
  const minZ=Math.min(...points.map(point=>point.z)),maxZ=Math.max(...points.map(point=>point.z));
  const span=Math.max(2,Math.hypot(maxX-minX,maxZ-minZ)/1000);
  const height=Math.max(...walls.map(wall=>wall.heightMm))/1000;
  const fit=Math.min(viewport.width/(span*1.2+2),viewport.height/(span+height+2));
  return Math.min(authoredZoom,Math.max(.03,fit));
}
