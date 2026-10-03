import {deriveFloor} from './floor';
import type {Point,Wall} from './types';
export function floorFromLoops(loops:Point[][]){
 const walls:Wall[]=loops.flatMap((loop,i)=>loop.map((start,j)=>({id:`model-floor-${i}-${j}`,name:'모델 바닥',start,end:loop[(j+1)%loop.length],heightMm:1,thicknessMm:1,color:'#000000',note:'',visible:false,locked:true})));
 return deriveFloor(walls);
}
export function validateImportedFloor(value:unknown):asserts value is Point[][]{
 if(!Array.isArray(value)||!value.length||value.length>40)throw new Error('모델 바닥 경계가 올바르지 않습니다.');
 let count=0;for(const loop of value){if(!Array.isArray(loop)||loop.length<3||(count+=loop.length)>1000||loop.some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.z)||Math.max(Math.abs(p.x),Math.abs(p.z))>1e7))throw new Error('모델 바닥 좌표가 올바르지 않습니다.');}
 const floor=floorFromLoops(value);if(floor.invalidComponents||!floor.surfaces.length||floor.areaMm2<1)throw new Error('모델 바닥 경계가 닫히지 않거나 겹칩니다.');
}

export const floorSvgPath=(loops:Point[][])=>loops.map(loop=>loop.map((p,i)=>`${i?'L':'M'}${p.x},${p.z}`).join(' ')+' Z').join(' ');
