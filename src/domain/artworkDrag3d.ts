import {rotatedArtworkSize,wallLength} from './model';
import type {Artwork,Wall,WorldPoint} from './types';

type Ray={origin:WorldPoint;direction:WorldPoint};
export type ArtworkFacePoint={alongMm:number;centerHeightMm:number};

export function projectArtworkRay(wall:Wall,artwork:Artwork,ray:Ray):ArtworkFacePoint|null{
  const length=wallLength(wall);
  if(!length)return null;
  const ux=(wall.end.x-wall.start.x)/length,uz=(wall.end.z-wall.start.z)/length;
  const side=artwork.wallSide==='back'?-1:1;
  const nx=-uz*side,nz=ux*side;
  const offset=wall.thicknessMm/2+artwork.depthMm/2+5;
  const denominator=nx*ray.direction.x+nz*ray.direction.z;
  if(Math.abs(denominator)<1e-8)return null;
  const distance=(nx*(wall.start.x+nx*offset-ray.origin.x)+nz*(wall.start.z+nz*offset-ray.origin.z))/denominator;
  if(distance<=0)return null;
  const x=ray.origin.x+ray.direction.x*distance,z=ray.origin.z+ray.direction.z*distance;
  return {alongMm:(x-wall.start.x)*ux+(z-wall.start.z)*uz,centerHeightMm:ray.origin.y+ray.direction.y*distance};
}

export function draggedArtworkPlacement(artwork:Artwork,wall:Wall,grab:ArtworkFacePoint,hit:ArtworkFacePoint):ArtworkFacePoint{
  const length=wallLength(wall);
  const size=rotatedArtworkSize(artwork);
  const minAlong=Math.min(size.widthMm/2,length/2);
  const minHeight=Math.min(size.heightMm/2,wall.heightMm/2);
  const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
  const snap=(value:number)=>Math.round(value/10)*10;
  return {
    alongMm:clamp(snap(hit.alongMm+grab.alongMm),minAlong,length-minAlong),
    centerHeightMm:clamp(snap(hit.centerHeightMm+grab.centerHeightMm),minHeight,wall.heightMm-minHeight),
  };
}
