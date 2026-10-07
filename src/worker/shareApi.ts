import {VIDEO_MAX_BYTES} from '../domain/mediaArtwork';
import {PUBLIC_VIDEO_ASSETS_MAX,PUBLIC_VIDEOS_MAX_BYTES} from '../domain/publicVideo';
import {publicVideoBytes,publicVideoHash} from '../lib/publicVideoAsset';
import {MODEL_MAX_BYTES} from '../lib/glbPayload';
import {publicModelBytes,publicModelHash,PUBLIC_MODELS_MAX_BYTES,PUBLIC_MODEL_ASSETS_MAX} from '../lib/publicModelAsset';
import {parsePublicShare,publicModelIds,publicImageIds,publicVideoIds,PUBLIC_SNAPSHOT_MAX_BYTES,type PublicShareSnapshot} from '../domain/publicShare';
import {authenticatedUser,authConfig,type AuthEnv,type AuthFetch} from './auth';

export interface ShareBucket {
  put(key:string,value:string|ArrayBuffer|ReadableStream,options?:{httpMetadata?:{contentType?:string}}):Promise<unknown>;
  get(key:string,options?:{range:{offset:number;length:number}}):Promise<{body:ReadableStream;text():Promise<string>;size:number;httpMetadata?:{contentType?:string}}|null>;
  head(key:string):Promise<{size:number}|null>;
  list(options:{prefix:string;cursor?:string;limit?:number}):Promise<{objects:Array<{key:string}>;truncated:boolean;cursor?:string}>;
  delete(keys:string|string[]):Promise<unknown>;
}
export interface ShareEnv extends AuthEnv {SHARES:ShareBucket;OWNER_TOKEN?:string;ASSETS?:{fetch(request:Request):Promise<Response>}}
interface Meta {id:string;ownerId?:string;status:'draft'|'active'|'revoked';createdAt:string;name:string;includeDimensions:boolean;sceneCount?:number;includeArtworkDetails?:boolean}
const noStore={'cache-control':'no-store','x-content-type-options':'nosniff'};
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:noStore});
const error=(status:number,message:string)=>json({error:message},status);
const validImageId=(value:string)=>/^(0|[1-9][0-9]{0,3})$/.test(value);
const metaKey=(id:string)=>`meta/${id}.json`;
const ownerIndexKey=(ownerId:string,id:string)=>`owners/${ownerId}/${id}.json`;
const summary=({id,status,createdAt,name,includeDimensions,sceneCount,includeArtworkDetails}:Meta)=>({id,status,createdAt,name,includeDimensions,...(sceneCount!==undefined?{sceneCount}:{}),...(includeArtworkDetails!==undefined?{includeArtworkDetails}:{})});
const snapshotKey=(id:string)=>`shares/${id}/snapshot.json`;
const modelKey=(id:string,hash:string)=>`shares/${id}/models/${hash}.glb`;
const videoKey=(id:string,hash:string)=>`shares/${id}/videos/${hash}`;
const imageKey=(id:string,imageId:string)=>`shares/${id}/images/${imageId}`;

function ownerAuthorized(request:Request,token?:string){
  if(!token||token.length<20)return false;
  const supplied=request.headers.get('authorization')?.replace(/^Bearer /,'')??'';
  const a=new TextEncoder().encode(supplied),b=new TextEncoder().encode(token);
  let difference=a.length^b.length;
  for(let i=0;i<Math.max(a.length,b.length);i++)difference|=(a[i]??0)^(b[i]??0);
  return difference===0;
}

