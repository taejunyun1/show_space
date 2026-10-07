import {parseMaterialTemplate,type MaterialTemplate} from '../domain/materialLibrary';
import {libraryImageBytes} from '../domain/artworkLibrary';
export const MATERIAL_LIBRARY_MAX_ITEMS=200,MATERIAL_LIBRARY_MAX_BYTES=32*1024*1024;
export interface MaterialLibraryItem {id:string;template:MaterialTemplate;archived:boolean;revision:number;updatedAt:string;bytes:number}
export type MaterialLibrarySummary=Omit<MaterialLibraryItem,'template'>&Pick<MaterialTemplate,'name'|'category'|'color'>&{textured:boolean;thumbnail?:string};
export interface MaterialLibraryBackup {format:'gonggan-material-library';schemaVersion:1;items:{template:MaterialTemplate;archived:boolean;thumbnail?:string}[]}
const size=(v:unknown)=>new TextEncoder().encode(JSON.stringify(v)).length;
const request=<T>(r:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
const finished=(tx:IDBTransaction)=>{const p=new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error??new Error('재질 저장을 취소했습니다.'));tx.onerror=()=>{};});void p.catch(()=>{});return p;};
export function createMaterialLibrary(factory:IDBFactory=globalThis.indexedDB,name='gonggan-material-library-v1',limits={maxItems:MATERIAL_LIBRARY_MAX_ITEMS,maxBytes:MATERIAL_LIBRARY_MAX_BYTES}){
 let connection:Promise<IDBDatabase>|undefined;
 const open=()=>connection??=new Promise<IDBDatabase>((resolve,reject)=>{
  if(!factory){reject(new Error('이 브라우저에서는 재질 라이브러리를 저장할 수 없습니다.'));return;}
  const r=factory.open(name,1);
  r.onupgradeneeded=()=>{r.result.createObjectStore('documents',{keyPath:'id'});r.result.createObjectStore('summaries',{keyPath:'id'});};
  r.onerror=()=>{connection=undefined;reject(r.error);};r.onblocked=()=>{connection=undefined;reject(new Error('다른 탭을 닫고 다시 시도하세요.'));};
  r.onsuccess=()=>{r.result.onversionchange=()=>{r.result.close();connection=undefined;};resolve(r.result);};
 });
 async function addBatch(inputs:MaterialLibraryBackup['items']){
  if(!inputs.length||inputs.length>limits.maxItems)throw new Error(`재질은 최대 ${limits.maxItems}개까지 저장합니다.`);
  const entries=inputs.map(input=>{
   if(typeof input?.archived!=='boolean')throw new Error('재질 보관 상태가 올바르지 않습니다.');
   const template=parseMaterialTemplate(input.template),id=crypto.randomUUID();
   if(input.thumbnail!==undefined)libraryImageBytes(input.thumbnail,128*1024,256);
   const summary:MaterialLibrarySummary={id,name:template.name,category:template.category,color:template.color,textured:!!(template.material.texture||template.material.normal),...(input.thumbnail?{thumbnail:input.thumbnail}:{}),archived:input.archived,revision:1,updatedAt:new Date().toISOString(),bytes:size({template,thumbnail:input.thumbnail})+1024};
   return {document:{id,template},summary};
  });
  const db=await open(),tx=db.transaction(['documents','summaries'],'readwrite'),done=finished(tx);
  try{
   const old=await request(tx.objectStore('summaries').getAll()) as MaterialLibrarySummary[];
   if(old.length+entries.length>limits.maxItems)throw new Error(`재질은 보관된 항목을 포함해 최대 ${limits.maxItems}개입니다.`);
   if(old.reduce((n,s)=>n+s.bytes,0)+entries.reduce((n,e)=>n+e.summary.bytes,0)>limits.maxBytes)throw new Error('재질 라이브러리 용량을 초과했습니다.');
   for(const e of entries){tx.objectStore('documents').put(e.document);tx.objectStore('summaries').put(e.summary);}await done;return entries.map(e=>e.summary);
  }catch(e){try{tx.abort();}catch{/* Already completed. */}await done.catch(()=>{});throw e;}
 }
 return {
  async add(template:MaterialTemplate,thumbnail?:string){return (await addBatch([{template,thumbnail,archived:false}]))[0];},
  async list():Promise<MaterialLibrarySummary[]>{const db=await open(),tx=db.transaction('summaries'),done=finished(tx),items=await request(tx.objectStore('summaries').getAll()) as MaterialLibrarySummary[];await done;return items.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id));},
  async read(id:string){const db=await open(),tx=db.transaction(['documents','summaries']),done=finished(tx),[document,summary]=await Promise.all([request(tx.objectStore('documents').get(id)),request(tx.objectStore('summaries').get(id))]);await done;if(!document||!summary)return;return {template:parseMaterialTemplate(document.template),summary:summary as MaterialLibrarySummary};},
  async archive(id:string,archived:boolean,revision:number){const db=await open(),tx=db.transaction('summaries','readwrite'),done=finished(tx);try{const s=await request(tx.objectStore('summaries').get(id)) as MaterialLibrarySummary|undefined;if(!s)throw new Error('재질을 찾을 수 없습니다.');if(s.revision!==revision)throw new Error('다른 탭에서 재질을 변경했습니다. 다시 시도하세요.');tx.objectStore('summaries').put({...s,archived,revision:s.revision+1,updatedAt:new Date().toISOString()});await done;}catch(e){try{tx.abort();}catch{/* Already completed. */}await done.catch(()=>{});throw e;}},
  async backup():Promise<MaterialLibraryBackup>{const db=await open(),tx=db.transaction(['documents','summaries']),done=finished(tx),[documents,summaries]=await Promise.all([request(tx.objectStore('documents').getAll()),request(tx.objectStore('summaries').getAll())]);await done;const byId=new Map(summaries.map((s:MaterialLibrarySummary)=>[s.id,s]));return {format:'gonggan-material-library',schemaVersion:1,items:documents.map(d=>{const s=byId.get(d.id);if(!s)throw new Error('재질 목록과 데이터가 다릅니다.');return {template:parseMaterialTemplate(d.template),archived:s.archived,...(s.thumbnail?{thumbnail:s.thumbnail}:{})};})};},
  async restore(value:unknown){const v=value as MaterialLibraryBackup;if(!v||v.format!=='gonggan-material-library'||v.schemaVersion!==1||!Array.isArray(v.items)||size(v)>limits.maxBytes)throw new Error('재질 백업 형식·용량이 올바르지 않습니다.');return addBatch(v.items);},
 };
}
let singleton:ReturnType<typeof createMaterialLibrary>|undefined;
export const materialLibrary=()=>singleton??=createMaterialLibrary();
