import {canEditProject} from '../domain/collaboration';
import {copyProject} from '../domain/projects';
import {projectLibrary} from './projectLibrary';
import {openLocalProject} from './persistence';
import type {createCloudProjectClient} from './cloudProjectClient';
/** Create an independent local draft; retain the shared cloud ID only for authorized CAS saves. */
export async function openEditableCloudProject(client:ReturnType<typeof createCloudProjectClient>,id:string,userId:string,guard:()=>void){
 const downloaded=await client.read(id);guard();if(!canEditProject(downloaded.summary.role??'owner')||downloaded.summary.archived)throw new Error('현재 역할로 이 프로젝트를 편집할 수 없습니다.');
 const {readProjectBackup}=await import('./projectBackup'),loaded=await readProjectBackup(new File([downloaded.bytes],'cloud-project.zip',{type:'application/zip'}));guard();
 if(loaded.id!==downloaded.summary.sourceProjectId||loaded.name!==downloaded.summary.name||loaded.venue!==downloaded.summary.venue)throw new Error('클라우드 파일과 프로젝트 정보가 일치하지 않습니다.');
 const latest=await client.metadata(id);guard();if(latest.revision!==downloaded.summary.revision||!canEditProject(latest.role??'owner')||latest.archived)throw new Error('프로젝트 버전 또는 편집 권한이 변경됐습니다. 다시 열어주세요.');
 const next=copyProject(loaded,loaded.name),repo=projectLibrary(),stored=await repo.save(next,0,false);guard();
 await repo.saveCloudLink({userId,localProjectId:next.id,cloudProjectId:id,revision:latest.revision,localRevision:stored.revision,autoSync:true});guard();
 return openLocalProject(next.id);
}