async function meta(bucket:ShareBucket,id:string):Promise<Meta|null>{const obj=await bucket.get(metaKey(id));return obj?JSON.parse(await obj.text()) as Meta:null;}
async function saveMeta(bucket:ShareBucket,value:Meta){await bucket.put(metaKey(value.id),JSON.stringify(value),{httpMetadata:{contentType:'application/json'}});}
async function readSnapshot(bucket:ShareBucket,id:string):Promise<PublicShareSnapshot|null>{const obj=await bucket.get(snapshotKey(id));return obj?parsePublicShare(JSON.parse(await obj.text())):null;}
function imageType(bytes:Uint8Array){
  if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((byte,i)=>bytes[i]===byte))return 'image/png';
  if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
  if(bytes.length>=12&&new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP')return 'image/webp';
  return null;
}
async function boundedJson(request:Request):Promise<unknown>{
  if(Number(request.headers.get('content-length'))>PUBLIC_SNAPSHOT_MAX_BYTES)throw new Error('공유 데이터가 너무 큽니다.');
  const reader=request.body?.getReader();if(!reader)throw new Error('공유 데이터가 없습니다.');
  const chunks:Uint8Array[]=[];let total=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>PUBLIC_SNAPSHOT_MAX_BYTES){await reader.cancel();throw new Error('공유 데이터가 너무 큽니다.');}chunks.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function handleShareRequest(request:Request,env:ShareEnv,authFetch:AuthFetch=fetch):Promise<Response>{
  const {pathname}=new URL(request.url),method=request.method;
  if(!pathname.startsWith('/api/'))return error(404,'주소를 찾을 수 없습니다.');
  const publicMatch=pathname.match(/^\/api\/public\/([0-9a-f]{48})(?:\/(images|models|videos)\/(\d{1,4}|[0-9a-f]{64}))?$/);
  if(publicMatch){
    if(method!=='GET')return error(405,'읽기 전용 링크입니다.');
    const [,id,assetKind,assetId]=publicMatch,entry=await meta(env.SHARES,id);
    if(!entry)return error(404,'공유 링크를 찾을 수 없습니다.');
    if(entry.status==='revoked')return error(410,'중단된 공유 링크입니다.');
    if(entry.status!=='active')return error(404,'공유 링크를 찾을 수 없습니다.');
    const snapshot=await readSnapshot(env.SHARES,id);
    if(!snapshot)return error(404,'공유 화면을 찾을 수 없습니다.');
    if(assetId===undefined)return json(snapshot);
    if(assetKind==='models'){if(!publicModelIds(snapshot).includes(assetId))return error(404,'3D 작품 모델을 찾을 수 없습니다.');const model=await env.SHARES.get(modelKey(id,assetId));if(!model)return error(404,'3D 작품 모델을 찾을 수 없습니다.');return new Response(model.body,{headers:{...noStore,'content-type':'model/gltf-binary'}});}
    if(assetKind==='videos'){
      if(!publicVideoIds(snapshot).includes(assetId))return error(404,'영상 작품을 찾을 수 없습니다.');
      const key=videoKey(id,assetId),info=await env.SHARES.head(key);if(!info||info.size<=0||info.size>VIDEO_MAX_BYTES)return error(404,'영상 작품을 찾을 수 없습니다.');
      const requested=request.headers.get('range');let range:{offset:number;length:number}|undefined;
      if(requested){
        const match=/^bytes=(\d*)-(\d*)$/.exec(requested);let start=0,end=info.size-1;
        if(match&&(match[1]||match[2])){if(match[1]){start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}else{const suffix=Number(match[2]);start=Math.max(0,info.size-suffix);if(suffix<=0)start=info.size;}}
        if(!match||!(match[1]||match[2])||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=info.size||start>end)return new Response(null,{status:416,headers:{...noStore,'content-range':`bytes */${info.size}`}});
        range={offset:start,length:end-start+1};
      }
      const video=await env.SHARES.get(key,range?{range}:undefined);if(!video||!['video/mp4','video/webm'].includes(video.httpMetadata?.contentType??''))return error(404,'영상 작품을 찾을 수 없습니다.');
      return new Response(video.body,{status:range?206:200,headers:{...noStore,'accept-ranges':'bytes','content-type':video.httpMetadata!.contentType!,'content-length':String(range?.length??info.size),...(range?{'content-range':`bytes ${range.offset}-${range.offset+range.length-1}/${info.size}`}:{})}});
    }
    const imageId=assetId;
    if(!validImageId(imageId)||!publicImageIds(snapshot).includes(imageId))return error(404,'작품 이미지를 찾을 수 없습니다.');
    const image=await env.SHARES.get(imageKey(id,imageId));
    if(!image)return error(404,'작품 이미지를 찾을 수 없습니다.');
    return new Response(image.body,{headers:{...noStore,'content-type':image.httpMetadata?.contentType??'application/octet-stream'}});
  }
  if(pathname.startsWith('/api/public/'))return error(404,'공유 링크를 찾을 수 없습니다.');
  if(request.headers.has('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return error(403,'같은 사이트에서 요청해주세요.');
  const legacy=ownerAuthorized(request,env.OWNER_TOKEN);let ownerId:string|undefined;
  if(!legacy){
    if(!authConfig(env)){if(!env.OWNER_TOKEN||env.OWNER_TOKEN.length<20)return error(503,'작성자 인증이 설정되지 않았습니다.');return error(401,'작성자 인증이 필요합니다.');}
    try{const user=await authenticatedUser(request,env,authFetch);if(!user)return error(401,'계정 로그인이 필요합니다.');ownerId=user.id;}catch{return error(503,'계정 인증을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.');}
  }
  const owns=(entry:Meta)=>legacy?entry.ownerId===undefined:entry.ownerId===ownerId;
  const target=/^\/api\/shares\/([0-9a-f]{48})(?:\/|$)/.exec(pathname);
  if(target){const entry=await meta(env.SHARES,target[1]);if(!entry||!owns(entry))return error(404,'공유 작업을 찾을 수 없습니다.');}
  if(pathname==='/api/shares'){
    if(method==='POST'){
      const id=[...crypto.getRandomValues(new Uint8Array(24))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
      const entry:Meta={id,...(ownerId?{ownerId}:{}),status:'draft',createdAt:new Date().toISOString(),name:'공유 준비 중',includeDimensions:false};
      try{await saveMeta(env.SHARES,entry);if(ownerId)await env.SHARES.put(ownerIndexKey(ownerId,id),id);}catch{try{await env.SHARES.delete([metaKey(id),...(ownerId?[ownerIndexKey(ownerId,id)]:[])]);}catch{/* An unreachable draft can be cleaned up later. */}return error(503,'공유 작업을 저장하지 못했습니다. 다시 시도해주세요.');}
      return json({id},201);
    }
    if(method==='GET'){
      const prefix=ownerId?`owners/${ownerId}/`:'meta/',listing=await env.SHARES.list({prefix,limit:1000});
      const ids=listing.objects.filter(o=>o.key.startsWith(prefix)&&/^[0-9a-f]{48}\.json$/.test(o.key.slice(prefix.length))).map(o=>o.key.slice(prefix.length,-5));
      const items=(await Promise.all(ids.map(id=>meta(env.SHARES,id)))).filter((entry):entry is Meta=>!!entry&&owns(entry)&&entry.status!=='draft').sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(summary);
      return json({items,truncated:listing.truncated});
    }
    return error(405,'지원하지 않는 요청입니다.');
  }
  const modelUpload=pathname.match(/^\/api\/shares\/([0-9a-f]{48})\/models\/([0-9a-f]{64})$/);
  if(modelUpload){
    if(method!=='PUT')return error(405,'지원하지 않는 요청입니다.');
    const [,id,hash]=modelUpload,entry=await meta(env.SHARES,id);if(!entry)return error(404,'공유 작업을 찾을 수 없습니다.');if(entry.status!=='draft')return error(409,'발행된 공유는 변경할 수 없습니다.');
    if(Number(request.headers.get('content-length'))>MODEL_MAX_BYTES)return error(413,'공유 3D 작품은 12MiB 이하여야 합니다.');
    let bytes:ArrayBuffer;
    try{const reader=request.body?.getReader();if(!reader)throw new Error('3D 작품 모델이 없습니다.');const chunks:Uint8Array[]=[];let length=0;try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>MODEL_MAX_BYTES){await reader.cancel();return error(413,'공유 3D 작품은 12MiB 이하여야 합니다.');}chunks.push(value);}}finally{reader.releaseLock();}const raw=new Uint8Array(length);let offset=0;for(const chunk of chunks){raw.set(chunk,offset);offset+=chunk.length;}bytes=publicModelBytes(raw.buffer);if(await publicModelHash(bytes)!==hash)throw new Error('공유 모델의 해시·공개 자산 데이터가 일치하지 않습니다.');}catch(e){return error(400,(e as Error).message);}
    const key=modelKey(id,hash);if(!(await env.SHARES.head(key))){const listing=await env.SHARES.list({prefix:`shares/${id}/models/`,limit:PUBLIC_MODEL_ASSETS_MAX+1});let total=bytes.byteLength;for(const item of listing.objects)total+=(await env.SHARES.head(item.key))?.size??0;if(listing.truncated||listing.objects.length>=PUBLIC_MODEL_ASSETS_MAX||total>PUBLIC_MODELS_MAX_BYTES)return error(413,'공유 모델 자산은 51개·총합 80MiB 이하여야 합니다.');await env.SHARES.put(key,bytes,{httpMetadata:{contentType:'model/gltf-binary'}});}
    return new Response(null,{status:204,headers:noStore});
  }
  const videoUpload=pathname.match(/^\/api\/shares\/([0-9a-f]{48})\/videos\/([0-9a-f]{64})$/);
  if(videoUpload){
    if(method!=='PUT')return error(405,'지원하지 않는 요청입니다.');
    const [,id,hash]=videoUpload,entry=await meta(env.SHARES,id);if(!entry)return error(404,'공유 작업을 찾을 수 없습니다.');if(entry.status!=='draft')return error(409,'발행된 공유는 변경할 수 없습니다.');
    const mime=request.headers.get('content-type')?.split(';')[0];if(mime!=='video/mp4'&&mime!=='video/webm')return error(415,'MP4·WebM 영상만 공유할 수 있습니다.');
    if(Number(request.headers.get('content-length'))>VIDEO_MAX_BYTES)return error(413,'공유 영상은 16MiB 이하여야 합니다.');
    let bytes:ArrayBuffer;
    try{const reader=request.body?.getReader();if(!reader)throw new Error('영상 원본이 없습니다.');const chunks:Uint8Array[]=[];let length=0;try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>VIDEO_MAX_BYTES){await reader.cancel();return error(413,'공유 영상은 16MiB 이하여야 합니다.');}chunks.push(value);}}finally{reader.releaseLock();}const raw=new Uint8Array(length);let offset=0;for(const c of chunks){raw.set(c,offset);offset+=c.length;}bytes=publicVideoBytes(raw.buffer,mime);if(await publicVideoHash(bytes)!==hash)throw new Error('공유 영상 원본의 해시가 일치하지 않습니다.');}catch(e){return error(400,(e as Error).message);}
    const key=videoKey(id,hash);if(!(await env.SHARES.head(key))){const listing=await env.SHARES.list({prefix:`shares/${id}/videos/`,limit:PUBLIC_VIDEO_ASSETS_MAX+1});let total=bytes.byteLength;for(const item of listing.objects)total+=(await env.SHARES.head(item.key))?.size??0;if(listing.truncated||listing.objects.length>=PUBLIC_VIDEO_ASSETS_MAX||total>PUBLIC_VIDEOS_MAX_BYTES)return error(413,'공유 영상 자산은 20개·총합 80MiB 이하여야 합니다.');await env.SHARES.put(key,bytes,{httpMetadata:{contentType:mime}});}
    return new Response(null,{status:204,headers:noStore});
  }
  const imageUpload=pathname.match(/^\/api\/shares\/([0-9a-f]{48})\/images\/(\d{1,4})$/);
  if(imageUpload){
    if(method!=='PUT')return error(405,'지원하지 않는 요청입니다.');
    const [,id,imageId]=imageUpload,entry=await meta(env.SHARES,id);
    if(!entry)return error(404,'공유 작업을 찾을 수 없습니다.');
    if(entry.status!=='draft')return error(409,'발행된 공유는 변경할 수 없습니다.');
    if(!validImageId(imageId))return error(400,'이미지 번호가 올바르지 않습니다.');
    if(Number(request.headers.get('content-length'))>5_000_000)return error(413,'작품 이미지는 5MB 이하만 공유할 수 있습니다.');
    let bytes:ArrayBuffer;
    try{
      const reader=request.body?.getReader();if(!reader)return error(413,'작품 이미지는 5MB 이하만 공유할 수 있습니다.');
      const chunks:Uint8Array[]=[];let length=0;
      try{
        while(true){
          const {done,value}=await reader.read();if(done)break;
          length+=value.byteLength;
          if(length>5_000_000){try{await reader.cancel();}catch{/* The size rejection still applies if the sender has disconnected. */}return error(413,'작품 이미지는 5MB 이하만 공유할 수 있습니다.');}
          chunks.push(value);
        }
      }finally{reader.releaseLock();}
      const raw=new Uint8Array(length);let offset=0;for(const chunk of chunks){raw.set(chunk,offset);offset+=chunk.byteLength;}bytes=raw.buffer;
    }catch{return error(400,'이미지 전송이 중단됐습니다. 다시 시도해주세요.');}
    if(!bytes.byteLength||bytes.byteLength>5_000_000)return error(413,'작품 이미지는 5MB 이하만 공유할 수 있습니다.');
    const type=imageType(new Uint8Array(bytes));
    if(!type)return error(415,'PNG, JPG, WebP 작품 이미지만 공유할 수 있습니다.');
    await env.SHARES.put(imageKey(id,imageId),bytes,{httpMetadata:{contentType:type}});
    return new Response(null,{status:204,headers:noStore});
  }
  const publish=pathname.match(/^\/api\/shares\/([0-9a-f]{48})\/publish$/);
  if(publish){
    if(method!=='POST')return error(405,'지원하지 않는 요청입니다.');
    const id=publish[1],entry=await meta(env.SHARES,id);
    if(!entry)return error(404,'공유 작업을 찾을 수 없습니다.');
    if(entry.status!=='draft')return error(409,'발행된 공유는 변경할 수 없습니다.');
    let snapshot:PublicShareSnapshot;
    try{snapshot=parsePublicShare(await boundedJson(request));}catch(e){return error(400,(e as Error).message);}
    let modelBytes=0;for(const hash of publicModelIds(snapshot)){const model=await env.SHARES.head(modelKey(id,hash));if(!model)return error(409,'3D 작품 모델 업로드가 완료되지 않았습니다.');modelBytes+=model.size;}if(modelBytes>PUBLIC_MODELS_MAX_BYTES)return error(413,'공유 모델 자산 총합은 80MiB 이하여야 합니다.');
    let videoBytes=0;for(const hash of publicVideoIds(snapshot)){const video=await env.SHARES.head(videoKey(id,hash));if(!video)return error(409,'영상 원본 업로드가 완료되지 않았습니다.');if(video.size>VIDEO_MAX_BYTES)return error(413,'공유 영상은 16MiB 이하여야 합니다.');videoBytes+=video.size;}if(videoBytes>PUBLIC_VIDEOS_MAX_BYTES)return error(413,'공유 영상 자산 총합은 80MiB 이하여야 합니다.');
    for(const imageId of publicImageIds(snapshot))if(!(await env.SHARES.head(imageKey(id,imageId))))return error(409,'작품/표면 이미지 업로드가 완료되지 않았습니다.');
    await env.SHARES.put(snapshotKey(id),JSON.stringify(snapshot),{httpMetadata:{contentType:'application/json'}});
    await saveMeta(env.SHARES,{...entry,status:'active',name:snapshot.name,includeDimensions:!!snapshot.dimensions,sceneCount:snapshot.scenes?.length??0,includeArtworkDetails:!!snapshot.includeArtworkDetails});
    return json({id},201);
  }
  const share=pathname.match(/^\/api\/shares\/([0-9a-f]{48})$/);
  if(share){
    if(method!=='DELETE')return error(405,'지원하지 않는 요청입니다.');
    const id=share[1],entry=await meta(env.SHARES,id);
    if(!entry)return error(404,'공유 작업을 찾을 수 없습니다.');
    // Mark revoked before removing data; repeat DELETE can finish an interrupted cleanup.
    if(entry.status!=='draft'&&entry.status!=='revoked')await saveMeta(env.SHARES,{...entry,status:'revoked'});
    while(true){
      const listing=await env.SHARES.list({prefix:`shares/${id}/`,limit:1000});
      if(!listing.objects.length)break;
      await env.SHARES.delete(listing.objects.map(object=>object.key));
      if(!listing.truncated)break;
    }
    if(entry.status==='draft')await env.SHARES.delete([metaKey(id),...(entry.ownerId?[ownerIndexKey(entry.ownerId,id)]:[])]);
    return new Response(null,{status:204,headers:noStore});
  }
  return error(404,'주소를 찾을 수 없습니다.');
}
