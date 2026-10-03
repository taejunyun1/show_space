import {MODEL_MAX_BYTES} from '../lib/glbPayload';
import {publicModelBytes,publicModelHash,PUBLIC_MODELS_MAX_BYTES,PUBLIC_MODEL_ASSETS_MAX} from '../lib/publicModelAsset';
import {parsePublicShare,publicModelIds,publicImageIds,type PublicShareSnapshot} from '../domain/publicShare';

export interface ShareBucket {
  put(key:string,value:string|ArrayBuffer|ReadableStream,options?:{httpMetadata?:{contentType?:string}}):Promise<unknown>;
  get(key:string):Promise<{body:ReadableStream;text():Promise<string>;size:number;httpMetadata?:{contentType?:string}}|null>;
  head(key:string):Promise<{size:number}|null>;
  list(options:{prefix:string;cursor?:string;limit?:number}):Promise<{objects:Array<{key:string}>;truncated:boolean;cursor?:string}>;
  delete(keys:string|string[]):Promise<unknown>;
}
export interface ShareEnv {SHARES:ShareBucket;OWNER_TOKEN?:string;ASSETS?:{fetch(request:Request):Promise<Response>}}
interface Meta {id:string;status:'draft'|'active'|'revoked';createdAt:string;name:string;includeDimensions:boolean}
const noStore={'cache-control':'no-store','x-content-type-options':'nosniff'};
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:noStore});
const error=(status:number,message:string)=>json({error:message},status);
const validImageId=(value:string)=>/^(0|[1-9][0-9]{0,3})$/.test(value);
const metaKey=(id:string)=>`meta/${id}.json`;
const snapshotKey=(id:string)=>`shares/${id}/snapshot.json`;
const modelKey=(id:string,hash:string)=>`shares/${id}/models/${hash}.glb`;
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
  if(Number(request.headers.get('content-length'))>1_000_000)throw new Error('공유 데이터가 너무 큽니다.');
  const bytes=await request.arrayBuffer();
  if(bytes.byteLength>1_000_000)throw new Error('공유 데이터가 너무 큽니다.');
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function handleShareRequest(request:Request,env:ShareEnv):Promise<Response>{
  const {pathname}=new URL(request.url),method=request.method;
  if(!pathname.startsWith('/api/'))return error(404,'주소를 찾을 수 없습니다.');
  const publicMatch=pathname.match(/^\/api\/public\/([0-9a-f]{48})(?:\/(images|models)\/(\d{1,4}|[0-9a-f]{64}))?$/);
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
    const imageId=assetId;
    if(!validImageId(imageId)||!publicImageIds(snapshot).includes(imageId))return error(404,'작품 이미지를 찾을 수 없습니다.');
    const image=await env.SHARES.get(imageKey(id,imageId));
    if(!image)return error(404,'작품 이미지를 찾을 수 없습니다.');
    return new Response(image.body,{headers:{...noStore,'content-type':image.httpMetadata?.contentType??'application/octet-stream'}});
  }
  if(pathname.startsWith('/api/public/'))return error(404,'공유 링크를 찾을 수 없습니다.');
  if(!env.OWNER_TOKEN||env.OWNER_TOKEN.length<20)return error(503,'작성자 인증이 설정되지 않았습니다.');
  if(!ownerAuthorized(request,env.OWNER_TOKEN))return error(401,'작성자 인증이 필요합니다.');
  if(pathname==='/api/shares'){
    if(method==='POST'){
      const id=[...crypto.getRandomValues(new Uint8Array(24))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
      const entry:Meta={id,status:'draft',createdAt:new Date().toISOString(),name:'공유 준비 중',includeDimensions:false};
      await saveMeta(env.SHARES,entry);
      return json({id},201);
    }
    if(method==='GET'){
      const listing=await env.SHARES.list({prefix:'meta/',limit:1000});
      const items=(await Promise.all(listing.objects.filter(object=>/^meta\/[0-9a-f]{48}\.json$/.test(object.key)).map(object=>env.SHARES.get(object.key).then(async entry=>entry?JSON.parse(await entry.text()) as Meta:null)))).filter((entry):entry is Meta=>!!entry&&entry.status!=='draft').sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
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
  const imageUpload=pathname.match(/^\/api\/shares\/([0-9a-f]{48})\/images\/(\d{1,4})$/);
  if(imageUpload){
    if(method!=='PUT')return error(405,'지원하지 않는 요청입니다.');
    const [,id,imageId]=imageUpload,entry=await meta(env.SHARES,id);
    if(!entry)return error(404,'공유 작업을 찾을 수 없습니다.');
    if(entry.status!=='draft')return error(409,'발행된 공유는 변경할 수 없습니다.');
    if(!validImageId(imageId))return error(400,'이미지 번호가 올바르지 않습니다.');
    if(Number(request.headers.get('content-length'))>5_000_000)return error(413,'작품 이미지는 5MB 이하만 공유할 수 있습니다.');
    const bytes=await request.arrayBuffer();
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
    for(const imageId of publicImageIds(snapshot))if(!(await env.SHARES.head(imageKey(id,imageId))))return error(409,'작품/표면 이미지 업로드가 완료되지 않았습니다.');
    await env.SHARES.put(snapshotKey(id),JSON.stringify(snapshot),{httpMetadata:{contentType:'application/json'}});
    await saveMeta(env.SHARES,{...entry,status:'active',name:snapshot.name,includeDimensions:!!snapshot.dimensions});
    return json({id},201);
  }
  const share=pathname.match(/^\/api\/shares\/([0-9a-f]{48})$/);
  if(share){
    if(method!=='DELETE')return error(405,'지원하지 않는 요청입니다.');
    const id=share[1],entry=await meta(env.SHARES,id);
    if(!entry)return error(404,'공유 작업을 찾을 수 없습니다.');
    if(entry.status==='revoked')return new Response(null,{status:204,headers:noStore});
    if(entry.status==='draft'){
      const listing=await env.SHARES.list({prefix:`shares/${id}/`,limit:1000});
      await env.SHARES.delete([...listing.objects.map(object=>object.key),metaKey(id)]);
    }else{
      await saveMeta(env.SHARES,{...entry,status:'revoked'});
      const listing=await env.SHARES.list({prefix:`shares/${id}/`,limit:1000});
      if(listing.objects.length)await env.SHARES.delete(listing.objects.map(object=>object.key));
    }
    return new Response(null,{status:204,headers:noStore});
  }
  return error(404,'주소를 찾을 수 없습니다.');
}
