import {parseArtworkTemplate,libraryImageBytes,type ArtworkTemplate} from '../domain/artworkLibrary';
export const ARTWORK_LIBRARY_MAX_ITEMS=500,ARTWORK_LIBRARY_MAX_BYTES=80*1024*1024;
export interface ArtworkLibraryInput {template:ArtworkTemplate;thumbnail:string;archived?:boolean}
export interface ArtworkLibrarySummary {id:string;name:string;artist:string;year:string;kind:ArtworkTemplate['kind'];dimensions:[number,number,number];artworkType?:string;presentationType?:string;medium:string;thumbnail:string;archived:boolean;revision:number;updatedAt:string;bytes:number}
export interface ArtworkLibraryBackup {format:'gonggan-artwork-library';schemaVersion:1;items:ArtworkLibraryInput[]}
const request=<T>(r:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
const finished=(tx:IDBTransaction)=>{const done=new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error??new Error('작품 저장을 취소했습니다.'));tx.onerror=()=>{};});void done.catch(()=>{});return done;};
const encodedSize=(v:unknown)=>new TextEncoder().encode(JSON.stringify(v)).length;
export function createArtworkLibrary(factory:IDBFactory=globalThis.indexedDB,name='gonggan-artwork-library-v1',limits={maxItems:ARTWORK_LIBRARY_MAX_ITEMS,maxBytes:ARTWORK_LIBRARY_MAX_BYTES}){
 let connection:Promise<IDBDatabase>|undefined;
 const open=()=>connection??=new Promise<IDBDatabase>((resolve,reject)=>{
  if(!factory){reject(new Error('이 브라우저에서는 작품 라이브러리를 저장할 수 없습니다.'));return;}
  const r=factory.open(name,1);r.onupgradeneeded=()=>{r.result.createObjectStore('documents',{keyPath:'id'});r.result.createObjectStore('summaries',{keyPath:'id'});};r.onerror=()=>{connection=undefined;reject(r.error);};r.onblocked=()=>{connection=undefined;reject(new Error('다른 탭을 닫고 작품 저장을 다시 시도하세요.'));};r.onsuccess=()=>{r.result.onversionchange=()=>{r.result.close();connection=undefined;};resolve(r.result);};
 });
 async function addBatch(inputs:ArtworkLibraryInput[],ids?:string[]){
  if(!inputs.length||inputs.length>limits.maxItems)throw new Error(`작품 라이브러리는 최대 ${limits.maxItems}개입니다.`);
  const prepared=inputs.map((input,index)=>{
   const template=parseArtworkTemplate(input.template);libraryImageBytes(input.thumbnail,128*1024,256);if(input.archived!==undefined&&typeof input.archived!=='boolean')throw new Error('작품 보관 상태가 올바르지 않습니다.');
   const a=template.artwork,id=ids?.[index]??crypto.randomUUID();
   const summary:ArtworkLibrarySummary={id,name:a.name,artist:a.artist,year:a.year??'',kind:template.kind,dimensions:[a.widthMm,a.heightMm,a.depthMm],artworkType:a.artworkType??(template.kind==='model'?template.artwork.kind:undefined),presentationType:a.presentationType,medium:a.medium??'',thumbnail:input.thumbnail,archived:input.archived??false,revision:1,updatedAt:new Date().toISOString(),bytes:encodedSize({template,thumbnail:input.thumbnail})+1024};
   return {document:{id,template},summary};
  });
  const db=await open(),tx=db.transaction(['documents','summaries'],'readwrite'),done=finished(tx);
  try{
   const old=await request(tx.objectStore('summaries').getAll()) as ArtworkLibrarySummary[];
   if(prepared.some(p=>old.some(s=>s.id===p.summary.id)))throw new Error('로컬 작품 ID가 이미 사용 중입니다.');
   if(old.length+prepared.length>limits.maxItems)throw new Error(`작품 라이브러리는 최대 ${limits.maxItems}개입니다. 보관된 작품도 포함합니다.`);
   if(old.reduce((n,s)=>n+s.bytes,0)+prepared.reduce((n,s)=>n+s.summary.bytes,0)>limits.maxBytes)throw new Error('작품 라이브러리 용량을 초과했습니다. 백업을 먼저 보관하세요.');
   for(const item of prepared){tx.objectStore('documents').put(item.document);tx.objectStore('summaries').put(item.summary);}await done;return prepared.map(p=>p.summary);
  }catch(error){try{tx.abort();}catch{/* Transaction already completed. */}await done.catch(()=>{});throw error;}
 }
 const repo={
  async add(input:ArtworkLibraryInput){return (await addBatch([input]))[0];},
  async importItem(input:ArtworkLibraryInput,id:string){return (await addBatch([input],[id]))[0];},
  async replace(id:string,input:ArtworkLibraryInput,expectedRevision:number){
   const template=parseArtworkTemplate(input.template);libraryImageBytes(input.thumbnail,128*1024,256);if(typeof input.archived!=='boolean')throw new Error('작품 보관 상태가 올바르지 않습니다.');
   const db=await open(),tx=db.transaction(['documents','summaries'],'readwrite'),done=finished(tx);try{const store=tx.objectStore('summaries'),all=await request(store.getAll()) as ArtworkLibrarySummary[],old=all.find(s=>s.id===id);if(!old||old.revision!==expectedRevision)throw new Error('다른 탭에서 로컬 작품을 변경했습니다.');
    const a=template.artwork,summary:ArtworkLibrarySummary={...old,name:a.name,artist:a.artist,year:a.year??'',kind:template.kind,dimensions:[a.widthMm,a.heightMm,a.depthMm],artworkType:a.artworkType??(template.kind==='model'?template.artwork.kind:undefined),presentationType:a.presentationType,medium:a.medium??'',thumbnail:input.thumbnail,archived:input.archived,revision:old.revision+1,updatedAt:new Date().toISOString(),bytes:encodedSize({template,thumbnail:input.thumbnail})+1024};
    if(all.reduce((n,s)=>n+s.bytes,0)-old.bytes+summary.bytes>limits.maxBytes)throw new Error('작품 라이브러리 용량을 초과했습니다.');tx.objectStore('documents').put({id,template});store.put(summary);await done;return summary;
   }catch(e){try{tx.abort();}catch{/* Already completed. */}await done.catch(()=>{});throw e;}
  },
  async list():Promise<ArtworkLibrarySummary[]>{const db=await open(),tx=db.transaction('summaries'),done=finished(tx),items=await request(tx.objectStore('summaries').getAll()) as ArtworkLibrarySummary[];await done;return items.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id));},
  async read(id:string){const db=await open(),tx=db.transaction(['documents','summaries']),done=finished(tx),[document,summary]=await Promise.all([request(tx.objectStore('documents').get(id)),request(tx.objectStore('summaries').get(id))]);await done;if(!document||!summary)return;return {template:parseArtworkTemplate(document.template),summary:summary as ArtworkLibrarySummary};},
  async archive(id:string,archived:boolean,revision:number){const db=await open(),tx=db.transaction('summaries','readwrite'),done=finished(tx);try{const summary=await request(tx.objectStore('summaries').get(id)) as ArtworkLibrarySummary|undefined;if(!summary)throw new Error('작품을 찾을 수 없습니다.');if(summary.revision!==revision)throw new Error('다른 탭에서 작품 목록을 변경했습니다. 다시 시도하세요.');tx.objectStore('summaries').put({...summary,archived,revision:revision+1,updatedAt:new Date().toISOString()});await done;}catch(error){try{tx.abort();}catch{/* Transaction already completed. */}await done.catch(()=>{});throw error;}},
  async backup():Promise<ArtworkLibraryBackup>{const db=await open(),tx=db.transaction(['documents','summaries']),done=finished(tx),[documents,summaries]=await Promise.all([request(tx.objectStore('documents').getAll()),request(tx.objectStore('summaries').getAll())]);await done;const byId=new Map(summaries.map((s:ArtworkLibrarySummary)=>[s.id,s]));const items=documents.map(d=>{const s=byId.get(d.id);if(!s)throw new Error('라이브러리 목록과 작품 데이터가 다릅니다.');return {template:parseArtworkTemplate(d.template),thumbnail:s.thumbnail,archived:s.archived};});return {format:'gonggan-artwork-library',schemaVersion:1,items};},
  async restore(value:unknown){const v=value as ArtworkLibraryBackup;if(!v||v.format!=='gonggan-artwork-library'||v.schemaVersion!==1||!Array.isArray(v.items)||encodedSize(v)>limits.maxBytes)throw new Error('라이브러리 백업 형식·용량이 올바르지 않습니다.');return addBatch(v.items);},
 };
 return repo;
}
let singleton:ReturnType<typeof createArtworkLibrary>|undefined;
export const artworkLibrary=()=>singleton??=createArtworkLibrary();
