import {CollaborationInputError,inviteEmail,inviteId,inviteToken,memberRole,projectRole,type MemberRole,type ProjectInvitation,type ProjectMember,type ProjectRole} from '../domain/collaboration';
import {CloudProjectError,type CloudFetch} from './cloudProjectClient';
import {uuidPattern} from '../domain/cloudProject';
const object=(v:unknown)=>{if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('공동 작업 응답이 올바르지 않습니다.');return v as Record<string,unknown>;};
const date=(v:unknown)=>{if(typeof v!=='string'||!Number.isFinite(Date.parse(v)))throw new Error('공동 작업 날짜가 올바르지 않습니다.');return v;};
const revision=(v:unknown)=>{if(!Number.isSafeInteger(v)||(v as number)<1)throw new Error('공동 작업 버전이 올바르지 않습니다.');return v as number;};
export function parseProjectMember(value:unknown):ProjectMember{const v=object(value);if(typeof v.revoked!=='boolean')throw new Error('참여 상태가 올바르지 않습니다.');return {userId:inviteId(v.userId),email:inviteEmail(v.email),role:memberRole(v.role),revision:revision(v.revision),revoked:v.revoked,createdAt:date(v.createdAt),updatedAt:date(v.updatedAt)};}
export function parseProjectInvitation(value:unknown):ProjectInvitation{const v=object(value);if(!['pending','accepted','revoked'].includes(v.status as string))throw new Error('초대 상태가 올바르지 않습니다.');return {id:inviteId(v.id),projectId:inviteId(v.projectId),email:inviteEmail(v.email),role:memberRole(v.role),revision:revision(v.revision),status:v.status as ProjectInvitation['status'],createdAt:date(v.createdAt),expiresAt:date(v.expiresAt)};}
export interface InvitationPreview {projectId:string;name:string;venue:string;role:ProjectRole;accepted:boolean;expiresAt?:string}
export function parseInvitationPreview(value:unknown):InvitationPreview{const v=object(value);if(typeof v.name!=='string'||v.name.length>1000||typeof v.venue!=='string'||v.venue.length>1000||typeof v.accepted!=='boolean')throw new Error('초대 프로젝트 정보가 올바르지 않습니다.');return {projectId:inviteId(v.projectId),name:v.name,venue:v.venue,role:projectRole(v.role),accepted:v.accepted,...(v.expiresAt!==undefined?{expiresAt:date(v.expiresAt)}:{})};}
export function createCollaborationClient(token:string,fetcher:CloudFetch=fetch,signal?:AbortSignal){
 if(!token||token.length>8192)throw new CollaborationInputError('계정 로그인이 필요합니다.');
 async function call(path:string,method='GET',value?:unknown){const r=await fetcher(path,{method,signal,cache:'no-store',headers:{authorization:'Bearer '+token,...(value!==undefined?{'content-type':'application/json'}:{})},...(value!==undefined?{body:JSON.stringify(value)}:{})});if(!r.ok){let message=`공동 작업 요청에 실패했습니다 (${r.status}).`;try{const v=await r.json();if(typeof v.error==='string')message=v.error;}catch{/* Retain HTTP status. */}throw new CloudProjectError(message,r.status);}return r.json();}
 const path=(id:string)=>{if(!uuidPattern.test(id))throw new Error('프로젝트 ID가 올바르지 않습니다.');return '/api/projects/'+id;};
 async function list<T>(url:string,parse:(v:unknown)=>T){const v=object(await call(url));if(!Array.isArray(v.items)||v.items.length>200)throw new Error('공동 작업 목록이 올바르지 않습니다.');return {items:v.items.map(parse),truncated:v.truncated===true};}
 return {
  members:(id:string)=>list(path(id)+'/members',parseProjectMember),
  invitations:(id:string)=>list(path(id)+'/invitations',parseProjectInvitation),
  async invite(id:string,value:{id:string;email:string;role:MemberRole;token:string}){inviteId(value.id);inviteToken(value.token);memberRole(value.role);inviteEmail(value.email);const result=parseProjectInvitation(await call(path(id)+'/invitations','POST',value));if(result.id!==value.id||result.projectId!==id)throw new Error('초대 저장 결과가 일치하지 않습니다.');return result;},
  async changeMember(id:string,userId:string,expectedRevision:number,role:MemberRole,revoked:boolean){return parseProjectMember(await call(path(id)+'/members/'+inviteId(userId),'PATCH',{expectedRevision,role,revoked}));},
  revokeInvite:(id:string,invitation:ProjectInvitation)=>call(path(id)+'/invitations/'+inviteId(invitation.id),'PATCH',{expectedRevision:invitation.revision,revoked:true}),
  async preview(id:string,secret:string,accept=false){return parseInvitationPreview(await call('/api/project-invitations/'+inviteId(id)+'/'+(accept?'accept':'preview'),'POST',{token:inviteToken(secret)}));},
 };
}
