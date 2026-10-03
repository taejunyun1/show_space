import { get } from 'idb-keyval'
import type { Project } from '../domain/types'
import {createDemoProject,parseProject} from '../domain/model'
import {projectLibrary,ProjectConflictError,type StoredProject} from './projectLibrary'

export const DRAFT_KEY = 'gonggan-project-v1'

type Reader = (key: string) => Promise<unknown>
type Writer = (key: string, value: unknown) => Promise<unknown>

const revisions=new Map<string,number>();
/** Revision acknowledged by this tab, rather than another tab's latest document. */
export const localProjectRevision=(id:string)=>revisions.get(id);
let activeId:string|undefined;
const remember=(stored:StoredProject)=>{revisions.set(stored.project.id,stored.summary.revision);activeId=stored.project.id;return stored.project;};
export async function readDraft(reader?: Reader): Promise<unknown> {
  if(reader)return reader(DRAFT_KEY);
  const library=projectLibrary(),id=await library.activeId();
  if(id){const stored=await library.read(id);if(!stored||stored.summary.archived)throw new Error('마지막 프로젝트를 찾을 수 없습니다. 프로젝트 목록에서 다시 열어주세요.');return remember(stored);}
  const legacy=await get(DRAFT_KEY),project=legacy===undefined?createDemoProject():parseProject(legacy);
  try{const summary=await library.save(project,0,true);return remember({project,summary});}catch(error){if(!(error instanceof ProjectConflictError))throw error;const stored=await library.read(project.id);if(!stored)throw error;return remember(stored);}
}

export async function writeDraft(project: Project, writer?: Writer): Promise<void> {
  if(writer){await writer(DRAFT_KEY,structuredClone(project));return;}
  const summary=await projectLibrary().save(project,revisions.get(project.id)??0,activeId!==project.id);
  revisions.set(project.id,summary.revision);activeId=project.id;
}
export async function openLocalProject(id:string):Promise<Project>{const stored=await projectLibrary().read(id);if(!stored||stored.summary.archived)throw new Error('프로젝트를 찾을 수 없습니다.');await projectLibrary().activate(id);return remember(stored);}
export async function saveNewLocalProject(project:Project):Promise<Project>{const summary=await projectLibrary().save(project,0,true);return remember({project,summary});}
