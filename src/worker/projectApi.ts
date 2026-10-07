import {projectAccess,editorWriteConstraint,type ProjectRow} from './projectAccess';
import {handleCollaborationRequest} from './collaborationApi';
import {handleTeamCommentRequest} from './teamCommentApi';
import {canEditProject,type ProjectRole} from '../domain/collaboration';
import {authenticatedUser,authConfig,type AuthEnv,type AuthFetch} from './auth';
import {CLOUD_PACKAGE_MAX_BYTES,decodeCloudMetadata,uuidPattern,type CloudProjectSummary} from '../domain/cloudProject';
import {handleHistoryRequest} from './historyApi';
import {handleLibraryRequest} from './libraryApi';
export interface ProjectBucket {
 put(key:string,value:ReadableStream,options:{sha256:string;httpMetadata:{contentType:string}}):Promise<{size:number}|null>;
 get(key:string,options?:{range:{offset:number;length:number}}):Promise<{body:ReadableStream;size:number}|null>;
 delete(key:string):Promise<unknown>;
}
export interface ProjectStatement {bind(...values:unknown[]):ProjectStatement;first<T>():Promise<T|null>;all<T>():Promise<{results:T[]}>;run():Promise<{success:boolean;meta:{changes:number}}>}
export interface ProjectDatabase {prepare(query:string):ProjectStatement;batch?(statements:ProjectStatement[]):Promise<Array<{success:boolean;meta:{changes:number}}>>}
export interface ProjectEnv extends AuthEnv {PROJECTS_DB?:ProjectDatabase;PRIVATE_PROJECTS?:ProjectBucket}
type Row=ProjectRow;
const headers={'cache-control':'no-store','x-content-type-options':'nosniff'},json=(value:unknown,status=200)=>Response.json(value,{status,headers}),fail=(status:number,error:string)=>json({error},status);
const summary=(r:Row,role?:ProjectRole):CloudProjectSummary=>({id:r.id,name:r.name,venue:r.venue,sourceProjectId:r.source_project_id,revision:r.revision,sha256:r.snapshot_sha256,bytes:r.snapshot_bytes,createdAt:r.created_at,updatedAt:r.updated_at,archived:r.archived===1,...(role?{role}:{})});
const row=(db:ProjectDatabase,id:string,owner:string)=>db.prepare('SELECT * FROM cloud_projects WHERE id = ? AND owner_id = ?').bind(id,owner).first<Row>();
const count=(db:ProjectDatabase,owner:string)=>db.prepare('SELECT COUNT(*) AS count FROM cloud_projects WHERE owner_id = ?').bind(owner).first<{count:number}>();

