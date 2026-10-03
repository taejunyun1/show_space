import {Vector3,type Camera} from 'three';
import {artworkPosition,wallLength} from '../domain/model';
import type {Artwork,Wall} from '../domain/types';
import type {ArtworkFacePoint} from '../domain/artworkDrag3d';
/** Convert a 12 CSS-pixel acquisition radius into wall-axis distances at the current artwork plane. */
export function artworkSnapTolerance3d(camera:Camera,wall:Wall,artwork:Artwork,point:ArtworkFacePoint,size:{width:number;height:number}){
 const p=artworkPosition({...artwork,...point},wall),length=wallLength(wall);
 const origin=new Vector3(p.x/1000,p.y/1000,p.z/1000),screen=origin.clone().project(camera);
 const radius=(offset:Vector3)=>{const q=origin.clone().add(offset).project(camera);const pixels=Math.hypot((q.x-screen.x)*size.width/2,(q.y-screen.y)*size.height/2);return pixels>1e-4&&q.z>=-1&&q.z<=1&&screen.z>=-1&&screen.z<=1?Math.min(500,1200/pixels):0;};
 if(!length||size.width<=0||size.height<=0)return {alongMm:0,centerHeightMm:0};
 return {alongMm:radius(new Vector3((wall.end.x-wall.start.x)/length*.1,0,(wall.end.z-wall.start.z)/length*.1)),centerHeightMm:radius(new Vector3(0,.1,0))};
}
