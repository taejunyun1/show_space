import type {Project} from '../domain/types';
import {projectHistory,type createProjectHistory} from './projectHistory';
import {projectLibrary,ProjectConflictError,type StoredProject} from './projectLibrary';
import {replaceLocalProject} from './persistence';
import {exportProjectBackup,verifyProjectBackupImages} from './projectBackup';
import {importProjectPackage} from './projectPackage';
import {projectVersionChanges} from '../domain/projectHistory';

interface RestoreDependencies {
 history:ReturnType<typeof createProjectHistory>;readCurrent:(id:string)=>Promise<StoredProject|undefined>;
 saveCurrent:(project:Project,revision:number,guard?:()=>void)=>Promise<Project>;pack:(project:Project)=>Promise<Blob>;verify:(project:Project)=>Promise<void>;
}
/** Restoring is conditional on the acknowledged revision, and never loses the pre-restore document. */
export async function restoreProjectVersion(projectId:string,pointId:string,expectedRevision:number,deps:RestoreDependencies={history:projectHistory(),readCurrent:id=>projectLibrary().read(id),saveCurrent:replaceLocalProject,pack:exportProjectBackup,verify:verifyProjectBackupImages},guard:()=>void=()=>{}){
 guard();const restored=await deps.history.read(projectId,pointId);guard();await deps.verify(restored.project);guard();
 const current=await deps.readCurrent(projectId);guard();if(!current||current.summary.archived||current.summary.revision!==expectedRevision)throw new ProjectConflictError();
 const backup=await deps.pack(current.project);guard();await deps.history.add(projectId,'복원 전 자동 보관 · '+new Date().toLocaleString('ko-KR'),expectedRevision,backup);guard();
 const saved=await deps.saveCurrent(restored.project,expectedRevision,guard);guard();return saved;
}

/** Resolve bundled sample images to the same embedded form used by durable versions. */
export async function compareProjectHistory(current:Project,version:Project,pack:(project:Project)=>Promise<Blob>=exportProjectBackup){const blob=await pack(structuredClone(current));return projectVersionChanges(await importProjectPackage(await blob.arrayBuffer()),version);}
