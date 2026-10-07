import {captureSurfaceReady} from './captureSurface';
import {projectorMapReady} from './projectorLighting';
import {floorWithOpenings} from '../domain/openings';
import type {Group,Object3D} from 'three';
import type {Project,ReferenceModel} from '../domain/types';
type ModelSource=Pick<ReferenceModel,'dataUrl'|'sizeMm'|'sourceOffsetM'>;
export interface LoadedCaptureModel {dataUrl:string;boundsKey:string;scene:Group|null;error:string}
export interface CaptureModelStatus {dataUrl:string;boundsKey:string;phase:'pending'|'ready'|'failed';error:string}
export const captureModelBoundsKey=(model:ModelSource)=>JSON.stringify([model.sizeMm,model.sourceOffsetM]);
/** Data URLs are compared by value without serializing megabytes on each render. */
export function captureModelMatches(model:ModelSource,loaded:LoadedCaptureModel){return loaded.dataUrl===model.dataUrl&&loaded.boundsKey===captureModelBoundsKey(model);}
export function captureModelStatus(model:ModelSource,loaded:LoadedCaptureModel):CaptureModelStatus{
 const matches=captureModelMatches(model,loaded);
 return {dataUrl:model.dataUrl,boundsKey:captureModelBoundsKey(model),phase:!matches?'pending':loaded.error?'failed':loaded.scene?'ready':'pending',error:matches?loaded.error:''};
}

/** Markers exist while models are loading or failed, as well as after success.
 * A coincidentally named mesh or a previous asset must never satisfy capture. */
export function captureAssetsReady(scene:Object3D,project:Project){return createCaptureAssetCheck(project)(scene);}
function createCaptureAssetCheck(project:Project){
 const floorIndices=project.floorMaterial?.texture||project.floorMaterial?.normal?floorWithOpenings(project).surfaces.map((_,index)=>index):[];
 return (scene:Object3D)=>{
 let ready=true;const visibleWalls=new Set(project.walls.filter(w=>w.visible).map(w=>w.id));
 for(const light of project.lights??[])if(!projectorMapReady(scene,light))ready=false;
 for(const art of project.artworks)if(art.visible&&art.imageUrl&&visibleWalls.has(art.wallId)){
  const object=scene.getObjectByName(`artwork-${art.id}`);
  if(object?.userData.artworkImageFailed)throw new Error('작품 이미지를 읽지 못해 캡처할 수 없습니다. 이미지를 다시 가져오세요.');
  if(object?.userData.artworkImageReady!==true)ready=false;
  if(!art.video&&!captureSurfaceReady(object?.getObjectByName('image'),undefined,art.material?.normal))ready=false;
 }
 for(const wall of project.walls)if(wall.visible&&!captureSurfaceReady(scene.getObjectByName(`capture-wall-${wall.id}`),wall.material?.texture,wall.material?.normal))ready=false;
 for(const index of floorIndices)if(!captureSurfaceReady(scene.getObjectByName(`capture-floor-${index}`),project.floorMaterial?.texture,project.floorMaterial?.normal))ready=false;
 const models=(project.modelArtworks??[]).filter(a=>a.visible).map(a=>({name:`capture-model-artwork-${a.id}`,model:a.model}));
 if(project.referenceModel?.visible)models.push({name:'capture-reference-model',model:project.referenceModel});
 for(const {name,model} of models){
  const status=scene.getObjectByName(name)?.userData.captureModel as CaptureModelStatus|undefined;
  if(!status||status.dataUrl!==model.dataUrl||status.boundsKey!==captureModelBoundsKey(model)){ready=false;continue;}
  if(status.phase==='failed')throw new Error(status.error||'3D 모델을 읽지 못해 캡처할 수 없습니다. 모델을 다시 가져오세요.');
  if(status.phase!=='ready')ready=false;
 }
 return ready;
 };
}

export async function waitForCaptureAssets(scene:Object3D,project:Project,invalidate:()=>void,assertCurrent:()=>void=()=>{}){
 const deadline=Date.now()+10000,check=createCaptureAssetCheck(project);
 while(true){
  assertCurrent();if(check(scene))return;
  if(Date.now()>=deadline)throw new Error('일부 작품 이미지·3D 모델·표면 재질·프로젝터 이미지가 아직 준비되지 않았습니다. 로딩 후 다시 캡처해 주세요.');
  invalidate();await new Promise<void>(resolve=>setTimeout(resolve,60));
 }
}