export async function handleProjectRequest(request:Request,env:ProjectEnv,fetcher:AuthFetch=fetch):Promise<Response>{
 const url=new URL(request.url),path=url.pathname,method=request.method,config=authConfig(env,!!env.PROJECTS_DB&&!!env.PRIVATE_PROJECTS);
 if(path==='/api/auth/config')return method==='GET'?json(config?{enabled:true,...config}:{enabled:false}):fail(405,'지원하지 않는 요청입니다.');
 if(!config)return fail(503,'계정 로그인 연결이 아직 준비되지 않았습니다.');
 if(request.headers.has('origin')&&request.headers.get('origin')!==url.origin)return fail(403,'같은 사이트에서 요청해주세요.');
 try{
  const user=await authenticatedUser(request,env,fetcher,path.startsWith('/api/project-invitations/'));if(!user)return fail(401,'계정 로그인이 필요합니다.');
  if(path==='/api/auth/me')return method==='GET'?json(user):fail(405,'지원하지 않는 요청입니다.');
  const db=env.PROJECTS_DB,bucket=env.PRIVATE_PROJECTS;if(!db||!bucket)return fail(503,'클라우드 프로젝트 저장을 아직 사용할 수 없습니다.');
  if(path.startsWith('/api/project-invitations/')||/^\/api\/projects\/[0-9a-f-]{36}\/(members|invitations)(\/|$)/.test(path))return await handleCollaborationRequest(request,db,user);
  if(/^\/api\/projects\/[0-9a-f-]{36}\/comments(\/|$)/.test(path))return await handleTeamCommentRequest(request,env,db,user);
  if(path.startsWith('/api/libraries/'))return await handleLibraryRequest(request,db,bucket,user.id);
  if(path.includes('/history'))return await handleHistoryRequest(request,db,bucket,user.id);
  if(path==='/api/projects/shared'){
   if(method!=='GET')return fail(405,'지원하지 않는 요청입니다.');const {results}=await db.prepare('SELECT p.*, m.role AS member_role FROM cloud_projects p JOIN project_members m ON m.project_id = p.id WHERE m.user_id = ? AND m.revoked = 0 ORDER BY p.updated_at DESC, p.id LIMIT 201').bind(user.id).all<Row&{member_role:ProjectRole}>();return json({items:results.slice(0,200).map(r=>summary(r,r.member_role)),truncated:results.length>200});
  }
  if(path==='/api/projects'){
   if(method!=='GET')return fail(405,'지원하지 않는 요청입니다.');const {results}=await db.prepare('SELECT * FROM cloud_projects WHERE owner_id = ? ORDER BY updated_at DESC, id LIMIT 201').bind(user.id).all<Row>();return json({items:results.slice(0,200).map(r=>summary(r)),truncated:results.length>200});
  }
  const match=/^\/api\/projects\/([0-9a-f-]{36})(\/meta)?$/.exec(path);if(!match||!uuidPattern.test(match[1]))return fail(404,'프로젝트를 찾을 수 없습니다.');
  const id=match[1],access=await projectAccess(db,id,user.id),current=access?.row;
  if(method==='GET'){
   if(!current)return fail(404,'프로젝트를 찾을 수 없습니다.');if(match[2])return json(summary(current,access?.role));
   const file=await bucket.get(current.snapshot_key);if(!file||file.size!==current.snapshot_bytes)return fail(503,'프로젝트 파일을 읽지 못했습니다. 다시 시도해주세요.');
   if(!(await projectAccess(db,id,user.id))){await file.body.cancel();return fail(404,'프로젝트 접근 권한이 변경됐습니다.');}
   return new Response(file.body,{headers:{...headers,'content-type':'application/octet-stream','content-disposition':`attachment; filename="project-${id}.gonggan.zip"`,'content-length':String(file.size),'x-project-revision':String(current.revision),'x-project-sha256':current.snapshot_sha256}});
  }
  if(match[2])return fail(405,'지원하지 않는 요청입니다.');
  if(method==='PATCH'){
   if(!current)return fail(404,'프로젝트를 찾을 수 없습니다.');if(access?.role!=='owner')return fail(403,'소유자만 프로젝트를 보관하거나 복구할 수 있습니다.');const length=Number(request.headers.get('content-length'));if(!Number.isSafeInteger(length)||length<1||length>1024)return fail(413,'프로젝트 변경 요청이 너무 큽니다.');
   const bytes=await request.arrayBuffer();if(bytes.byteLength>1024)return fail(413,'프로젝트 변경 요청이 너무 큽니다.');let value:{archived?:unknown;expectedRevision?:unknown};try{value=JSON.parse(new TextDecoder().decode(bytes));if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();}catch{return fail(400,'프로젝트 변경 요청이 올바르지 않습니다.');}
   if(typeof value.archived!=='boolean'||!Number.isSafeInteger(value.expectedRevision)||(value.expectedRevision as number)<1)return fail(400,'보관 상태와 저장 버전이 필요합니다.');
   const result=await db.prepare('UPDATE cloud_projects SET archived = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND owner_id = ? AND revision = ?').bind(value.archived?1:0,new Date().toISOString(),id,user.id,value.expectedRevision).run();if(!result.success)return fail(503,'프로젝트 변경을 확인하지 못했습니다.');if(!result.meta.changes)return fail(409,'다른 기기에서 프로젝트를 변경했습니다. 목록을 다시 열어주세요.');return json(summary((await row(db,id,user.id))!));
  }
  if(method!=='PUT')return fail(405,'지원하지 않는 요청입니다.');
  if(access&&!canEditProject(access.role))return fail(403,'이 역할은 프로젝트 배치를 저장할 수 없습니다.');
  const expected=Number(request.headers.get('x-expected-revision')),length=Number(request.headers.get('content-length')),hash=request.headers.get('x-project-sha256');
  if(!request.headers.has('x-expected-revision')||!Number.isSafeInteger(expected)||expected<0||expected>=Number.MAX_SAFE_INTEGER)return fail(400,'저장 버전이 필요합니다.');
  if(!request.headers.has('content-length'))return fail(411,'프로젝트 파일 길이를 확인하지 못했습니다.');if(!Number.isSafeInteger(length)||length<22||length>CLOUD_PACKAGE_MAX_BYTES)return fail(413,'클라우드 프로젝트 파일은 80MiB 이하여야 합니다.');
  if(request.headers.get('content-type')!=='application/zip'||!hash||!/^[0-9a-f]{64}$/.test(hash)||!request.body)return fail(400,'프로젝트 백업 파일과 해시가 필요합니다.');
  let meta;try{meta=decodeCloudMetadata(request.headers.get('x-project-metadata'));}catch{return fail(400,'프로젝트 정보가 올바르지 않습니다.');}
  if(current?.archived)return fail(409,'보관된 프로젝트는 복구한 뒤 저장해주세요.');
  if(current&&current.revision===expected+1&&current.snapshot_sha256===hash&&current.snapshot_bytes===length&&current.name===meta.name&&current.venue===meta.venue&&current.source_project_id===meta.sourceProjectId)return json(summary(current,access?.role));
  if(current&&current.revision!==expected)return fail(409,'다른 기기에서 프로젝트를 변경했습니다. 복사본으로 저장한 뒤 최신 프로젝트를 열어주세요.');
  if(!current&&expected!==0)return fail(404,'프로젝트를 찾을 수 없습니다.');
  if(!current&&(await count(db,user.id))!.count>=200)return fail(413,'계정당 클라우드 프로젝트는 200개까지 저장합니다.');
  const key=`users/${current?.owner_id??user.id}/projects/${id}/snapshots/${crypto.randomUUID()}.zip`;let publishing=false;
  try{
   const saved=await bucket.put(key,request.body,{sha256:hash,httpMetadata:{contentType:'application/octet-stream'}});if(!saved||saved.size!==length)throw new Error('업로드 길이가 일치하지 않습니다.');
   const prefix=await bucket.get(key,{range:{offset:0,length:4}});if(!prefix)throw new Error('업로드 파일이 없습니다.');const signature=new Uint8Array(await new Response(prefix.body).arrayBuffer());if(signature.length!==4||![80,75,3,4].every((n,i)=>signature[i]===n)){await bucket.delete(key);return fail(400,'프로젝트 백업 ZIP 파일이 아닙니다.');}
   const now=new Date().toISOString();publishing=true;
   const constraint=access?.role==='editor'?editorWriteConstraint(user.id,access):{sql:'',values:[]};
   const result=current?await db.prepare('UPDATE cloud_projects SET name = ?, venue = ?, source_project_id = ?, revision = revision + 1, snapshot_key = ?, snapshot_sha256 = ?, snapshot_bytes = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND revision = ? AND archived = 0'+constraint.sql).bind(meta.name,meta.venue,meta.sourceProjectId,key,hash,length,now,id,current.owner_id,expected,...constraint.values).run():await db.prepare('INSERT INTO cloud_projects (id, owner_id, name, venue, source_project_id, revision, snapshot_key, snapshot_sha256, snapshot_bytes, created_at, updated_at, archived) SELECT ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, 0 WHERE (SELECT COUNT(*) FROM cloud_projects WHERE owner_id = ?) < 200 ON CONFLICT(id) DO NOTHING').bind(id,user.id,meta.name,meta.venue,meta.sourceProjectId,key,hash,length,now,now,user.id).run();
   if(!result.success)throw new Error('저장 결과를 확인하지 못했습니다.');
   if(!result.meta.changes){await bucket.delete(key);const latest=(await projectAccess(db,id,user.id))?.row;return latest?fail(409,'다른 기기에서 프로젝트를 변경했습니다. 복사본으로 저장해주세요.'):fail(404,'프로젝트를 저장할 수 없습니다.');}
   const committed=(await projectAccess(db,id,user.id))?.row;if(!committed)throw new Error('저장 결과를 확인하지 못했습니다.');
   // This API retains the latest package, not cloud version history. Only remove the old
   // unique object after a confirmed CAS commit; uncertain D1 results retain both objects.
   if(current)try{await bucket.delete(current.snapshot_key);}catch{/* Best-effort cleanup; the new pointer remains valid. */}
   return json(summary(committed,access?.role??'owner'),current?200:201);
  }catch{
   // A D1 error can follow a committed write. Never delete a possibly referenced snapshot.
   if(!publishing)try{await bucket.delete(key);}catch{/* Unreferenced upload can be cleaned up later. */}
   return fail(503,'클라우드 저장 결과를 확인하지 못했습니다. 연결을 확인하고 다시 시도해주세요.');
  }
 }catch{return fail(503,'계정 또는 프로젝트 서비스를 연결하지 못했습니다. 잠시 후 다시 시도해주세요.');}
}
