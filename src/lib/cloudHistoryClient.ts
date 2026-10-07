import {CLOUD_PACKAGE_MAX_BYTES,uuidPattern} from '../domain/cloudProject';
import {parseCloudHistorySummary,type CloudHistorySummary} from '../domain/cloudHistory';
import {CloudProjectError,cloudPackageHash,type CloudFetch} from './cloudProjectClient';
const projectPath=(id:string)=>{if(!uuidPattern.test(id))throw new Error('프로젝트 ID가 올바르지 않습니다.');return `/api/projects/${id}/history`;};
const pointPath=(projectId:string,id:string)=>{if(!uuidPattern.test(id))throw new Error('복원 지점 ID가 올바르지 않습니다.');return projectPath(projectId)+'/'+id;};
async function checked(r:Response){if(r.ok)return r;let message=`클라우드 버전 요청 실패 (${r.status})`;try{const raw=await r.json();if(typeof raw.error==='string')message=raw.error;}catch{/* Preserve non-JSON status. */}throw new CloudProjectError(message,r.status);}
export function createCloudHistoryClient(token:string,fetcher:CloudFetch=fetch,signal?:AbortSignal){
 if(!token||token.length>8192)throw new Error('계정 로그인이 필요합니다.');
 const call=(path:string,init:RequestInit={})=>fetcher(path,{...init,signal,headers:{...init.headers,authorization:`Bearer ${token}`}});
 const parse=async(response:Response,projectId:string,id:string)=>{const p=parseCloudHistorySummary(await (await checked(response)).json());if(p.projectId!==projectId||p.id!==id)throw new Error('클라우드 복원 지점 ID가 일치하지 않습니다.');return p;};
 const metadata=(projectId:string,id:string)=>call(pointPath(projectId,id)+'/meta').then(r=>parse(r,projectId,id));
 return {
  metadata,
  async list(projectId:string){const raw=await (await checked(await call(projectPath(projectId)))).json();if(!Array.isArray(raw.items)||raw.items.length>50||raw.truncated)throw new Error('버전 목록을 모두 읽지 못했습니다.');return (raw.items as unknown[]).map(value=>{const p=parseCloudHistorySummary(value);if(p.projectId!==projectId)throw new Error('다른 프로젝트의 버전입니다.');return p;});},
  async capture(projectId:string,id:string,label:string,expectedRevision:number):Promise<CloudHistorySummary>{
   pointPath(projectId,id);if(!label.trim()||label.trim().length>200||!Number.isSafeInteger(expectedRevision)||expectedRevision<1)throw new Error('복원 지점 이름과 클라우드 저장 버전이 필요합니다.');
   const matches=(p:CloudHistorySummary)=>p.label===label.trim()&&p.sourceRevision===expectedRevision;
   try{const p=await parse(await call(projectPath(projectId),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id,label:label.trim(),expectedRevision})}),projectId,id);if(!matches(p))throw new Error('다른 복원 지점이 반환됐습니다.');return p;}
   catch(error){if(signal?.aborted||error instanceof CloudProjectError&&error.status<500)throw error;try{const p=await metadata(projectId,id);if(matches(p))return p;}catch{/* Do not assume a failed response means no commit. */}throw error;}
  },
  async read(projectId:string,id:string){
   const summary=await metadata(projectId,id),response=await checked(await call(pointPath(projectId,id)));
   if(response.headers.get('x-project-sha256')!==summary.sha256||Number(response.headers.get('x-project-revision'))!==summary.revision)throw new CloudProjectError('버전 정보가 바뀌었습니다. 새로고침해주세요.',409);
   const reader=response.body?.getReader();if(!reader)throw new Error('버전 파일을 읽지 못했습니다.');const chunks:Uint8Array[]=[];let size=0;
   try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>summary.bytes||size>CLOUD_PACKAGE_MAX_BYTES){await reader.cancel();throw new Error('버전 파일이 너무 큽니다.');}chunks.push(part.value);}}finally{reader.releaseLock();}
   const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}if(size!==summary.bytes||await cloudPackageHash(bytes.buffer)!==summary.sha256)throw new Error('버전 자산 해시·크기가 일치하지 않습니다.');return {summary,bytes:bytes.buffer};
  },
  async archive(projectId:string,id:string,expectedRevision:number,archived:boolean){return parse(await call(pointPath(projectId,id),{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({expectedRevision,archived})}),projectId,id);},
  async remove(projectId:string,id:string,expectedRevision:number){const raw=await (await checked(await call(pointPath(projectId,id),{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({expectedRevision})}))).json();if(raw.deleted!==true)throw new Error('버전 삭제 결과를 확인하지 못했습니다.');},
 };
}
