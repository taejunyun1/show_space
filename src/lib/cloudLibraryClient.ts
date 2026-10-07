import {uuidPattern} from '../domain/cloudProject';
import {encodeLibraryMetadata,parseLibrarySummary,CLOUD_LIBRARY_LIMITS,type LibraryKind,type CloudLibraryMetadata,type CloudLibrarySummary} from '../domain/cloudLibrary';
import {CloudProjectError,cloudPackageHash,type CloudFetch} from './cloudProjectClient';
const base=(kind:LibraryKind)=>{if(!['artwork','material'].includes(kind))throw new Error('라이브러리 종류가 올바르지 않습니다.');return '/api/libraries/'+kind;};
const path=(kind:LibraryKind,id:string)=>{if(!uuidPattern.test(id))throw new Error('계정 항목 ID가 올바르지 않습니다.');return base(kind)+'/'+id;};
async function checked(r:Response){if(r.ok)return r;let message=`계정 라이브러리 요청 실패 (${r.status})`;try{const v=await r.json();if(typeof v.error==='string')message=v.error;}catch{/* Preserve status. */}throw new CloudProjectError(message,r.status);}
export function createCloudLibraryClient(token:string,fetcher:CloudFetch=fetch,signal?:AbortSignal){
 if(!token||token.length>8192)throw new Error('계정 로그인이 필요합니다.');const call=(p:string,init:RequestInit={})=>fetcher(p,{...init,signal,headers:{...init.headers,authorization:'Bearer '+token}});
 const parse=async(r:Response,kind:LibraryKind,id:string)=>{const s=parseLibrarySummary(await (await checked(r)).json());if(s.kind!==kind||s.id!==id)throw new Error('다른 계정 항목이 반환됐습니다.');return s;};
 const metadata=(kind:LibraryKind,id:string)=>call(path(kind,id)+'/meta').then(r=>parse(r,kind,id));
 return {
  metadata,
  async list(kind:LibraryKind){const r=await (await checked(await call(base(kind)))).json();if(!Array.isArray(r.items)||r.items.length>CLOUD_LIBRARY_LIMITS[kind].items||r.truncated)throw new Error('계정 항목을 모두 읽지 못했습니다.');return (r.items as unknown[]).map(v=>{const s=parseLibrarySummary(v);if(s.kind!==kind)throw new Error('다른 라이브러리 항목입니다.');return s;});},
  async save(kind:LibraryKind,id:string,expectedRevision:number,blob:Blob,meta:CloudLibraryMetadata):Promise<CloudLibrarySummary>{
   if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0||expectedRevision>=Number.MAX_SAFE_INTEGER||blob.size<2||blob.size>CLOUD_LIBRARY_LIMITS[kind].bytes)throw new Error('저장 버전 또는 파일 용량이 올바르지 않습니다.');const sha=await cloudPackageHash(await blob.arrayBuffer());
   const matches=(s:CloudLibrarySummary)=>s.revision===expectedRevision+1&&s.sha256===sha&&s.bytes===blob.size&&s.sourceItemId===meta.sourceItemId&&s.name===meta.name&&s.detail===meta.detail&&s.archived===meta.archived;
   try{const s=await parse(await call(path(kind,id),{method:'PUT',headers:{'content-type':'application/json','x-expected-revision':String(expectedRevision),'x-library-sha256':sha,'x-library-metadata':encodeLibraryMetadata(meta)},body:blob}),kind,id);if(!matches(s))throw new CloudProjectError('저장 중 다른 기기에서 항목을 변경했습니다.',409);return s;}
   catch(e){if(signal?.aborted||e instanceof CloudProjectError&&e.status<500)throw e;try{const latest=await metadata(kind,id);if(matches(latest))return latest;}catch{/* Uncertain failure does not acknowledge a revision. */}throw e;}
  },
  async read(kind:LibraryKind,id:string){
   const summary=await metadata(kind,id),r=await checked(await call(path(kind,id)));if(r.headers.get('x-library-sha256')!==summary.sha256||Number(r.headers.get('x-library-revision'))!==summary.revision)throw new CloudProjectError('다른 기기에서 항목을 변경했습니다. 다시 가져오세요.',409);
   const reader=r.body?.getReader();if(!reader)throw new Error('라이브러리 파일을 읽지 못했습니다.');let size=0;const chunks:Uint8Array[]=[];
   try{while(true){const p=await reader.read();if(p.done)break;size+=p.value.length;if(size>summary.bytes||size>CLOUD_LIBRARY_LIMITS[kind].bytes){await reader.cancel();throw new Error('라이브러리 파일 용량이 올바르지 않습니다.');}chunks.push(p.value);}}finally{reader.releaseLock();}
   const b=new Uint8Array(size);let offset=0;for(const p of chunks){b.set(p,offset);offset+=p.length;}if(size!==summary.bytes||await cloudPackageHash(b.buffer)!==summary.sha256)throw new Error('라이브러리 자산 해시·크기가 일치하지 않습니다.');return {bytes:b.buffer,summary};
  },
  async archive(kind:LibraryKind,id:string,expectedRevision:number,archived:boolean){return parse(await call(path(kind,id),{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({expectedRevision,archived})}),kind,id);},
 };
}
