import {modelArtworkBounds} from './modelArtworks';
import type {Project,ReferenceModel} from './types';
import {inspectGlb,MODEL_MAX_BYTES} from '../lib/glbPayload';
export function validateReferenceModel(value:unknown):asserts value is ReferenceModel{
 const m=value as ReferenceModel;
 if(!m||typeof m!=='object'||typeof m.name!=='string'||!m.name.trim()||m.name.length>200||typeof m.visible!=='boolean'||!Number.isFinite(m.scale)||m.scale<.01||m.scale>100||!Number.isFinite(m.rotationDeg)||Math.abs(m.rotationDeg)>180)throw new Error('3D 모델 속성이 올바르지 않습니다.');
 for(const key of ['sizeMm','sourceOffsetM','positionMm'] as const){const v=m[key];if(!Array.isArray(v)||v.length!==3||v.some(n=>!Number.isFinite(n)||Math.abs(n)>1e7))throw new Error('3D 모델 좌표가 올바르지 않습니다.');}
 if(m.sizeMm.some(n=>n<0)||Math.max(...m.sizeMm)<=0)throw new Error('3D 모델 크기가 올바르지 않습니다.');
 const prefix='data:model/gltf-binary;base64,';
 if(typeof m.dataUrl!=='string'||!m.dataUrl.startsWith(prefix)||m.dataUrl.length>MODEL_MAX_BYTES*4/3+prefix.length+4||!/^[A-Za-z0-9+/]+={0,2}$/.test(m.dataUrl.slice(prefix.length)))throw new Error('3D 모델 파일 데이터가 올바르지 않습니다.');
 try{const bytes=Uint8Array.from(atob(m.dataUrl.slice(prefix.length)),c=>c.charCodeAt(0));inspectGlb(bytes.buffer);}catch(e){throw new Error(e instanceof Error?e.message:'3D 모델을 읽을 수 없습니다.');}
}
export function projectSpatialBounds(project:{walls:Array<Pick<Project['walls'][number],'start'|'end'|'heightMm'>>;importedFloor?:Project['importedFloor'];referenceModel?:ReferenceModel;modelArtworks?:Array<Pick<NonNullable<Project['modelArtworks']>[number],'widthMm'|'heightMm'|'depthMm'|'position'|'rotation'>&{visible?:boolean}>}){
 const points=[...project.walls.flatMap(w=>[w.start,w.end]),...(project.importedFloor?.flat()??[])];
 if(!points.length)points.push({x:-1000,z:-1000},{x:1000,z:1000});
 const m=project.referenceModel;
 let maxY=Math.max(0,...project.walls.map(w=>w.heightMm)),minY=0;
 if(m?.visible){
  const angle=m.rotationDeg*Math.PI/180,dx=m.sizeMm[0]*m.scale/2,dz=m.sizeMm[2]*m.scale/2;
  for(const x of [-dx,dx])for(const z of [-dz,dz])points.push({x:m.positionMm[0]+x*Math.cos(angle)+z*Math.sin(angle),z:m.positionMm[2]-x*Math.sin(angle)+z*Math.cos(angle)});
  maxY=Math.max(maxY,m.positionMm[1]+m.sizeMm[1]*m.scale);minY=Math.min(0,m.positionMm[1]);
 }
 for(const a of project.modelArtworks??[])if(a.visible!==false){const b=modelArtworkBounds(a);points.push({x:b.minX,z:b.minZ},{x:b.maxX,z:b.maxZ});minY=Math.min(minY,b.minY);maxY=Math.max(maxY,b.maxY);}
 return {minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minZ:Math.min(...points.map(p=>p.z)),maxZ:Math.max(...points.map(p=>p.z)),minY,maxY};
}
