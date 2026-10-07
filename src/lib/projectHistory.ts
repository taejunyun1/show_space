import {importProjectPackage,PROJECT_PACKAGE_MAX_BYTES} from './projectPackage';
import type {RestorePointSummary} from '../domain/projectHistory';

export const HISTORY_MAX_BYTES=200*1024*1024,HISTORY_MAX_POINTS=50;
const request=<T>(r:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
const finished=(tx:IDBTransaction)=>{const p=new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error??new Error('버전 저장을 취소했습니다.'));tx.onerror=()=>{};});void p.catch(()=>{});return p;};
async function hash(data:ArrayBuffer){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(n=>n.toString(16).padStart(2,'0')).join('');}
interface Archive {id:string;data:ArrayBuffer;sha256:string;bytes:number;refs:number}

/** Immutable complete backups. Identical document/assets share one archive; no automatic eviction. */
export function createProjectHistory(factory:IDBFactory=globalThis.indexedDB,name='gonggan-project-history-v1',limits={bytes:HISTORY_MAX_BYTES,points:HISTORY_MAX_POINTS}){
 let connection:Promise<IDBDatabase>|undefined;
 const open=()=>connection??=new Promise<IDBDatabase>((resolve,reject)=>{
  if(!factory){reject(new Error('이 브라우저에서 버전 기록을 저장할 수 없습니다.'));return;}
  const r=factory.open(name,1);r.onupgradeneeded=()=>{r.result.createObjectStore('points',{keyPath:'id'}).createIndex('projectId','projectId');r.result.createObjectStore('archives',{keyPath:'id'});r.result.createObjectStore('settings');};
  r.onsuccess=()=>{r.result.onversionchange=()=>{r.result.close();connection=undefined;};resolve(r.result);};r.onerror=()=>{connection=undefined;reject(r.error);};r.onblocked=()=>{connection=undefined;reject(new Error('다른 탭의 버전 기록을 닫고 다시 시도해주세요.'));};
 });
 const readArchive=async(projectId:string,id:string)=>{
  const db=await open(),tx=db.transaction(['points','archives']),done=finished(tx),point=await request(tx.objectStore('points').get(id)) as RestorePointSummary|undefined;
  if(!point||point.projectId!==projectId){await done;throw new Error('이 프로젝트의 복원 지점을 찾을 수 없습니다.');}
  const archive=await request(tx.objectStore('archives').get(point.contentHash)) as Archive|undefined;await done;
  if(!archive||archive.data.byteLength!==archive.bytes||archive.bytes!==point.bytes||await hash(archive.data)!==archive.sha256)throw new Error('버전 자산이 없거나 손상됐습니다. 현재 작업은 유지됩니다.');
  return {point,archive};
 };
 return {
  async list(projectId:string){const db=await open(),tx=db.transaction('points'),done=finished(tx),points=await request(tx.objectStore('points').index('projectId').getAll(projectId)) as RestorePointSummary[];await done;return points.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id));},
  async usage(){const db=await open(),tx=db.transaction('settings'),done=finished(tx),bytes=await request(tx.objectStore('settings').get('bytes'));await done;return Number(bytes??0);},
  async add(projectId:string,label:string,sourceRevision:number,blob:Blob):Promise<RestorePointSummary>{
   if(!label.trim()||label.trim().length>200||!Number.isSafeInteger(sourceRevision)||sourceRevision<1)throw new Error('복원 지점 이름은 1~200자이며 저장된 프로젝트여야 합니다.');
   if(blob.size>PROJECT_PACKAGE_MAX_BYTES)throw new Error('복원 지점 하나는 80MB 이하여야 합니다.');
   const data=await blob.arrayBuffer(),project=await importProjectPackage(data);if(project.id!==projectId)throw new Error('복원 지점의 프로젝트가 다릅니다.');
   const contentHash=await hash(new TextEncoder().encode(JSON.stringify(project)).buffer as ArrayBuffer),sha256=await hash(data);
   const point:RestorePointSummary={id:crypto.randomUUID(),projectId,label:label.trim(),projectName:project.name,venue:project.venue,createdAt:new Date().toISOString(),sourceRevision,contentHash,bytes:data.byteLength,walls:project.walls.length,artworks:project.artworks.length+(project.unplacedArtworks?.length??0)+(project.modelArtworks?.length??0),scenes:project.scenes.length,archived:false};
   const db=await open(),tx=db.transaction(['points','archives','settings'],'readwrite'),done=finished(tx),points=tx.objectStore('points'),archives=tx.objectStore('archives'),settings=tx.objectStore('settings');
   try{
    const [count,old,total]=await Promise.all([request(points.index('projectId').count(projectId)),request(archives.get(contentHash)) as Promise<Archive|undefined>,request(settings.get('bytes')) as Promise<number|undefined>]);
    if(count>=limits.points)throw new Error(`프로젝트 버전은 ${limits.points}개까지 저장합니다. 백업한 불필요한 기록을 정리한 뒤 저장해주세요.`);
    if((total??0)+(old?0:data.byteLength)>limits.bytes)throw new Error('버전 기록의 로컬 저장 한도를 넘습니다. 백업한 불필요한 기록을 정리해주세요.');
    if(old)point.bytes=old.bytes;
    archives.put(old?{...old,refs:old.refs+1}:{id:contentHash,data,sha256,bytes:data.byteLength,refs:1});points.add(point);settings.put((total??0)+(old?0:data.byteLength),'bytes');await done;return point;
   }catch(e){try{tx.abort();}catch{/* Transaction already ended. */}await done.catch(()=>{});throw e;}
  },
  async read(projectId:string,id:string){const {point,archive}=await readArchive(projectId,id),project=await importProjectPackage(archive.data);if(project.id!==projectId)throw new Error('복원 지점의 프로젝트가 다릅니다.');return {point,project};},
  async backup(projectId:string,id:string){const {archive}=await readArchive(projectId,id);return new Blob([archive.data],{type:'application/octet-stream'});},
  async archive(projectId:string,id:string,archived:boolean){const db=await open(),tx=db.transaction('points','readwrite'),done=finished(tx),store=tx.objectStore('points'),point=await request(store.get(id)) as RestorePointSummary|undefined;if(!point||point.projectId!==projectId){tx.abort();await done.catch(()=>{});throw new Error('복원 지점을 찾을 수 없습니다.');}store.put({...point,archived});await done;},
  async remove(projectId:string,id:string){
   const db=await open(),tx=db.transaction(['points','archives','settings'],'readwrite'),done=finished(tx),points=tx.objectStore('points'),archives=tx.objectStore('archives'),settings=tx.objectStore('settings');
   try{const point=await request(points.get(id)) as RestorePointSummary|undefined;if(!point||point.projectId!==projectId)throw new Error('복원 지점을 찾을 수 없습니다.');
    const [archive,total]=await Promise.all([request(archives.get(point.contentHash)) as Promise<Archive|undefined>,request(settings.get('bytes')) as Promise<number|undefined>]);if(!archive)throw new Error('버전 자산을 찾을 수 없습니다.');
    points.delete(id);if(archive.refs===1){archives.delete(archive.id);settings.put(Math.max(0,(total??0)-archive.bytes),'bytes');}else archives.put({...archive,refs:archive.refs-1});await done;
   }catch(e){try{tx.abort();}catch{/* Transaction already ended. */}await done.catch(()=>{});throw e;}
  }
 };
}
let repository:ReturnType<typeof createProjectHistory>|undefined;
export const projectHistory=()=>repository??=createProjectHistory();
