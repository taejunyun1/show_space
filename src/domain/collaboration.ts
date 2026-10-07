const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class CollaborationInputError extends Error {}
export type ProjectRole='owner'|'editor'|'viewer'|'commenter';
export type MemberRole=Exclude<ProjectRole,'owner'>;
export const PROJECT_MEMBER_MAX=20,PROJECT_INVITE_MAX=20,SHARED_PROJECT_MAX=200,INVITE_DURATION_MS=7*86400000;
export const projectRoleLabels:Record<ProjectRole,string>={owner:'소유자',editor:'편집자',viewer:'열람자',commenter:'댓글 참여자'};
export const canEditProject=(role:ProjectRole)=>role==='owner'||role==='editor';
export const canCommentProject=(role:ProjectRole)=>role!=='viewer';
export function memberRole(v:unknown):MemberRole{if(v==='editor'||v==='viewer'||v==='commenter')return v;throw new CollaborationInputError('초대 역할은 편집자·열람자·댓글 참여자로 선택해 주세요.');}
export function projectRole(v:unknown):ProjectRole{if(v==='owner')return v;return memberRole(v);}
export function inviteEmail(v:unknown){if(typeof v==='string')v=v.trim();if(typeof v!=='string'||v.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)||/[\u0000-\u001f]/.test(v))throw new CollaborationInputError('초대할 계정 이메일을 입력해 주세요.');return v.trim().toLocaleLowerCase('en-US');}
export function inviteId(v:unknown){if(typeof v!=='string'||!uuidPattern.test(v))throw new CollaborationInputError('초대 ID가 올바르지 않습니다.');return v;}
export function inviteToken(v:unknown){if(typeof v!=='string'||!/^[0-9a-f]{48}$/.test(v))throw new CollaborationInputError('초대 토큰이 올바르지 않습니다.');return v;}
export function newInviteToken(){return [...crypto.getRandomValues(new Uint8Array(24))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export async function inviteTokenHash(token:string){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(inviteToken(token)));return [...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('');}
export interface ProjectMember {userId:string;email:string;role:MemberRole;revision:number;revoked:boolean;createdAt:string;updatedAt:string}
export interface ProjectInvitation {id:string;projectId:string;email:string;role:MemberRole;revision:number;status:'pending'|'accepted'|'revoked';expiresAt:string;createdAt:string}
