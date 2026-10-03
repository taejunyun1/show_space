import {parseProject} from '../domain/model';
import type {Project} from '../domain/types';
import {parseCloudLink,parseCloudPending,type CloudProjectLink,type CloudSavePending} from '../domain/cloudProject';

export interface ProjectSummary {id:string;name:string;venue:string;revision:number;createdAt:string;updatedAt:string;archived:boolean}
export interface StoredProject {project:Project;summary:ProjectSummary}
export class ProjectConflictError extends Error {
  constructor(){super('다른 탭에서 이 프로젝트를 변경했습니다. 현재 작업을 복사본으로 저장한 뒤 최신 프로젝트를 다시 열어주세요.');this.name='ProjectConflictError';}
}
const request=<T>(r:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
const finished=(tx:IDBTransaction)=>{const done=new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error??new Error('프로젝트 저장을 취소했습니다.'));tx.onerror=()=>{};});void done.catch(()=>{});return done;};

/** Small summaries and complete documents share one atomic transaction. Revisions prevent stale-tab overwrites. */
export function createProjectLibrary(factory:IDBFactory=globalThis.indexedDB,name='gonggan-project-library-v1') {
  let connection:Promise<IDBDatabase>|undefined;
  const open=()=>connection??=new Promise<IDBDatabase>((resolve,reject)=>{
    if(!factory){reject(new Error('이 브라우저에서 로컬 프로젝트 저장을 사용할 수 없습니다.'));return;}
    const r=factory.open(name,1);
    r.onupgradeneeded=()=>{r.result.createObjectStore('documents',{keyPath:'id'});r.result.createObjectStore('summaries',{keyPath:'id'});r.result.createObjectStore('settings');};
    r.onsuccess=()=>{r.result.onversionchange=()=>{r.result.close();connection=undefined;};resolve(r.result);};
    r.onerror=()=>{connection=undefined;reject(r.error);};
    r.onblocked=()=>{connection=undefined;reject(new Error('다른 탭을 닫고 프로젝트 저장을 다시 시도해주세요.'));};
  });
  return {
    async cloudLink(userId:string,id:string):Promise<CloudProjectLink|undefined>{const db=await open(),tx=db.transaction('settings'),done=finished(tx),value=await request(tx.objectStore('settings').get('cloud-link:'+JSON.stringify([userId,id])));await done;if(value===undefined)return;const link=parseCloudLink(value);if(link.userId!==userId||link.localProjectId!==id)throw new Error('클라우드 연결 계정이 다릅니다.');return link;},
    async cloudPending(userId:string,id:string):Promise<CloudSavePending|undefined>{const db=await open(),tx=db.transaction('settings'),done=finished(tx),value=await request(tx.objectStore('settings').get('cloud-pending:'+JSON.stringify([userId,id])));await done;if(value===undefined)return;const pending=parseCloudPending(value);if(pending.link.userId!==userId||pending.link.localProjectId!==id)throw new Error('클라우드 대기 작업 계정이 다릅니다.');return pending;},
    async saveCloudPending(value:CloudSavePending):Promise<void>{const pending=parseCloudPending(value),{link}=pending,key='cloud-pending:'+JSON.stringify([link.userId,link.localProjectId]),db=await open(),tx=db.transaction('settings','readwrite'),done=finished(tx),store=tx.objectStore('settings');
      const old=await request(store.get(key));if(old&&old.requestId!==pending.requestId){tx.abort();await done.catch(()=>{});throw new Error('다른 탭에서 업로드할 작업을 보관했습니다. 저장을 다시 시도해주세요.');}
      try{store.put(pending,key);await done;}catch(error){try{tx.abort();}catch{/* Already aborted. */}await done.catch(()=>{});throw error;}
    },
    async saveCloudLink(value:CloudProjectLink,pendingId?:string):Promise<void>{const link=parseCloudLink(value),key=JSON.stringify([link.userId,link.localProjectId]),db=await open(),tx=db.transaction('settings','readwrite'),done=finished(tx),store=tx.objectStore('settings');
      const [old,pending]=await Promise.all([request(store.get('cloud-link:'+key)),request(store.get('cloud-pending:'+key))]);
      if(pendingId&&(pending?.requestId!==pendingId||pending.link.cloudProjectId!==link.cloudProjectId)||(old&&old.revision>link.revision)){tx.abort();await done.catch(()=>{});throw new Error('다른 탭에서 클라우드 연결을 변경했습니다. 다시 시도해주세요.');}
      try{store.put({...link,autoSync:pendingId?pending.link.autoSync:link.autoSync},'cloud-link:'+key);if(pendingId)store.delete('cloud-pending:'+key);await done;}catch(error){try{tx.abort();}catch{/* Already aborted. */}await done.catch(()=>{});throw error;}
    },
    async setCloudAutoSync(userId:string,id:string,enabled:boolean):Promise<void>{const key=JSON.stringify([userId,id]),db=await open(),tx=db.transaction('settings','readwrite'),done=finished(tx),store=tx.objectStore('settings'),[raw,pending]=await Promise.all([request(store.get('cloud-link:'+key)),request(store.get('cloud-pending:'+key))]);
      if(raw){const link=parseCloudLink(raw);store.put({...link,autoSync:enabled},'cloud-link:'+key);}if(pending){const valid=parseCloudPending(pending);store.put({...valid,link:{...valid.link,autoSync:enabled}},'cloud-pending:'+key);}await done;
    },
    async list():Promise<ProjectSummary[]>{const db=await open(),tx=db.transaction('summaries'),done=finished(tx),items=await request(tx.objectStore('summaries').getAll());await done;return (items as ProjectSummary[]).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id));},
    async read(id:string):Promise<StoredProject|undefined>{const db=await open(),tx=db.transaction(['documents','summaries']),done=finished(tx);const [document,summary]=await Promise.all([request(tx.objectStore('documents').get(id)),request(tx.objectStore('summaries').get(id))]);await done;if(!document||!summary)return undefined;return {project:parseProject(document.project),summary};},
    async activeId():Promise<string|undefined>{const db=await open(),tx=db.transaction('settings'),done=finished(tx),id=await request(tx.objectStore('settings').get('active'));await done;return typeof id==='string'?id:undefined;},
    async activate(id:string):Promise<void>{const db=await open(),tx=db.transaction(['summaries','settings'],'readwrite'),done=finished(tx),s=await request(tx.objectStore('summaries').get(id));if(!s||s.archived){tx.abort();await done.catch(()=>{});throw new Error('열 수 있는 프로젝트가 없습니다.');}tx.objectStore('settings').put(id,'active');await done;},
    async save(value:Project,expectedRevision:number,activate=false):Promise<ProjectSummary>{
      const project=structuredClone(parseProject(value)),db=await open(),tx=db.transaction(['documents','summaries','settings'],'readwrite'),done=finished(tx),summaries=tx.objectStore('summaries');
      const previous=await request(summaries.get(project.id)) as ProjectSummary|undefined;
      if((previous?.revision??0)!==expectedRevision||previous?.archived){tx.abort();await done.catch(()=>{});throw new ProjectConflictError();}
      const now=new Date().toISOString(),summary:ProjectSummary={id:project.id,name:project.name,venue:project.venue,revision:expectedRevision+1,createdAt:previous?.createdAt??now,updatedAt:now,archived:false};
      try{tx.objectStore('documents').put({id:project.id,project});summaries.put(summary);if(activate)tx.objectStore('settings').put(project.id,'active');await done;return summary;}catch(error){try{tx.abort();}catch{/* The transaction may already be aborted. */}await done.catch(()=>{});throw error;}
    },
    async archive(id:string,archived:boolean,expectedRevision:number):Promise<void>{const db=await open(),tx=db.transaction(['summaries','settings'],'readwrite'),done=finished(tx),store=tx.objectStore('summaries');const [s,active]=await Promise.all([request(store.get(id)),request(tx.objectStore('settings').get('active'))]);if(!s||s.revision!==expectedRevision){tx.abort();await done.catch(()=>{});throw new ProjectConflictError();}if(archived&&active===id){tx.abort();await done.catch(()=>{});throw new Error('현재 프로젝트는 닫은 뒤 보관해주세요.');}store.put({...s,archived,revision:s.revision+1,updatedAt:new Date().toISOString()});await done;},
  };
}
let library:ReturnType<typeof createProjectLibrary>|undefined;
export const projectLibrary=()=>library??=createProjectLibrary();
