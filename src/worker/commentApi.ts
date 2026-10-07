import {authenticatedUser,type AuthFetch} from './auth';
import type {ProjectDatabase} from './projectApi';
import type {AuthEnv} from './auth';
import type {PublicShareSnapshot} from '../domain/publicShare';
import {REVIEW_AUTHOR_THREADS_MAX,REVIEW_THREADS_MAX,REVIEW_PAGE_SIZE,ReviewError,mutateReviewThread,parseReviewMutation,resolveReviewAnchor,reviewId,reviewName,reviewRevision,reviewText,type StoredReviewThread,type ReviewThread,type ReviewAnchor} from '../domain/reviewComments';
interface Entry {ownerId?:string;status:'draft'|'active'|'revoked';commentsEnabled?:boolean;canComment?:boolean}
interface Row {seq:number;id:string;share_id:string;author_id:string;revision:number;record_json:string;deleted:number;created_at:string;updated_at:string}
interface Context {entry:()=>Promise<Entry|null>;snapshot:()=>Promise<PublicShareSnapshot|null>;legacy:()=>boolean;actor?:{id:string};anchor?:(input:unknown)=>Promise<ReviewAnchor>;writeConstraint?:{sql:string;values:unknown[]}}
const headers={'cache-control':'no-store','x-content-type-options':'nosniff'},json=(v:unknown,status=200)=>Response.json(v,{status,headers}),fail=(status:number,error:string)=>json({error},status);
const read=(db:ProjectDatabase,share:string,id:string)=>db.prepare('SELECT * FROM review_threads WHERE share_id = ? AND id = ?').bind(share,id).first<Row>();
const record=(r:Row)=>JSON.parse(r.record_json) as StoredReviewThread;
function publicThread(row:Row,actor:string|undefined,owner:boolean):ReviewThread{const r=record(row);return {id:row.id,revision:row.revision,anchor:r.anchor,resolved:r.resolved,createdAt:row.created_at,updatedAt:row.updated_at,canManage:owner||row.author_id===actor,posts:r.posts.map(p=>({id:p.id,name:p.name,text:p.text,createdAt:p.createdAt,mine:p.authorId===actor,...(p.editedAt?{editedAt:p.editedAt}:{}),...(p.deleted?{deleted:true}:{})}))};}
async function body(request:Request){
 if(Number(request.headers.get('content-length'))>16384)throw new ReviewError('댓글 요청은 16KiB 이하여야 합니다.',413);
 const reader=request.body?.getReader();if(!reader)throw new ReviewError('댓글 내용이 필요합니다.');let total=0;const chunks:Uint8Array[]=[];
 try{while(true){const p=await reader.read();if(p.done)break;total+=p.value.byteLength;if(total>16384){await reader.cancel();throw new ReviewError('댓글 요청은 16KiB 이하여야 합니다.',413);}chunks.push(p.value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 try{const v=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));if(!v||typeof v!=='object'||Array.isArray(v))throw new Error();return v as Record<string,unknown>;}catch{throw new ReviewError('댓글 내용이 올바르지 않습니다.');}
}
/** Review writes affect only D1 comment records; an immutable public layout never changes. */
export async function handleCommentRequest(request:Request,env:AuthEnv&{PROJECTS_DB?:ProjectDatabase},share:string,id:string|undefined,context:Context,authFetch:AuthFetch):Promise<Response>{
 const method=request.method,url=new URL(request.url);if(!['GET','POST','PATCH'].includes(method)||method==='GET'&&id||method==='POST'&&id||method==='PATCH'&&!id)return fail(405,'지원하지 않는 댓글 요청입니다.');
 if(method!=='GET'&&request.headers.has('origin')&&request.headers.get('origin')!==url.origin)return fail(403,'같은 사이트에서 요청해주세요.');
 try{
  const entry=await context.entry();if(!entry||entry.status==='draft')return fail(404,'공유 링크를 찾을 수 없습니다.');if(entry.status==='revoked')return fail(410,'중단된 공유 링크입니다.');
  if(!entry.commentsEnabled)return method==='GET'?json({enabled:false}):fail(409,'댓글을 허용하지 않은 공유 링크입니다.');
  const db=env.PROJECTS_DB;if(!db)return fail(503,'댓글 저장 연결이 아직 준비되지 않았습니다.');
  let actor:string|undefined=context.actor?.id,owner=!!actor&&entry.ownerId===actor;
  if(!context.actor&&request.headers.has('authorization')){
   if(context.legacy()){if(entry.ownerId)return fail(403,'이 링크의 작성자 키가 아닙니다.');actor='legacy';owner=true;}
   else{const user=await authenticatedUser(request,env,authFetch);if(!user)return fail(401,'계정 로그인이 필요합니다.');actor=user.id;owner=entry.ownerId===actor;}
  }
  const page=async(rows:Row[],cursor:string|null=null,status=200)=>{const latest=await context.entry();if(latest?.status!=='active')return fail(410,'중단된 공유 링크입니다.');return json({enabled:true,items:rows.map(r=>publicThread(r,actor,owner)),nextCursor:cursor,canComment:!!actor&&latest.canComment!==false,owner},status);};
  if(method==='GET'){
   const raw=url.searchParams.get('before');if(raw!==null&&!/^[1-9]\d{0,15}$/.test(raw))return fail(400,'댓글 목록 위치가 올바르지 않습니다.');const before=raw===null?Number.MAX_SAFE_INTEGER:Number(raw);if(!Number.isSafeInteger(before))return fail(400,'댓글 목록 위치가 올바르지 않습니다.');
   const {results}=await db.prepare('SELECT * FROM review_threads WHERE share_id = ? AND deleted = 0 AND seq < ? ORDER BY seq DESC LIMIT ?').bind(share,before,REVIEW_PAGE_SIZE+1).all<Row>();const rows=results.slice(0,REVIEW_PAGE_SIZE);return await page(rows,results.length>REVIEW_PAGE_SIZE?String(rows.at(-1)!.seq):null);
  }
  if(!actor)return fail(401,'댓글 작성은 계정 로그인이 필요합니다.');if(entry.canComment===false)return fail(403,'열람자는 협업 의견을 작성하거나 변경할 수 없습니다.');const v=await body(request),now=new Date().toISOString();
  // Revocation may happen during identity verification/body streaming. Check again before writes.
  if((await context.entry())?.status!=='active')return fail(410,'중단된 공유 링크입니다.');
  if(method==='POST'){
   const threadId=reviewId(v.id),postId=reviewId(v.postId),name=reviewName(v.name),text=reviewText(v.text);
   let anchor:ReviewAnchor;if(context.anchor)anchor=await context.anchor(v.anchor);else{const snapshot=await context.snapshot();if(!snapshot)return fail(404,'공유 화면을 찾을 수 없습니다.');anchor=resolveReviewAnchor(snapshot,v.anchor);}const existing=await read(db,share,threadId);
   const sameCreate=(r:Row)=>{const old=record(r);return !r.deleted&&r.author_id===actor&&JSON.stringify(old.anchor)===JSON.stringify(anchor)&&old.posts[0].id===postId&&old.posts[0].name===name&&old.posts[0].text===text&&!old.posts[0].deleted;};
   if(existing){if(sameCreate(existing))return await page([existing]);return fail(409,'이미 사용한 댓글 요청 ID입니다.');}
   const data:StoredReviewThread={anchor,resolved:false,posts:[{id:postId,name,text,authorId:actor,createdAt:now}]};
   const constraint=context.writeConstraint??{sql:'',values:[]};
   const saved=await db.prepare('INSERT INTO review_threads (id, share_id, author_id, revision, record_json, deleted, created_at, updated_at) SELECT ?, ?, ?, 1, ?, 0, ?, ? WHERE (SELECT COUNT(*) FROM review_threads WHERE share_id = ?) < ? AND (SELECT COUNT(*) FROM review_threads WHERE share_id = ? AND author_id = ?) < ?'+constraint.sql+' ON CONFLICT(id) DO NOTHING').bind(threadId,share,actor,JSON.stringify(data),now,now,share,REVIEW_THREADS_MAX,share,actor,REVIEW_AUTHOR_THREADS_MAX,...constraint.values).run();
   if(!saved.success)throw new Error();const next=await read(db,share,threadId);if(!saved.meta.changes){if(context.writeConstraint&&!(await db.prepare('SELECT 1 AS allowed WHERE 1 = 1'+constraint.sql).bind(...constraint.values).first())){const latest=await context.entry();return fail(!latest?410:latest.canComment===false?403:409,'프로젝트 댓글 권한 또는 참여 버전이 변경됐습니다. 새로고침해 주세요.');}if(next&&sameCreate(next))return await page([next]);return fail(next?409:413,next?'다른 요청에서 이 댓글 ID를 사용했습니다.':`링크당 ${REVIEW_THREADS_MAX}개, 작성자당 ${REVIEW_AUTHOR_THREADS_MAX}개 의견까지 저장합니다.`);}if(!next)throw new Error();return await page([next],null,201);
  }
  reviewId(id);const row=await read(db,share,id!);if(!row||row.deleted)return fail(404,'댓글을 찾을 수 없습니다.');const expected=reviewRevision(v.expectedRevision),change=parseReviewMutation(v),old=record(row);
  if(change.action==='reply'){const same=old.posts.find(p=>p.id===change.id);if(same){if(same.authorId===actor&&!same.deleted&&same.text===change.text&&same.name===change.name)return await page([row]);return fail(409,'이미 사용한 답글 요청 ID입니다.');}}
  if(row.revision!==expected)return fail(409,'다른 참여자가 댓글을 변경했습니다. 새로고침한 뒤 다시 시도해 주세요.');
  const next=mutateReviewThread(old,row.author_id,actor,owner,change,now);
  const constraint=context.writeConstraint??{sql:'',values:[]};
  const saved=await db.prepare('UPDATE review_threads SET record_json = ?, deleted = ?, revision = revision + 1, updated_at = ? WHERE share_id = ? AND id = ? AND revision = ? AND deleted = 0'+constraint.sql).bind(JSON.stringify(next.record),next.deleted?1:0,now,share,id,expected,...constraint.values).run();if(!saved.success)throw new Error();if(!saved.meta.changes)return fail(409,'다른 참여자가 댓글을 변경했습니다. 새로고침한 뒤 다시 시도해 주세요.');
  if((await context.entry())?.status!=='active')return fail(410,'프로젝트 접근 권한이 변경됐습니다.');if(next.deleted)return new Response(null,{status:204,headers});const result=await read(db,share,id!);if(!result)throw new Error();return await page([result]);
 }catch(e){return e instanceof ReviewError?fail(e.status,e.message):fail(503,'댓글 저장 결과를 확인하지 못했습니다. 입력은 유지되며 새로고침 후 다시 시도할 수 있습니다.');}
}
