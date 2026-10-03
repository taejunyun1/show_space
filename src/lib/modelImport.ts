import {Box3,Mesh,Texture,Vector3} from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {validateReferenceModel} from '../domain/referenceModel';
import {inspectGlb,MODEL_MAX_BYTES} from './glbPayload';
import type {ReferenceModel} from '../domain/types';
export async function readModelFile(file:File):Promise<ReferenceModel>{
 if(file.size>MODEL_MAX_BYTES)throw new Error('3D 모델은 12MB 이하로 선택해주세요.');
 const bytes=await file.arrayBuffer();inspectGlb(bytes);
 const gltf=await new GLTFLoader().parseAsync(bytes,'');
 try{
  const box=new Box3().setFromObject(gltf.scene),size=box.getSize(new Vector3()),center=box.getCenter(new Vector3());
  if(box.isEmpty()||![...size.toArray(),...center.toArray()].every(Number.isFinite))throw new Error('3D 모델에 표시할 형상이 없습니다.');
  const dataUrl=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).replace(/^data:[^;]*;/,'data:model/gltf-binary;'));reader.onerror=()=>reject(new Error('모델 파일을 읽지 못했습니다.'));reader.readAsDataURL(new Blob([bytes],{type:'model/gltf-binary'}));});
  const model:ReferenceModel={name:file.name.slice(0,200),dataUrl,visible:true,sizeMm:[size.x*1000,size.y*1000,size.z*1000],sourceOffsetM:[-center.x,-box.min.y,-center.z],positionMm:[0,0,0],rotationDeg:0,scale:1};
  validateReferenceModel(model);return model;
 }finally{gltf.scene.traverse(object=>{if(object instanceof Mesh){object.geometry.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];for(const material of materials){for(const value of Object.values(material))if(value instanceof Texture)value.dispose();material.dispose();}}});}
}

export async function readModelWalls(model:ReferenceModel){
 validateReferenceModel(model);
 const bytes=Uint8Array.from(atob(model.dataUrl.split(',')[1]),c=>c.charCodeAt(0));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer,'');
 try{const {extractModelWalls}=await import('./modelWalls');return extractModelWalls(gltf.scene,model);}
 finally{gltf.scene.traverse(object=>{if(object instanceof Mesh){object.geometry.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];for(const material of materials){for(const value of Object.values(material))if(value instanceof Texture)value.dispose();material.dispose();}}});}
}
