import {parseCloudSummary,uuidPattern,type CloudProjectSummary} from './cloudProject';
export const CLOUD_HISTORY_MAX_POINTS=50;
export const CLOUD_HISTORY_MAX_ACCOUNT_POINTS=500;
export const CLOUD_HISTORY_MAX_BYTES=1024*1024*1024;
export interface CloudHistorySummary extends CloudProjectSummary {projectId:string;label:string;sourceRevision:number}
export function parseCloudHistorySummary(value:unknown):CloudHistorySummary{
 const base=parseCloudSummary(value),r=value as Record<string,unknown>;
 if(typeof r.projectId!=='string'||!uuidPattern.test(r.projectId)||typeof r.label!=='string'||!r.label.trim()||r.label.length>200||r.label.includes('\0')||!Number.isSafeInteger(r.sourceRevision)||(r.sourceRevision as number)<1)throw new Error('클라우드 버전 응답이 올바르지 않습니다.');
 return {...base,projectId:r.projectId,label:r.label,sourceRevision:r.sourceRevision as number};
}
