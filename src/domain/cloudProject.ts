import {projectRole,type ProjectRole} from './collaboration';
export const CLOUD_PACKAGE_MAX_BYTES=80*1024*1024;
export interface CloudProjectMetadata {name:string;venue:string;sourceProjectId:string}
export interface CloudProjectSummary extends CloudProjectMetadata {id:string;revision:number;sha256:string;bytes:number;createdAt:string;updatedAt:string;archived:boolean;role?:ProjectRole}
export interface CloudProjectLink {userId:string;localProjectId:string;cloudProjectId:string;revision:number;localRevision:number;autoSync:boolean}
export interface CloudSavePending {requestId:string;link:CloudProjectLink;file:Blob;metadata:CloudProjectMetadata;blocked?:boolean}
export const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parseCloudMetadata(value:unknown):CloudProjectMetadata{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('프로젝트 정보가 올바르지 않습니다.');
 const raw=value as Record<string,unknown>,field=(key:string,max:number)=>{const s=raw[key];if(typeof s!=='string'||s.length>max||s.includes('\0'))throw new Error('프로젝트 이름·전시장 정보가 올바르지 않습니다.');return s;};
 const name=field('name',1000),venue=field('venue',1000),sourceProjectId=field('sourceProjectId',200);if(!name.trim()||!sourceProjectId)throw new Error('프로젝트 이름과 ID가 필요합니다.');return {name,venue,sourceProjectId};
}
export function encodeCloudMetadata(value:CloudProjectMetadata){const bytes=new TextEncoder().encode(JSON.stringify(parseCloudMetadata(value)));if(bytes.length>4000)throw new Error('프로젝트 정보가 너무 깁니다.');return btoa(String.fromCharCode(...bytes));}
export function decodeCloudMetadata(value:string|null){if(!value||value.length>5500)throw new Error('프로젝트 정보가 필요합니다.');let decoded:string;try{decoded=new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(value),c=>c.charCodeAt(0)));}catch{throw new Error('프로젝트 정보가 손상됐습니다.');}return parseCloudMetadata(JSON.parse(decoded));}
export function parseCloudSummary(value:unknown):CloudProjectSummary{
 const meta=parseCloudMetadata(value),r=value as Record<string,unknown>;
 if(typeof r.id!=='string'||!uuidPattern.test(r.id)||!Number.isSafeInteger(r.revision)||(r.revision as number)<1||typeof r.sha256!=='string'||!/^([0-9a-f]{64})$/.test(r.sha256)||!Number.isSafeInteger(r.bytes)||(r.bytes as number)<22||(r.bytes as number)>CLOUD_PACKAGE_MAX_BYTES||typeof r.createdAt!=='string'||!Number.isFinite(Date.parse(r.createdAt))||typeof r.updatedAt!=='string'||!Number.isFinite(Date.parse(r.updatedAt))||typeof r.archived!=='boolean')throw new Error('클라우드 프로젝트 응답이 올바르지 않습니다.');
 return {...meta,id:r.id,revision:r.revision as number,sha256:r.sha256,bytes:r.bytes as number,createdAt:r.createdAt,updatedAt:r.updatedAt,archived:r.archived,...(r.role!==undefined?{role:projectRole(r.role)}:{})};
}
export function parseCloudLink(value:unknown):CloudProjectLink{
 const r=value as CloudProjectLink;
 if(!r||!uuidPattern.test(r.userId)||!uuidPattern.test(r.cloudProjectId)||typeof r.localProjectId!=='string'||!r.localProjectId||r.localProjectId.length>200||!Number.isSafeInteger(r.revision)||r.revision<0||!Number.isSafeInteger(r.localRevision)||r.localRevision<1||typeof r.autoSync!=='boolean')throw new Error('클라우드 연결 정보가 올바르지 않습니다.');
 return {userId:r.userId,localProjectId:r.localProjectId,cloudProjectId:r.cloudProjectId,revision:r.revision,localRevision:r.localRevision,autoSync:r.autoSync};
}
export function parseCloudPending(value:unknown):CloudSavePending{
 const r=value as CloudSavePending,link=parseCloudLink(r?.link),metadata=parseCloudMetadata(r?.metadata);
 if(!uuidPattern.test(r.requestId)||!(r.file instanceof Blob)||r.file.size<22||r.file.size>CLOUD_PACKAGE_MAX_BYTES||metadata.sourceProjectId!==link.localProjectId||(r.blocked!==undefined&&typeof r.blocked!=='boolean'))throw new Error('클라우드 대기 작업이 올바르지 않습니다.');
 return {requestId:r.requestId,link,metadata,file:r.file,...(r.blocked!==undefined?{blocked:r.blocked}:{})};
}
