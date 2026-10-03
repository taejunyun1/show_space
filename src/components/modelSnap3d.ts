import {Vector3,type Camera} from 'three';
import type {WorldPoint} from '../domain/types';
/** Local projection estimate of a 12 CSS-pixel radius, capped at 500mm. */
export function modelSnapRadius3d(camera:Camera,position:WorldPoint,direction:WorldPoint,size:{width:number;height:number}){
 const length=Math.hypot(direction.x,direction.y,direction.z);if(!length||size.width<=0||size.height<=0)return 0;
 const p=new Vector3(position.x/1000,position.y/1000,position.z/1000),a=p.clone().project(camera),b=p.clone().add(new Vector3(direction.x,direction.y,direction.z).multiplyScalar(.1/length)).project(camera);
 const pixels=Math.hypot((b.x-a.x)*size.width/2,(b.y-a.y)*size.height/2);return pixels>1e-4&&a.z>=-1&&a.z<=1&&b.z>=-1&&b.z<=1?Math.min(500,1200/pixels):0;
}
