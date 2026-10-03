import {create} from 'zustand';
import type {Project} from '../domain/types';
import {cloudSession,useAuth} from './auth';
import {flushAutosave,useEditor} from './editor';
import {projectLibrary,ProjectConflictError} from '../lib/projectLibrary';
import {localProjectRevision} from '../lib/persistence';
import {createCloudProjectClient,CloudProjectError} from '../lib/cloudProjectClient';
import type {CloudSavePending} from '../domain/cloudProject';
type Status={projectId:string;userId:string;status:'saving'|'saved'|'queued'|'conflict'|'error';message:string};
export const useCloudSync=create<{current:Status|null}>(()=>({current:null}));
const jobs=new Map<string,Promise<void>>(),controllers=new Set<AbortController>();
const projectControllers=new Map<string,AbortController>();
export function cancelCloudProject(projectId:string){const userId=useAuth.getState().user?.id;if(userId)projectControllers.get(JSON.stringify([userId,projectId]))?.abort();}
const status=(projectId:string,userId:string,state:Status['status'],message='')=>{if(useEditor.getState().project.id===projectId&&useAuth.getState().user?.id===userId)useCloudSync.setState({current:{projectId,userId,status:state,message}});};
export async function syncCloudProject(project:Project,manual=false):Promise<void>{
 const currentUserId=useAuth.getState().user?.id;if(!currentUserId)throw new Error('계정 로그인이 필요합니다.');const userId:string=currentUserId;const key=JSON.stringify([userId,project.id]),previous=jobs.get(key);if(previous){await previous;return syncCloudProject(project,manual);}
 const controller=new AbortController();controllers.add(controller);projectControllers.set(key,controller);
 const guard=()=>{if(controller.signal.aborted)throw new Error('클라우드 작업을 취소했습니다. 저장 대기는 유지됩니다.');if(useAuth.getState().user?.id!==userId)throw new Error('계정이 바뀌어 클라우드 작업을 취소했습니다.');};
 const work=(async()=>{
  const repo=projectLibrary();let pending:CloudSavePending|undefined;
  try{
   guard();await flushAutosave();guard();let link=await repo.cloudLink(userId,project.id);pending=await repo.cloudPending(userId,project.id);
   if(!manual&&!(pending?.link.autoSync??link?.autoSync))return;if(pending?.blocked&&!manual){status(project.id,userId,'conflict','다른 기기의 변경과 충돌한 작업이 보관되어 있습니다.');return;}
   const session=await cloudSession();guard();if(session.userId!==userId)throw new Error('계정이 바뀌었습니다.');const client=createCloudProjectClient(session.token,fetch,controller.signal);
   async function send(job:CloudSavePending){guard();status(project.id,userId,'saving');const saved=await client.save(job.link.cloudProjectId,job.link.revision,job.file,job.metadata);guard();link={...job.link,revision:saved.revision};await repo.saveCloudLink(link,job.requestId);link=await repo.cloudLink(userId,project.id);status(project.id,userId,'saved');}
   if(pending){await send(pending);pending=undefined;}
   const stored=await repo.read(project.id);guard();if(!stored)throw new Error('로컬 프로젝트를 찾을 수 없습니다.');
   if(localProjectRevision(project.id)!==stored.summary.revision)throw new ProjectConflictError();
   if(link?.localRevision===stored.summary.revision)return;
   const {exportProjectBackup}=await import('../lib/projectBackup');status(project.id,userId,'saving');const file=await exportProjectBackup(stored.project);guard();
   pending={requestId:crypto.randomUUID(),link:{userId,localProjectId:project.id,cloudProjectId:link?.cloudProjectId??crypto.randomUUID(),revision:link?.revision??0,localRevision:stored.summary.revision,autoSync:link?.autoSync??manual},file,metadata:{name:stored.project.name,venue:stored.project.venue,sourceProjectId:stored.project.id}};
   await repo.saveCloudPending(pending);await send(pending);
  }catch(error){if(error instanceof ProjectConflictError||error instanceof CloudProjectError&&error.status===409){if(pending)await repo.saveCloudPending({...pending,blocked:true});status(project.id,userId,'conflict',error.message);}else status(project.id,userId,pending?'queued':'error',error instanceof Error?error.message:'클라우드 저장을 완료하지 못했습니다.');if(manual)throw error;}
 })();jobs.set(key,work);try{await work;}finally{jobs.delete(key);controllers.delete(controller);projectControllers.delete(key);}
}
export function startCloudAutosave():()=>void{
 let timer:ReturnType<typeof setTimeout>|undefined,last=useEditor.getState().project;
 const schedule=()=>{if(timer)clearTimeout(timer);const p=useEditor.getState().project;if(useAuth.getState().status!=='signedIn')return;timer=setTimeout(()=>{void syncCloudProject(p).catch(()=>{});},2000);};
 const stopEditor=useEditor.subscribe(s=>{if(s.hydrated&&s.project!==last){last=s.project;schedule();}});
 const stopAuth=useAuth.subscribe((s,previous)=>{if(s.user?.id!==previous.user?.id){for(const c of controllers)c.abort();useCloudSync.setState({current:null});schedule();}});
 const online=()=>schedule();window.addEventListener('online',online);schedule();return()=>{if(timer)clearTimeout(timer);stopEditor();stopAuth();window.removeEventListener('online',online);for(const c of controllers)c.abort();};
}
