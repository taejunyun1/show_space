import type {Project} from '../domain/types';
import {createPublicShare,type PublicShareOptions} from '../domain/publicShare';
export type ShareFetch=(input:string,init?:RequestInit)=>Promise<Response>;
const auth=(ownerToken:string)=>({authorization:`Bearer ${ownerToken}`});
async function checked(response:Response){if(response.ok)return response;let message=`요청에 실패했습니다 (${response.status}).`;try{const body=await response.json() as {error?:string};if(body.error)message=body.error;}catch{/* Non-JSON errors still carry the status. */}throw new Error(message);}

export async function publishPublicShare(project:Project,options:PublicShareOptions,ownerToken:string,camera?:PublicShareOptions['camera'],fetcher:ShareFetch=fetch,origin=location.origin):Promise<string>{
  if(project.referenceModel?.visible)throw new Error('3D 참고 모델이 보이는 배치는 아직 링크 공유를 지원하지 않습니다. 모델을 숨기거나 JSON·PNG로 전달해주세요.');
  const models=project.modelArtworks?.some(a=>a.visible)?await (await import('./publicModelAsset')).preparePublicModels(project):{ids:new Map<string,string>(),uploads:new Map<string,ArrayBuffer>()};
  const {snapshot,uploads}=createPublicShare(project,{...options,camera,modelAssetIds:models.ids});
  const created=await checked(await fetcher('/api/shares',{method:'POST',headers:auth(ownerToken)}));
  const {id}=await created.json() as {id:string};
  if(!/^[0-9a-f]{48}$/.test(id))throw new Error('공유 링크 응답이 올바르지 않습니다.');
  try{
    for(const upload of uploads){
      const source=await checked(await fetcher(upload.sourceUrl));
      const image=await source.blob();
      if(image.size>5_000_000)throw new Error('공유할 이미지는 각 5MB 이하로 줄여 주세요.');
      await checked(await fetcher(`/api/shares/${id}/images/${upload.imageId}`,{method:'PUT',headers:auth(ownerToken),body:image}));
    }
    for(const [hash,bytes] of models.uploads)await checked(await fetcher(`/api/shares/${id}/models/${hash}`,{method:'PUT',headers:{...auth(ownerToken),'content-type':'model/gltf-binary'},body:bytes}));
    await checked(await fetcher(`/api/shares/${id}/publish`,{method:'POST',headers:{...auth(ownerToken),'content-type':'application/json'},body:JSON.stringify(snapshot)}));
    return `${origin}/s/${id}`;
  }catch(error){
    try{await fetcher(`/api/shares/${id}`,{method:'DELETE',headers:auth(ownerToken)});}catch{/* A draft can be cleaned up later. */}
    throw error;
  }
}

export interface ShareListItem {id:string;status:'active'|'revoked';createdAt:string;name:string;includeDimensions:boolean}
export async function listPublicShares(ownerToken:string,fetcher:ShareFetch=fetch):Promise<ShareListItem[]>{
  const response=await checked(await fetcher('/api/shares',{headers:auth(ownerToken)}));
  const body=await response.json() as {items:ShareListItem[]};
  return body.items;
}
export async function revokePublicShare(id:string,ownerToken:string,fetcher:ShareFetch=fetch):Promise<void>{
  await checked(await fetcher(`/api/shares/${id}`,{method:'DELETE',headers:auth(ownerToken)}));
}
