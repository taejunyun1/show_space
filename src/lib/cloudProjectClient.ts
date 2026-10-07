import {CLOUD_PACKAGE_MAX_BYTES,encodeCloudMetadata,parseCloudSummary,uuidPattern,type CloudProjectMetadata,type CloudProjectSummary} from '../domain/cloudProject';
export class CloudProjectError extends Error {constructor(message:string,public status:number){super(message);}}
export type CloudFetch=(input:string,init?:RequestInit)=>Promise<Response>;
async function checked(response:Response){if(response.ok)return response;let message=`클라우드 요청에 실패했습니다 (${response.status}).`;try{const raw=await response.json() as {error?:unknown};if(typeof raw.error==='string')message=raw.error;}catch{/* Keep the status on non-JSON responses. */}throw new CloudProjectError(message,response.status);}
export async function cloudPackageHash(bytes:ArrayBuffer){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
const projectPath=(id:string)=>{if(!uuidPattern.test(id))throw new Error('클라우드 프로젝트 ID가 올바르지 않습니다.');return `/api/projects/${id}`;};
export function createCloudProjectClient(token:string,fetcher:CloudFetch=fetch,signal?:AbortSignal){
 if(!token||token.length>8192)throw new Error('계정 로그인이 필요합니다.');
 const call=(path:string,init:RequestInit={})=>fetcher(path,{...init,signal,headers:{...init.headers,authorization:`Bearer ${token}`}});
 const metadata=async(id:string)=>{const record=parseCloudSummary(await (await checked(await call(projectPath(id)+'/meta'))).json());if(record.id!==id)throw new Error('클라우드 프로젝트 ID가 일치하지 않습니다.');return record;};
 return {
  metadata,
  async list():Promise<CloudProjectSummary[]>{const value=await (await checked(await call('/api/projects'))).json() as {items?:unknown;truncated?:boolean};if(!Array.isArray(value.items)||value.items.length>200||value.truncated)throw new Error('클라우드 프로젝트 목록을 모두 읽지 못했습니다.');return value.items.map(parseCloudSummary);},
  async listShared():Promise<CloudProjectSummary[]>{const value=await (await checked(await call('/api/projects/shared'))).json() as {items?:unknown;truncated?:boolean};if(!Array.isArray(value.items)||value.items.length>200||value.truncated)throw new Error('공동 프로젝트 목록을 모두 읽지 못했습니다.');return value.items.map(parseCloudSummary);},
  async save(id:string,expectedRevision:number,file:Blob,meta:CloudProjectMetadata):Promise<CloudProjectSummary>{
   if(file.size<22||file.size>CLOUD_PACKAGE_MAX_BYTES)throw new Error('클라우드 프로젝트 파일은 80MiB 이하여야 합니다.');const path=projectPath(id),hash=await cloudPackageHash(await file.arrayBuffer());
   const matches=(r:CloudProjectSummary)=>r.id===id&&r.revision===expectedRevision+1&&r.sha256===hash&&r.bytes===file.size&&r.sourceProjectId===meta.sourceProjectId&&r.name===meta.name&&r.venue===meta.venue&&!r.archived;
   try{const saved=parseCloudSummary(await (await checked(await call(path,{method:'PUT',headers:{'content-type':'application/zip','x-expected-revision':String(expectedRevision),'x-project-sha256':hash,'x-project-metadata':encodeCloudMetadata(meta)},body:file}))).json());if(!matches(saved))throw new CloudProjectError('저장 중 다른 기기에서 프로젝트를 변경했습니다. 복사본을 보존해주세요.',409);return saved;}
   catch(error){if(signal?.aborted)throw error;if(error instanceof CloudProjectError&&error.status<500)throw error;try{const latest=await metadata(id);if(matches(latest))return latest;}catch{/* An uncertain failure must not advance the saved revision. */}throw error;}
  },
  async read(id:string):Promise<{bytes:ArrayBuffer;summary:CloudProjectSummary}>{
   const record=await metadata(id),response=await checked(await call(projectPath(id))),revision=Number(response.headers.get('x-project-revision')),hash=response.headers.get('x-project-sha256');
   if(revision!==record.revision||hash!==record.sha256)throw new CloudProjectError('다른 기기에서 저장 중입니다. 다시 열어주세요.',409);
   const reader=response.body?.getReader();if(!reader)throw new Error('클라우드 파일을 읽지 못했습니다.');const chunks:Uint8Array[]=[];let size=0;
   try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>CLOUD_PACKAGE_MAX_BYTES||size>record.bytes){await reader.cancel();throw new Error('클라우드 파일 크기가 올바르지 않습니다.');}chunks.push(part.value);}}finally{reader.releaseLock();}
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}if(size!==record.bytes||await cloudPackageHash(bytes.buffer)!==hash)throw new Error('클라우드 파일 해시·크기가 일치하지 않습니다.');return {bytes:bytes.buffer,summary:record};
  },
  async archive(id:string,expectedRevision:number,archived:boolean){return parseCloudSummary(await (await checked(await call(projectPath(id),{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({expectedRevision,archived})}))).json());},
 };
}
