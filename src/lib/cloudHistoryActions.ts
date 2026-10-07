import type {Project} from '../domain/types';
import {importProjectPackage} from './projectPackage';
import {verifyProjectBackupImages} from './projectBackup';
import {CloudProjectError,type createCloudProjectClient} from './cloudProjectClient';
import type {createCloudHistoryClient} from './cloudHistoryClient';
import {projectVersionChanges} from '../domain/projectHistory';
/** A device creates its own local ID; the authenticated cloud parent is the version lineage. */
export const cloudHistoryChanges=(current:Project,version:Project)=>projectVersionChanges({...current,id:version.id},version);
export async function readCloudHistoryProject(history:ReturnType<typeof createCloudHistoryClient>,projectId:string,id:string,verify:(p:Project)=>Promise<void>=verifyProjectBackupImages){
 const version=await history.read(projectId,id),project=await importProjectPackage(version.bytes);
 if(project.id!==version.summary.sourceProjectId||project.name!==version.summary.name||project.venue!==version.summary.venue)throw new Error('버전 파일과 프로젝트 정보가 일치하지 않습니다.');
 await verify(project);return {...version,project};
}
/** Preserve the latest cloud state before conditional replacement. No local project is mutated here. */
export async function restoreCloudHistory(projects:ReturnType<typeof createCloudProjectClient>,history:ReturnType<typeof createCloudHistoryClient>,projectId:string,id:string,expectedRevision:number,guard:()=>void=()=>{},verify:(p:Project)=>Promise<void>=verifyProjectBackupImages){
 const version=await readCloudHistoryProject(history,projectId,id,verify);guard();const current=await projects.metadata(projectId);guard();
 if(current.archived||current.revision!==expectedRevision)throw new CloudProjectError('다른 기기에서 프로젝트를 변경했습니다. 새로고침 후 비교해주세요.',409);
 const safety=await history.capture(projectId,crypto.randomUUID(),'복원 전 자동 보관 · '+new Date().toLocaleString('ko-KR'),expectedRevision);guard();
 if(safety.sha256!==current.sha256||safety.bytes!==current.bytes)throw new Error('복원 전 안전 기록이 일치하지 않습니다.');
 const project=version.project,summary=await projects.save(projectId,expectedRevision,new Blob([version.bytes],{type:'application/zip'}),{name:project.name,venue:project.venue,sourceProjectId:project.id});guard();
 return {project,summary,safety};
}
