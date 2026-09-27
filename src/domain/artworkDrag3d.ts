import {rotatedArtworkSize,wallLength} from './model';
import type {Artwork,Wall,WorldPoint} from './types';

type Ray={origin:WorldPoint;direction:WorldPoint};
export type ArtworkFacePoint={alongMm:number;centerHeightMm:number};
export type ArtworkWallPoint=ArtworkFacePoint&{wallId:string;wallSide:'front'|'back'};

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

export function projectArtworkWallRay(walls:readonly Wall[],artwork:Artwork,ray:Ray):ArtworkWallPoint|null{
  let closest:{point:ArtworkWallPoint;distance:number}|null=null;
  for(const wall of walls){
    if(!wall.visible)continue;
    const length=wallLength(wall);if(!length)continue;
    const ux=(wall.end.x-wall.start.x)/length,uz=(wall.end.z-wall.start.z)/length;
    const frontX=-uz,frontZ=ux;
    const signed=(ray.origin.x-wall.start.x)*frontX+(ray.origin.z-wall.start.z)*frontZ;
    const wallSide:'front'|'back'=signed>=0?'front':'back';
    const side=wallSide==='front'?1:-1;
    const candidate={...artwork,wallSide};
    const hit=projectArtworkRay(wall,candidate,ray);
    if(!hit||hit.alongMm<0||hit.alongMm>length||hit.centerHeightMm<0||hit.centerHeightMm>wall.heightMm)continue;
    const offset=wall.thicknessMm/2+artwork.depthMm/2+5;
    const x=wall.start.x+ux*hit.alongMm+frontX*side*offset;
    const z=wall.start.z+uz*hit.alongMm+frontZ*side*offset;
    const denominator=ray.direction.x**2+ray.direction.y**2+ray.direction.z**2;
    const distance=((x-ray.origin.x)*ray.direction.x+(hit.centerHeightMm-ray.origin.y)*ray.direction.y+(z-ray.origin.z)*ray.direction.z)/denominator;
    if(distance>0&&(!closest||distance<closest.distance))closest={point:{wallId:wall.id,wallSide,...hit},distance};
  }
  return closest?.point??null;
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
