import {modelArtworkFootprint,modelArtworkBounds,type ModelArtworkPose} from '../domain/modelArtworks';
import {referenceModelFootprint,type ReferenceModelPlacement} from '../domain/referenceModel';
import type {Wall} from '../domain/types';

type CameraWall=Pick<Wall,'start'|'end'|'heightMm'>;

export function fitSharedCameraZoom(authoredZoom:number,viewport:{width:number;height:number},walls:readonly CameraWall[],models:readonly ModelArtworkPose[]=[],referenceModel?:ReferenceModelPlacement):number{
  const points=[...walls.flatMap(wall=>[wall.start,wall.end]),...models.flatMap(modelArtworkFootprint),...(referenceModel?referenceModelFootprint(referenceModel):[])];
  if(!points.length)return authoredZoom;
  const minX=Math.min(...points.map(point=>point.x)),maxX=Math.max(...points.map(point=>point.x));
  const minZ=Math.min(...points.map(point=>point.z)),maxZ=Math.max(...points.map(point=>point.z));
  const span=Math.max(2,Math.hypot(maxX-minX,maxZ-minZ)/1000);
  const height=Math.max(0,...walls.map(wall=>wall.heightMm),...models.map(a=>modelArtworkBounds(a).maxY),referenceModel?referenceModel.positionMm[1]+referenceModel.sizeMm[1]*referenceModel.scale:0)/1000;
  const fit=Math.min(viewport.width/(span*1.2+2),viewport.height/(span+height+2));
  return Math.min(authoredZoom,Math.max(.03,fit));
}
