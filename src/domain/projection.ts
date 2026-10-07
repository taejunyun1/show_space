import {parseSurfaceTexture} from './surfaceTexture';
import type {WorldPoint} from './types';

export interface ProjectionScalars {throwRatio:number;aspectRatio:number;brightnessLumens:number;fit:'contain'|'cover'}
export interface ProjectionSettings extends ProjectionScalars {imageUrl:string}
export const MAX_PROJECTORS=2;
export function parseProjectionScalars(value:unknown):ProjectionScalars{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('프로젝터 설정이 올바르지 않습니다.');
 const v=value as Record<string,unknown>,number=(key:string,min:number,max:number)=>{const n=v[key];if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max)throw new Error('프로젝터 값이 허용 범위를 벗어났습니다.');return n;};
 if(v.fit!==undefined&&(typeof v.fit!=='string'||!['contain','cover'].includes(v.fit)))throw new Error('프로젝터 이미지 비율 설정이 올바르지 않습니다.');
 return {throwRatio:number('throwRatio',.3,10),aspectRatio:number('aspectRatio',.5,3),brightnessLumens:number('brightnessLumens',0,50000),fit:(v.fit??'contain') as ProjectionScalars['fit']};
}
export function parseProjection(value:unknown):ProjectionSettings{
 const scalar=parseProjectionScalars(value),v=value as Record<string,unknown>;
 return {...scalar,imageUrl:parseSurfaceTexture({imageUrl:v.imageUrl,widthMm:1,heightMm:1}).imageUrl};
}
export function projectionGeometry(light:{position:WorldPoint;target:WorldPoint;projection:ProjectionScalars}){
 const {throwRatio,aspectRatio,brightnessLumens}=light.projection;
 const distanceMm=Math.hypot(light.target.x-light.position.x,light.target.y-light.position.y,light.target.z-light.position.z),widthMm=distanceMm/throwRatio,heightMm=widthMm/aspectRatio;
 const verticalFov=2*Math.atan(1/(2*throwRatio*aspectRatio)),halfAngle=Math.atan(Math.hypot(widthMm,heightMm)/(2*distanceMm));
 return {distanceMm,widthMm,heightMm,verticalFov,halfAngle,focus:verticalFov/(2*halfAngle),intensity:brightnessLumens/(2*Math.PI*(1-Math.cos(halfAngle)))};
}
/** Changing throw distance keeps the aimed surface point fixed. */
export function projectorDistance(light:{position:WorldPoint;target:WorldPoint},distanceMm:number){
 if(!Number.isFinite(distanceMm)||distanceMm<100||distanceMm>100000)throw new Error('투사 거리는 100~100,000mm로 입력해주세요.');
 const d=Math.hypot(light.position.x-light.target.x,light.position.y-light.target.y,light.position.z-light.target.z);
 return {x:light.target.x+(light.position.x-light.target.x)*distanceMm/d,y:light.target.y+(light.position.y-light.target.y)*distanceMm/d,z:light.target.z+(light.position.z-light.target.z)*distanceMm/d};
}
