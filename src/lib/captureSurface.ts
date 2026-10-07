import {Mesh,type Object3D,type Texture} from 'three';
import type {SurfaceTexture} from '../domain/surfaceTexture';
import type {SurfaceNormal} from '../domain/surfaceNormal';
export interface CaptureSurfaceStatus {textureUrl:string;normalUrl:string;settingsKey:string;phase:'pending'|'ready'|'failed';error:string}
export function captureSurfaceIdentity(texture?:SurfaceTexture,normal?:SurfaceNormal){
 return {textureUrl:texture?.imageUrl??'',normalUrl:normal?.imageUrl??'',settingsKey:JSON.stringify([texture?[texture.widthMm,texture.heightMm]:null,normal?[normal.widthMm,normal.heightMm,normal.strength]:null])};
}
/** Readiness describes the requested source, never an old map retained by a hook. */
export function captureSurfaceStatus(texture:SurfaceTexture|undefined,normal:SurfaceNormal|undefined,loaded:{map?:Texture;failed?:boolean},loadedNormal:{map?:Texture;failed?:boolean}):CaptureSurfaceStatus{
 const error=normal&&loadedNormal.failed?'노멀 맵을 읽지 못해 캡처할 수 없습니다. 이미지를 다시 가져오세요.':texture&&loaded.failed?'표면 텍스처를 읽지 못해 캡처할 수 없습니다. 이미지를 다시 가져오세요.':'';
 return {...captureSurfaceIdentity(texture,normal),phase:error?'failed':(texture&&!loaded.map)||(normal&&!loadedNormal.map)?'pending':'ready',error};
}
export function captureSurfaceReady(object:Object3D|undefined,texture?:SurfaceTexture,normal?:SurfaceNormal){
 if(!texture&&!normal)return true;
 if(!(object instanceof Mesh))return false;
 const expected=captureSurfaceIdentity(texture,normal);let ready=true;
 for(const material of Array.isArray(object.material)?object.material:[object.material]){
  const status=material.userData.captureSurface as CaptureSurfaceStatus|undefined;
  if(!status||status.textureUrl!==expected.textureUrl||status.normalUrl!==expected.normalUrl||status.settingsKey!==expected.settingsKey){ready=false;continue;}
  if(status.phase==='failed')throw new Error(status.error||'표면 이미지를 읽지 못해 캡처할 수 없습니다.');
  const maps=material as typeof material&{map?:Texture|null;normalMap?:Texture|null};
  if(status.phase!=='ready'||(texture&&!maps.map)||(normal&&!maps.normalMap))ready=false;
 }
 return ready;
}
