import type {ProjectDatabase,ProjectEnv} from './projectApi';
import {projectAccess} from './projectAccess';
import {handleCommentRequest} from './commentApi';
import {canCommentProject} from '../domain/collaboration';
import {ReviewError,type ReviewAnchor} from '../domain/reviewComments';
import {uuidPattern} from '../domain/cloudProject';
/** Private team opinions live outside Project Notes and outside every public link. */
export async function handleTeamCommentRequest(request:Request,env:ProjectEnv,db:ProjectDatabase,user:{id:string;email:string}){
 const match=/^\/api\/projects\/([0-9a-f-]{36})\/comments(?:\/([0-9a-f-]{36}))?$/.exec(new URL(request.url).pathname);
 if(!match||!uuidPattern.test(match[1]))return Response.json({error:'의견 주소를 찾을 수 없습니다.'},{status:404,headers:{'cache-control':'no-store'}});
 const id=match[1],access=await projectAccess(db,id,user.id);if(!access)return Response.json({error:'프로젝트를 찾을 수 없습니다.'},{status:404,headers:{'cache-control':'no-store'}});
 const entry=async()=>{const latest=await projectAccess(db,id,user.id);return latest?{ownerId:latest.row.owner_id,status:'active' as const,commentsEnabled:true,canComment:!latest.row.archived&&canCommentProject(latest.role)}:null;};
 const constraint=access.role==='owner'?{sql:' AND EXISTS (SELECT 1 FROM cloud_projects p WHERE p.id = ? AND p.owner_id = ? AND p.archived = 0)',values:[id,user.id]}:{sql:' AND EXISTS (SELECT 1 FROM project_members m JOIN cloud_projects p ON p.id = m.project_id WHERE m.project_id = ? AND m.user_id = ? AND m.revoked = 0 AND m.revision = ? AND m.role IN (\'editor\',\'commenter\') AND p.archived = 0)',values:[id,user.id,access.memberRevision]};
 return handleCommentRequest(request,env,'project:'+id,match[2],{entry,snapshot:async()=>null,legacy:()=>false,actor:user,writeConstraint:constraint,anchor:async(input):Promise<ReviewAnchor>=>{
  const v=input as Record<string,unknown>;if(!v||v.kind!=='project'||v.sceneId!==null)throw new ReviewError('비공개 공동 프로젝트 의견은 전시 전체에 남깁니다.');
  return {kind:'project',sceneId:null,label:access.row.name,sceneName:'공동 프로젝트'};
 }},fetch);
}
