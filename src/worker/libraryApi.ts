import type {ProjectDatabase,ProjectBucket} from './projectApi';
import {uuidPattern} from '../domain/cloudProject';
import {decodeLibraryMetadata,parseLibraryMetadata,CLOUD_LIBRARY_LIMITS,CLOUD_LIBRARY_ACCOUNT_BYTES,type LibraryKind,type CloudLibrarySummary} from '../domain/cloudLibrary';
interface Row {id:string;owner_id:string;kind:LibraryKind;metadata:string;archived:number;revision:number;snapshot_key:string;snapshot_sha256:string;snapshot_bytes:number;created_at:string;updated_at:string}
const headers={'cache-control':'no-store','x-content-type-options':'nosniff'},json=(v:unknown,status=200)=>Response.json(v,{status,headers}),fail=(status:number,error:string)=>json({error},status);
const summary=(r:Row):CloudLibrarySummary=>({...parseLibraryMetadata(JSON.parse(r.metadata)),archived:r.archived===1,id:r.id,kind:r.kind,revision:r.revision,sha256:r.snapshot_sha256,bytes:r.snapshot_bytes,createdAt:r.created_at,updatedAt:r.updated_at});
const row=(db:ProjectDatabase,owner:string,kind:string,id:string)=>db.prepare('SELECT * FROM cloud_library WHERE owner_id = ? AND kind = ? AND id = ?').bind(owner,kind,id).first<Row>();
export async function handleLibraryRequest(request:Request,db:ProjectDatabase,bucket:ProjectBucket,owner:string):Promise<Response>{
 const match=/^\/api\/libraries\/(artwork|material)(?:\/([0-9a-f-]{36})(\/meta)?)?$/.exec(new URL(request.url).pathname);if(!match||(match[2]&&!uuidPattern.test(match[2])))return fail(404,'라이브러리 항목을 찾을 수 없습니다.');
 const kind=match[1] as LibraryKind,id=match[2],method=request.method,limit=CLOUD_LIBRARY_LIMITS[kind];
 if(!id){if(method!=='GET')return fail(405,'지원하지 않는 요청입니다.');const {results}=await db.prepare('SELECT * FROM cloud_library WHERE owner_id = ? AND kind = ? ORDER BY updated_at DESC, id LIMIT ?').bind(owner,kind,limit.items+1).all<Row>();return json({items:results.slice(0,limit.items).map(summary),truncated:results.length>limit.items});}
 const current=await row(db,owner,kind,id);
 if(method==='GET'){
  if(!current)return fail(404,'라이브러리 항목을 찾을 수 없습니다.');if(match[3])return json(summary(current));const file=await bucket.get(current.snapshot_key);if(!file||file.size!==current.snapshot_bytes)return fail(503,'라이브러리 파일을 읽지 못했습니다.');return new Response(file.body,{headers:{...headers,'content-type':'application/octet-stream','content-length':String(file.size),'x-library-sha256':current.snapshot_sha256,'x-library-revision':String(current.revision)}});
 }
 if(match[3])return fail(405,'지원하지 않는 요청입니다.');
 if(method==='PATCH'){
  if(!current)return fail(404,'라이브러리 항목을 찾을 수 없습니다.');const length=Number(request.headers.get('content-length'));if(!Number.isSafeInteger(length)||length<1||length>1024)return fail(400,'보관 요청이 올바르지 않습니다.');let v;try{const b=await request.arrayBuffer();if(b.byteLength!==length)throw new Error();v=JSON.parse(new TextDecoder().decode(b));}catch{return fail(400,'보관 요청이 올바르지 않습니다.');}
  if(!v||typeof v.archived!=='boolean'||!Number.isSafeInteger(v.expectedRevision)||v.expectedRevision<1||v.expectedRevision>=Number.MAX_SAFE_INTEGER)return fail(400,'보관 상태와 저장 버전이 필요합니다.');
  const r=await db.prepare('UPDATE cloud_library SET archived = ?, revision = revision + 1, updated_at = ? WHERE owner_id = ? AND kind = ? AND id = ? AND revision = ?').bind(v.archived?1:0,new Date().toISOString(),owner,kind,id,v.expectedRevision).run();if(!r.success)return fail(503,'보관 결과를 확인하지 못했습니다.');if(!r.meta.changes)return fail(409,'다른 기기에서 라이브러리를 변경했습니다. 새로고침해주세요.');return json(summary((await row(db,owner,kind,id))!));
 }
 if(method!=='PUT')return fail(405,'지원하지 않는 요청입니다.');
 const expected=Number(request.headers.get('x-expected-revision')),length=Number(request.headers.get('content-length')),hash=request.headers.get('x-library-sha256');
 if(!request.headers.has('x-expected-revision')||!Number.isSafeInteger(expected)||expected<0||expected>=Number.MAX_SAFE_INTEGER)return fail(400,'저장 버전이 필요합니다.');
 if(!request.headers.has('content-length'))return fail(411,'파일 길이가 필요합니다.');if(!Number.isSafeInteger(length)||length<2||length>limit.bytes)return fail(413,'라이브러리 파일 용량을 초과했습니다.');
 if(request.headers.get('content-type')!=='application/json'||!hash||!/^[0-9a-f]{64}$/.test(hash)||!request.body)return fail(400,'라이브러리 파일과 해시가 필요합니다.');
 let meta;try{meta=decodeLibraryMetadata(request.headers.get('x-library-metadata'));}catch{return fail(400,'라이브러리 정보가 올바르지 않습니다.');}
 if(current&&current.revision===expected+1&&current.snapshot_sha256===hash&&current.snapshot_bytes===length&&current.metadata===JSON.stringify(meta)&&current.archived===(meta.archived?1:0))return json(summary(current));
 if(current&&current.revision!==expected)return fail(409,'다른 기기에서 항목을 변경했습니다. 계정 항목을 가져오거나 새 복사본으로 보존해주세요.');if(!current&&expected!==0)return fail(404,'라이브러리 항목을 찾을 수 없습니다.');
 const key=`users/${owner}/libraries/${kind}/${id}/${crypto.randomUUID()}.json`;let publishing=false;
 try{
  const saved=await bucket.put(key,request.body,{sha256:hash,httpMetadata:{contentType:'application/octet-stream'}});if(!saved||saved.size!==length)throw new Error();
  const prefix=await bucket.get(key,{range:{offset:0,length:1}});if(!prefix||new Uint8Array(await new Response(prefix.body).arrayBuffer())[0]!==123){await bucket.delete(key);return fail(400,'라이브러리 JSON 파일이 아닙니다.');}
  const now=new Date().toISOString();publishing=true;
  const r=current?await db.prepare('UPDATE cloud_library SET metadata = ?, archived = ?, revision = revision + 1, snapshot_key = ?, snapshot_sha256 = ?, snapshot_bytes = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND kind = ? AND revision = ? AND COALESCE((SELECT SUM(snapshot_bytes) FROM cloud_library WHERE owner_id = ?),0) - snapshot_bytes + ? <= ?').bind(JSON.stringify(meta),meta.archived?1:0,key,hash,length,now,id,owner,kind,expected,owner,length,CLOUD_LIBRARY_ACCOUNT_BYTES).run():await db.prepare('INSERT INTO cloud_library (id,owner_id,kind,metadata,archived,revision,snapshot_key,snapshot_sha256,snapshot_bytes,created_at,updated_at) SELECT ?,?,?,?,?,1,?,?,?,?,? WHERE (SELECT COUNT(*) FROM cloud_library WHERE owner_id = ? AND kind = ?) < ? AND COALESCE((SELECT SUM(snapshot_bytes) FROM cloud_library WHERE owner_id = ?),0) + ? <= ? ON CONFLICT(id) DO NOTHING').bind(id,owner,kind,JSON.stringify(meta),meta.archived?1:0,key,hash,length,now,now,owner,kind,limit.items,owner,length,CLOUD_LIBRARY_ACCOUNT_BYTES).run();
  if(!r.success)throw new Error();if(!r.meta.changes){await bucket.delete(key);return current?fail(409,'다른 기기 변경 또는 계정 용량 한도로 저장하지 못했습니다.'):fail(409,'항목 ID 또는 계정 라이브러리 한도로 저장하지 못했습니다.');}
  const committed=await row(db,owner,kind,id);if(!committed)throw new Error();if(current)try{await bucket.delete(current.snapshot_key);}catch{/* Old unreferenced file cleanup is best effort. */}return json(summary(committed),current?200:201);
 }catch{if(!publishing)try{await bucket.delete(key);}catch{/* Never remove a possibly referenced object. */}return fail(503,'라이브러리 저장 결과를 확인하지 못했습니다. 다시 시도해주세요.');}
}
