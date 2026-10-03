import type {Project} from '../domain/types';
import {sceneProject} from '../domain/sceneProject';
import {createPublicShare,parsePublicShare,PUBLIC_SCENES_MAX,type PublicShareOptions,type PublicSceneSnapshot} from '../domain/publicShare';
import type {PublicModelCache} from './publicModelAsset';

/** Complete all Scene/asset validation before creating the remote draft. */
export async function prepareSharePresentation(project:Project,options:PublicShareOptions,camera?:PublicShareOptions['camera']){
 const selected=[...new Set(options.sceneIds??[])];
 if(selected.length>PUBLIC_SCENES_MAX)throw new Error(`공유 Scene은 ${PUBLIC_SCENES_MAX}개 이하로 선택하세요.`);
 const scenes=selected.map(id=>{const scene=project.scenes.find(s=>s.id===id);if(!scene)throw new Error('선택한 Scene을 찾지 못했습니다.');return scene;});
 const models=new Map<string,ArrayBuffer>(),modelCache:PublicModelCache=new Map(),images=new Map<string,string>(),uploads:Array<{imageId:string;sourceUrl:string}>=[];
 let total=0;
 async function prepare(p:Project,view?:PublicShareOptions['camera']):Promise<PublicSceneSnapshot>{
  const hasModels=p.referenceModel?.visible||p.modelArtworks?.some(a=>a.visible);
  const assets=hasModels?await (await import('./publicModelAsset')).preparePublicModels(p,modelCache):{ids:new Map<string,string>(),uploads:new Map<string,ArrayBuffer>(),referenceId:undefined};
  for(const [hash,bytes] of assets.uploads)if(!models.has(hash)){
   total+=bytes.byteLength;
   if(total>80*1024*1024||models.size>=51)throw new Error('전체 Scene의 공유 모델 자산은 80MiB·51개 이하여야 합니다.');
   models.set(hash,bytes);
  }
  const result=createPublicShare(p,{includeDimensions:options.includeDimensions,camera:view,modelAssetIds:assets.ids,referenceAssetId:assets.referenceId}),remap=new Map<string,string>();
  for(const upload of result.uploads){
   let imageId=images.get(upload.sourceUrl);
   if(imageId===undefined){imageId=String(uploads.length);images.set(upload.sourceUrl,imageId);uploads.push({imageId,sourceUrl:upload.sourceUrl});}
   remap.set(upload.imageId,imageId);
  }
  const snapshot=result.snapshot;
  for(const art of snapshot.artworks)art.imageId=remap.get(art.imageId)!;
  for(const material of [snapshot.floorMaterial,...snapshot.walls.map(w=>w.material)])if(material?.texture)material.texture.imageId=remap.get(material.texture.imageId)!;
  return snapshot;
 }
 const snapshot=await prepare(project,camera??options.camera);
 const publishedScenes=[];
 for(const scene of scenes)publishedScenes.push({id:scene.id,name:scene.name,snapshot:await prepare(sceneProject(project,scene),scene.cameraView)});
 return {snapshot:parsePublicShare({...snapshot,...(publishedScenes.length?{scenes:publishedScenes}:{})}),uploads,models};
}
