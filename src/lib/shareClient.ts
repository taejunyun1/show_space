import type {Project} from '../domain/types';
import type {PublicShareOptions} from '../domain/publicShare';
import {prepareSharePresentation} from './sharePresentation';
export type ShareFetch=(input:string,init?:RequestInit)=>Promise<Response>;
const auth=(ownerToken:string)=>({authorization:`Bearer ${ownerToken}`});
async function checked(response:Response){if(response.ok)return response;let message=`요청에 실패했습니다 (${response.status}).`;try{const body=await response.json() as {error?:string};if(body.error)message=body.error;}catch{/* Non-JSON errors still carry the status. */}throw new Error(message);}

export async function publishPublicShare(project:Project,options:PublicShareOptions&{allowComments?:boolean},ownerToken:string,camera?:PublicShareOptions['camera'],fetcher:ShareFetch=fetch,origin=location.origin,signal?:AbortSignal):Promise<string>{
  signal?.throwIfAborted();
  const {snapshot,uploads,models,videos}=await prepareSharePresentation(project,options,camera);
  signal?.throwIfAborted();
  // Let each mutation settle before cleanup. Aborting its HTTP response could
  // race a still-running server write against DELETE and strand public assets.
  const created=await checked(await fetcher('/api/shares',{method:'POST',headers:auth(ownerToken)}));
  const {id}=await created.json() as {id:string};
  if(!/^[0-9a-f]{48}$/.test(id))throw new Error('공유 링크 응답이 올바르지 않습니다.');
  try{
    signal?.throwIfAborted();
    for(const upload of uploads){
      const source=await checked(await fetcher(upload.sourceUrl,{signal}));
      const image=await source.blob();
      if(image.size>5_000_000)throw new Error('공유할 이미지는 각 5MB 이하로 줄여 주세요.');
      signal?.throwIfAborted();
      await checked(await fetcher(`/api/shares/${id}/images/${upload.imageId}`,{method:'PUT',headers:auth(ownerToken),body:image}));
      signal?.throwIfAborted();
    }
    for(const [hash,bytes] of models){signal?.throwIfAborted();await checked(await fetcher(`/api/shares/${id}/models/${hash}`,{method:'PUT',headers:{...auth(ownerToken),'content-type':'model/gltf-binary'},body:bytes}));signal?.throwIfAborted();}
    for(const [hash,asset] of videos){signal?.throwIfAborted();await checked(await fetcher(`/api/shares/${id}/videos/${hash}`,{method:'PUT',headers:{...auth(ownerToken),'content-type':asset.mime},body:asset.bytes}));signal?.throwIfAborted();}
    signal?.throwIfAborted();
    await checked(await fetcher(`/api/shares/${id}/publish`,{method:'POST',headers:{...auth(ownerToken),'content-type':'application/json',...(options.allowComments?{'x-review-comments':'true'}:{})},body:JSON.stringify(snapshot)}));
    signal?.throwIfAborted();
    return `${origin}/s/${id}`;
  }catch(error){
    try{await fetcher(`/api/shares/${id}`,{method:'DELETE',headers:auth(ownerToken)});}catch{/* A draft can be cleaned up later. */}
    throw error;
  }
}

export interface ShareListItem {id:string;status:'active'|'revoked';createdAt:string;name:string;includeDimensions:boolean;sceneCount?:number;includeArtworkDetails?:boolean;commentsEnabled?:boolean}
export async function listPublicShares(ownerToken:string,fetcher:ShareFetch=fetch,signal?:AbortSignal):Promise<ShareListItem[]>{
  signal?.throwIfAborted();
  const response=await checked(await fetcher('/api/shares',{headers:auth(ownerToken),signal}));
  const body=await response.json() as {items:ShareListItem[]};
  signal?.throwIfAborted();
  return body.items;
}
export async function revokePublicShare(id:string,ownerToken:string,fetcher:ShareFetch=fetch):Promise<void>{
  await checked(await fetcher(`/api/shares/${id}`,{method:'DELETE',headers:auth(ownerToken)}));
}
