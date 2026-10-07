import type {PublicShareSnapshot} from './publicShare';
import type {WorldPoint} from './types';
import {referenceModelFootprint} from './referenceModel';
import {modelArtworkFootprint} from './modelArtworks';
import {uuidPattern} from './cloudProject';
export const REVIEW_TEXT_MAX=2000,REVIEW_POSTS_MAX=20,REVIEW_THREADS_MAX=100,REVIEW_AUTHOR_THREADS_MAX=20,REVIEW_PAGE_SIZE=10;
export interface ReviewAnchor {kind:'project'|'wall'|'artwork'|'modelArtwork'|'referenceModel'|'point';sceneId:string|null;id?:string;point?:WorldPoint;label:string;sceneName:string}
export interface ReviewPost {id:string;name:string;text:string;createdAt:string;editedAt?:string;deleted?:boolean;mine:boolean}
export interface ReviewThread {id:string;revision:number;anchor:ReviewAnchor;resolved:boolean;createdAt:string;updatedAt:string;canManage:boolean;posts:ReviewPost[]}
export interface ReviewPage {enabled:boolean;items:ReviewThread[];nextCursor:string|null;canComment:boolean;owner:boolean}
export interface StoredReviewPost extends Omit<ReviewPost,'mine'> {authorId:string}
export interface StoredReviewThread {anchor:ReviewAnchor;resolved:boolean;posts:StoredReviewPost[]}
export class ReviewError extends Error {constructor(message:string,public status=400){super(message);}}
const object=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw new ReviewError('댓글 형식이 올바르지 않습니다.');return v as Record<string,unknown>;};
const text=(v:unknown,max:number,empty=false)=>{if(typeof v!=='string'||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)||!empty&&!v.trim())throw new ReviewError(`텍스트는 1~${max}자로 입력해 주세요.`);return v;};
export function reviewText(v:unknown){return text(v,REVIEW_TEXT_MAX).trim();}
export function reviewName(v:unknown){return text(v,80).trim();}
export function reviewId(v:unknown){if(typeof v!=='string'||!uuidPattern.test(v))throw new ReviewError('댓글 ID가 올바르지 않습니다.');return v;}
export function reviewRevision(v:unknown){if(!Number.isSafeInteger(v)||(v as number)<1)throw new ReviewError('댓글 버전이 필요합니다.');return v as number;}
/** Derive labels and targets from the published allowlist, not private Project records. */
export function resolveReviewAnchor(snapshot:PublicShareSnapshot,input:unknown):ReviewAnchor{
 const a=object(input);if(a.sceneId!==null&&typeof a.sceneId!=='string')throw new ReviewError('댓글 Scene을 지정해 주세요.');
 const scene=a.sceneId===null?undefined:snapshot.scenes?.find(s=>s.id===a.sceneId);if(a.sceneId!==null&&!scene)throw new ReviewError('공유하지 않은 Scene에는 댓글을 달 수 없습니다.');
 const layout=scene?.snapshot??snapshot,base={sceneId:a.sceneId as string|null,sceneName:scene?(scene.name||'이름 없는 Scene'):'현재 배치'};
 if(a.kind==='project')return {...base,kind:'project',label:'전시 전체'};
 if(a.kind==='referenceModel'){if(!layout.referenceModel)throw new ReviewError('공유된 참고 공간이 없습니다.');return {...base,kind:'referenceModel',id:'referenceModel',label:'참고 공간'};}
 if(a.kind==='point'){const p=object(a.point),point:WorldPoint={x:0,y:0,z:0};for(const key of ['x','y','z'] as const){if(typeof p[key]!=='number'||!Number.isFinite(p[key])||Math.abs(p[key] as number)>1e7)throw new ReviewError('공간 위치가 올바르지 않습니다.');point[key]=p[key] as number;}const points=[...layout.walls.flatMap(w=>[w.start,w.end]),...layout.importedFloor?.flat()??[],...layout.modelArtworks?.flatMap(modelArtworkFootprint)??[],...(layout.referenceModel?referenceModelFootprint(layout.referenceModel):[])];if(!points.length)points.push({x:-500,z:-500},{x:500,z:500});const xs=points.map(p=>p.x),zs=points.map(p=>p.z),pad=Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...zs)-Math.min(...zs),1000)*.2+1000,maxY=Math.max(1000,...layout.walls.map(w=>w.heightMm),...layout.modelArtworks?.map(a=>a.position.y+a.heightMm)??[],...(layout.referenceModel?[layout.referenceModel.positionMm[1]+layout.referenceModel.sizeMm[1]*layout.referenceModel.scale]:[]));if(point.x<Math.min(...xs)-pad||point.x>Math.max(...xs)+pad||point.z<Math.min(...zs)-pad||point.z>Math.max(...zs)+pad||point.y<-pad||point.y>maxY+pad)throw new ReviewError('공유 공간 범위 안에 위치를 지정해 주세요.');return {...base,kind:'point',point,label:'공간 위치'};}
 if(a.kind!=='wall'&&a.kind!=='artwork'&&a.kind!=='modelArtwork')throw new ReviewError('댓글 대상을 찾을 수 없습니다.');
 const found=(a.kind==='wall'?layout.walls:a.kind==='artwork'?layout.artworks:layout.modelArtworks??[]).find(item=>item.id===a.id);if(!found)throw new ReviewError('공유한 객체에만 댓글을 달 수 있습니다.');
 return {...base,kind:a.kind,id:found.id,label:found.name||(a.kind==='wall'?'이름 없는 벽':'이름 없는 작품')};
}
export type ReviewMutation={action:'reply';id:string;name:string;text:string}|{action:'resolve';resolved:boolean}|{action:'edit';id:string;text:string}|{action:'deletePost';id:string}|{action:'deleteThread'};
export function parseReviewMutation(v:unknown):ReviewMutation{const a=object(v);switch(a.action){case 'reply':return {action:'reply',id:reviewId(a.id),name:reviewName(a.name),text:reviewText(a.text)};case 'resolve':if(typeof a.resolved!=='boolean')break;return {action:'resolve',resolved:a.resolved};case 'edit':return {action:'edit',id:reviewId(a.id),text:reviewText(a.text)};case 'deletePost':return {action:'deletePost',id:reviewId(a.id)};case 'deleteThread':return {action:'deleteThread'};}throw new ReviewError('댓글 변경 요청이 올바르지 않습니다.');}
export function mutateReviewThread(source:StoredReviewThread,threadAuthor:string,actor:string,owner:boolean,change:ReviewMutation,now:string){
 const record=structuredClone(source),manage=owner||threadAuthor===actor;
 if(change.action==='deleteThread'){if(!manage)throw new ReviewError('이 의견을 삭제할 권한이 없습니다.',403);record.posts=record.posts.map(p=>({...p,text:'',name:'',deleted:true,editedAt:now}));return {record,deleted:true};}
 if(change.action==='resolve'){if(!manage)throw new ReviewError('이 의견을 완료할 권한이 없습니다.',403);record.resolved=change.resolved;return {record,deleted:false};}
 if(change.action==='reply'){if(record.resolved)throw new ReviewError('완료된 의견은 다시 열고 답글을 달아 주세요.',409);if(record.posts.length>=REVIEW_POSTS_MAX)throw new ReviewError(`한 의견은 답글 포함 ${REVIEW_POSTS_MAX}개까지 저장합니다.`,413);record.posts.push({id:change.id,name:change.name,text:change.text,authorId:actor,createdAt:now});return {record,deleted:false};}
 const post=record.posts.find(p=>p.id===change.id);if(!post||post.deleted)throw new ReviewError('댓글을 찾을 수 없습니다.',404);
 if(change.action==='edit'){if(post.authorId!==actor)throw new ReviewError('자신이 쓴 댓글만 수정할 수 있습니다.',403);post.text=change.text;post.editedAt=now;}
 else{if(!owner&&post.authorId!==actor)throw new ReviewError('이 댓글을 삭제할 권한이 없습니다.',403);post.text='';post.name='';post.deleted=true;post.editedAt=now;}
 return {record,deleted:false};
}
/** Client parser strips identity and unknown fields even from a malformed response. */
export function parseReviewPage(v:unknown):ReviewPage{
 const p=object(v);if(p.enabled===false)return {enabled:false,items:[],nextCursor:null,canComment:false,owner:false};
 if(p.enabled!==true||!Array.isArray(p.items)||p.items.length>REVIEW_PAGE_SIZE||typeof p.canComment!=='boolean'||typeof p.owner!=='boolean'||p.nextCursor!==null&&(typeof p.nextCursor!=='string'||!/^[1-9]\d{0,15}$/.test(p.nextCursor)))throw new ReviewError('댓글 목록 응답이 올바르지 않습니다.');
 const date=(v:unknown)=>{const s=text(v,40);if(!Number.isFinite(Date.parse(s)))throw new ReviewError('댓글 일시가 올바르지 않습니다.');return s;};
 const items=p.items.map(value=>{const t=object(value),a=object(t.anchor);if(!['project','wall','artwork','modelArtwork','referenceModel','point'].includes(a.kind as string)||a.sceneId!==null&&typeof a.sceneId!=='string'||typeof t.resolved!=='boolean'||typeof t.canManage!=='boolean'||!Array.isArray(t.posts)||t.posts.length<1||t.posts.length>REVIEW_POSTS_MAX)throw new ReviewError('댓글 목록이 올바르지 않습니다.');
  const anchor:ReviewAnchor={kind:a.kind as ReviewAnchor['kind'],sceneId:a.sceneId as string|null,label:text(a.label,200),sceneName:text(a.sceneName,200),...(a.id===undefined?{}:{id:text(a.id,100)})};
  if(anchor.kind==='point'){const point=object(a.point);if(['x','y','z'].some(k=>typeof point[k]!=='number'||!Number.isFinite(point[k])||Math.abs(point[k] as number)>1e7))throw new ReviewError('댓글 위치가 올바르지 않습니다.');anchor.point={x:point.x as number,y:point.y as number,z:point.z as number};}
  const posts=t.posts.map(value=>{const r=object(value);if(typeof r.mine!=='boolean'||r.deleted!==undefined&&r.deleted!==true)throw new ReviewError('댓글 작성 정보가 올바르지 않습니다.');return {id:reviewId(r.id),name:text(r.name,80,r.deleted===true),text:text(r.text,REVIEW_TEXT_MAX,r.deleted===true),createdAt:date(r.createdAt),mine:r.mine,...(r.deleted?{deleted:true}:{}),...(r.editedAt?{editedAt:date(r.editedAt)}:{})};});
  if(new Set(posts.map(p=>p.id)).size!==posts.length)throw new ReviewError('댓글 ID가 중복됐습니다.');
  return {id:reviewId(t.id),revision:reviewRevision(t.revision),anchor,resolved:t.resolved,createdAt:date(t.createdAt),updatedAt:date(t.updatedAt),canManage:t.canManage,posts};
 });if(new Set(items.map(t=>t.id)).size!==items.length)throw new ReviewError('의견 ID가 중복됐습니다.');return {enabled:true,items,nextCursor:p.nextCursor as string|null,canComment:p.canComment,owner:p.owner};
}
