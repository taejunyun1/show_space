import {copyProject} from '../domain/projects';
import {importProjectPackage} from './projectPackage';
import {verifyProjectBackupImages} from './projectBackup';
import {projectLibrary,type createProjectLibrary} from './projectLibrary';
import type {createCloudProjectClient} from './cloudProjectClient';
import type {Project} from '../domain/types';
type LocalArchiveRepository=Pick<ReturnType<typeof createProjectLibrary>,'read'|'save'>;
export async function readLocalArchiveProject(id:string,expectedRevision:number,repository:LocalArchiveRepository=projectLibrary()){
 const stored=await repository.read(id);if(!stored)throw new Error('아카이브 프로젝트를 찾을 수 없습니다.');
 if(stored.summary.revision!==expectedRevision)throw new Error('다른 탭에서 프로젝트를 변경했습니다. 아카이브 목록을 새로고침해 주세요.');
 if(stored.project.id!==id||stored.summary.id!==id||stored.project.name!==stored.summary.name||stored.project.venue!==stored.summary.venue)throw new Error('아카이브 파일과 프로젝트 정보가 일치하지 않습니다.');
 return stored;
}
export async function readCloudArchiveProject(client:ReturnType<typeof createCloudProjectClient>,id:string,expectedRevision:number,guard:()=>void=()=>{},verify:(p:Project)=>Promise<void>=verifyProjectBackupImages){
 guard();const stored=await client.read(id);guard();if(stored.summary.revision!==expectedRevision)throw new Error('다른 기기에서 프로젝트를 변경했습니다. 아카이브 목록을 새로고침해 주세요.');
 const project=await importProjectPackage(stored.bytes);guard();
 if(project.id!==stored.summary.sourceProjectId||project.name!==stored.summary.name||project.venue!==stored.summary.venue)throw new Error('아카이브 파일과 계정 프로젝트 정보가 일치하지 않습니다.');
 await verify(project);guard();return {project,summary:stored.summary};
}
/** Preserve all exhibition records in a new ID; never activate or replace the source. */
export async function saveArchiveCopy(source:Project,name:string,repository:LocalArchiveRepository=projectLibrary(),guard:()=>void=()=>{}){
 guard();const clean=name.trim();if(!clean||clean.length>200)throw new Error('새 프로젝트 이름은 1~200자로 입력해 주세요.');
 const project=copyProject(source,clean);guard();const summary=await repository.save(project,0,false);guard();return {project,summary};
}
