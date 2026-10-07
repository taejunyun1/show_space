import type {ProjectDatabase,ProjectBucket} from './projectApi';
import {CLOUD_HISTORY_MAX_POINTS,CLOUD_HISTORY_MAX_ACCOUNT_POINTS,CLOUD_HISTORY_MAX_BYTES,type CloudHistorySummary} from '../domain/cloudHistory';
import {uuidPattern} from '../domain/cloudProject';
interface SnapshotRow {id:string;owner_id:string;name:string;venue:string;source_project_id:string;revision:number;snapshot_key:string;snapshot_sha256:string;snapshot_bytes:number;created_at:string;updated_at:string;archived:number}
interface HistoryRow extends SnapshotRow {project_id:string;label:string;source_revision:number}
const headers={'cache-control':'no-store','x-content-type-options':'nosniff'},json=(v:unknown,status=200)=>Response.json(v,{status,headers}),fail=(status:number,error:string)=>json({error},status);
const pointSummary=(r:HistoryRow):CloudHistorySummary=>({id:r.id,projectId:r.project_id,label:r.label,name:r.name,venue:r.venue,sourceProjectId:r.source_project_id,sourceRevision:r.source_revision,revision:r.revision,sha256:r.snapshot_sha256,bytes:r.snapshot_bytes,createdAt:r.created_at,updatedAt:r.updated_at,archived:r.archived===1});
const point=(db:ProjectDatabase,id:string,projectId:string,owner:string)=>db.prepare('SELECT * FROM cloud_history WHERE id = ? AND project_id = ? AND owner_id = ?').bind(id,projectId,owner).first<HistoryRow>();
async function body(request:Request){
 const length=Number(request.headers.get('content-length'));if(!request.headers.has('content-length')||!Number.isSafeInteger(length)||length<1||length>2048||request.headers.get('content-type')!=='application/json')throw new Error();
 const bytes=await request.arrayBuffer();if(bytes.byteLength!==length||bytes.byteLength>2048)throw new Error();const raw=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error();return raw as Record<string,unknown>;
}
/** Auth is checked once by the parent API. Every SQL operation is scoped by parent and provider owner. */
export async function handleHistoryRequest(request:Request,db:ProjectDatabase,bucket:ProjectBucket,owner:string):Promise<Response>{
 const match=/^\/api\/projects\/([0-9a-f-]{36})\/history(?:\/([0-9a-f-]{36})(\/meta)?)?$/.exec(new URL(request.url).pathname);
 if(!match||!uuidPattern.test(match[1])||(match[2]&&!uuidPattern.test(match[2])))return fail(404,'버전 기록을 찾을 수 없습니다.');
 const projectId=match[1],id=match[2],method=request.method,parent=await db.prepare('SELECT * FROM cloud_projects WHERE id = ? AND owner_id = ?').bind(projectId,owner).first<SnapshotRow>();
 if(!parent)return fail(404,'프로젝트를 찾을 수 없습니다.');
 if(method==='GET'){
  if(!id){const {results}=await db.prepare('SELECT * FROM cloud_history WHERE project_id = ? AND owner_id = ? ORDER BY created_at DESC, id LIMIT 51').bind(projectId,owner).all<HistoryRow>();return json({items:results.slice(0,50).map(pointSummary),truncated:results.length>50});}
  const current=await point(db,id,projectId,owner);if(!current)return fail(404,'버전을 찾을 수 없습니다.');if(match[3])return json(pointSummary(current));
  const file=await bucket.get(current.snapshot_key);if(!file||file.size!==current.snapshot_bytes)return fail(503,'버전 파일을 읽지 못했습니다.');
  return new Response(file.body,{headers:{...headers,'content-type':'application/octet-stream','content-length':String(file.size),'x-project-sha256':current.snapshot_sha256,'x-project-revision':String(current.revision)}});
 }
 if(match[3]||(!id&&method!=='POST')||(id&&!['PATCH','DELETE'].includes(method)))return fail(405,'지원하지 않는 버전 요청입니다.');
 let value;try{value=await body(request);}catch{return fail(400,'버전 요청이 올바르지 않습니다.');}
 if(!Number.isSafeInteger(value.expectedRevision)||(value.expectedRevision as number)<1||(value.expectedRevision as number)>=Number.MAX_SAFE_INTEGER)return fail(400,'저장 버전이 필요합니다.');
 if(id){
  const current=await point(db,id,projectId,owner);if(!current)return method==='DELETE'?json({deleted:true}):fail(404,'버전을 찾을 수 없습니다.');
  if(method==='DELETE'){
   if(!current.archived)return fail(409,'보관한 버전만 영구 삭제할 수 있습니다.');
   const result=await db.prepare('DELETE FROM cloud_history WHERE id = ? AND project_id = ? AND owner_id = ? AND revision = ? AND archived = 1').bind(id,projectId,owner,value.expectedRevision).run();
   if(!result.success)return fail(503,'삭제 결과를 확인하지 못했습니다.');if(!result.meta.changes)return fail(409,'다른 기기에서 버전을 변경했습니다.');
   // The immutable history archive is never a current-project pointer; remove only after confirmed deletion.
   try{await bucket.delete(current.snapshot_key);}catch{/* Unreferenced archive can be cleaned up later. */}return json({deleted:true});
  }
  if(typeof value.archived!=='boolean')return fail(400,'보관 상태가 필요합니다.');
  const result=await db.prepare('UPDATE cloud_history SET archived = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND project_id = ? AND owner_id = ? AND revision = ?').bind(value.archived?1:0,new Date().toISOString(),id,projectId,owner,value.expectedRevision).run();
  if(!result.success)return fail(503,'변경 결과를 확인하지 못했습니다.');if(!result.meta.changes)return fail(409,'다른 기기에서 버전을 변경했습니다.');return json(pointSummary((await point(db,id,projectId,owner))!));
 }
 if(typeof value.id!=='string'||!uuidPattern.test(value.id)||typeof value.label!=='string'||!value.label.trim()||value.label.trim().length>200||value.label.includes('\0'))return fail(400,'복원 지점 ID와 1~200자 이름이 필요합니다.');
 const existing=await point(db,value.id,projectId,owner);
 if(existing)return existing.label===value.label.trim()&&existing.source_revision===value.expectedRevision?json(pointSummary(existing)):fail(409,'같은 복원 지점 ID가 다른 기록에 사용됐습니다.');
 if(parent.archived||parent.revision!==value.expectedRevision)return fail(409,'클라우드 프로젝트가 바뀌었습니다. 목록을 새로고침해주세요.');
 const key=`users/${owner}/projects/${projectId}/history/${crypto.randomUUID()}.zip`;let publishing=false;
 try{
  const original=await bucket.get(parent.snapshot_key);if(!original||original.size!==parent.snapshot_bytes)throw new Error();
  const saved=await bucket.put(key,original.body,{sha256:parent.snapshot_sha256,httpMetadata:{contentType:'application/octet-stream'}});if(!saved||saved.size!==parent.snapshot_bytes)throw new Error();
  const now=new Date().toISOString();publishing=true;
  // One SQL statement checks the latest pointer and both quotas at publication, including concurrent captures.
  const result=await db.prepare('INSERT INTO cloud_history (id, project_id, owner_id, label, name, venue, source_project_id, source_revision, revision, snapshot_key, snapshot_sha256, snapshot_bytes, created_at, updated_at, archived) SELECT ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, 0 WHERE EXISTS (SELECT 1 FROM cloud_projects WHERE id = ? AND owner_id = ? AND revision = ? AND snapshot_key = ? AND archived = 0) AND (SELECT COUNT(*) FROM cloud_history WHERE project_id = ? AND owner_id = ?) < ? AND (SELECT COUNT(*) FROM cloud_history WHERE owner_id = ?) < ? AND COALESCE((SELECT SUM(snapshot_bytes) FROM cloud_history WHERE owner_id = ?), 0) + ? <= ? ON CONFLICT(id) DO NOTHING').bind(value.id,projectId,owner,value.label.trim(),parent.name,parent.venue,parent.source_project_id,parent.revision,key,parent.snapshot_sha256,parent.snapshot_bytes,now,now,projectId,owner,value.expectedRevision,parent.snapshot_key,projectId,owner,CLOUD_HISTORY_MAX_POINTS,owner,CLOUD_HISTORY_MAX_ACCOUNT_POINTS,owner,parent.snapshot_bytes,CLOUD_HISTORY_MAX_BYTES).run();
  if(!result.success)throw new Error();if(!result.meta.changes){await bucket.delete(key);const retried=await point(db,value.id,projectId,owner);if(retried&&retried.label===value.label.trim()&&retried.source_revision===value.expectedRevision)return json(pointSummary(retried));return fail(409,'프로젝트 변경 또는 버전 한도로 저장하지 못했습니다. 새로고침하거나 백업한 기록을 정리해주세요.');}
  const committed=await point(db,value.id,projectId,owner);if(!committed)throw new Error();return json(pointSummary(committed),201);
 }catch{
  if(!publishing)try{await bucket.delete(key);}catch{/* Retain any archive that might have a committed pointer. */}
  return fail(503,'버전 저장 결과를 확인하지 못했습니다. 같은 요청으로 다시 시도해주세요.');
 }
}
