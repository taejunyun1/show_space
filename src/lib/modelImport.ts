import {loadStaticModel} from './loadStaticModel';
import {validateReferenceModel} from '../domain/referenceModel';
import {inspectStaticArtworkGlb} from './artworkModelPayload';
import {MODEL_MAX_BYTES} from './glbPayload';
import {modelAssetBounds} from './modelArtworkGeometry';
import {disposeModelAsset} from './modelAssetResources';
import type {ReferenceModel} from '../domain/types';
export async function readModelFile(file:File):Promise<ReferenceModel>{
 if(file.size>MODEL_MAX_BYTES)throw new Error('3D 모델은 12MB 이하로 선택해주세요.');
 const bytes=await file.arrayBuffer();inspectStaticArtworkGlb(bytes);
 const gltf=await loadStaticModel(bytes);
 try{
  const bounds=modelAssetBounds(gltf.scene,true);
  const dataUrl=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).replace(/^data:[^;]*;/,'data:model/gltf-binary;'));reader.onerror=()=>reject(new Error('모델 파일을 읽지 못했습니다.'));reader.readAsDataURL(new Blob([bytes],{type:'model/gltf-binary'}));});
  const model:ReferenceModel={name:file.name.slice(0,200),dataUrl,visible:true,sizeMm:bounds.sizeMm,sourceOffsetM:bounds.sourceOffsetM,positionMm:[0,0,0],rotationDeg:0,scale:1};
  validateReferenceModel(model);return model;
 }finally{disposeModelAsset(gltf.scenes);}
}

export async function readModelWalls(model:ReferenceModel){
 validateReferenceModel(model);
 const bytes=Uint8Array.from(atob(model.dataUrl.split(',')[1]),c=>c.charCodeAt(0));
 const gltf=await loadStaticModel(bytes.buffer);
 try{const {extractModelWalls}=await import('./modelWalls');return extractModelWalls(gltf.scene,model);}
 finally{disposeModelAsset(gltf.scenes);}
}
