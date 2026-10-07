import {parseLibraryDocument,libraryMetadata,type CloudLibraryDocument,type LibraryKind} from '../domain/cloudLibrary';
import {uuidPattern} from '../domain/cloudProject';
import {createCloudLibraryClient} from './cloudLibraryClient';
import {cloudPackageHash,CloudProjectError} from './cloudProjectClient';
import {libraryLinks,type createLibraryLinks,type LibraryLink} from './cloudLibraryLinks';
import {artworkLibrary,type createArtworkLibrary} from './artworkLibrary';
import {materialLibrary,type createMaterialLibrary} from './materialLibrary';

type Repositories={artwork:ReturnType<typeof createArtworkLibrary>;material:ReturnType<typeof createMaterialLibrary>};
export class LibraryConflictError extends Error {}
const mapping=(link:LibraryLink|undefined)=>link?{localId:link.localId,revision:link.remoteRevision}:null;
/** Account-scoped stable IDs also recover the first save/import after a lost acknowledgement. */
export async function libraryStableId(scope:string,user:string,kind:LibraryKind,id:string){
 if(!uuidPattern.test(user)||!uuidPattern.test(id))throw new Error('라이브러리 ID가 올바르지 않습니다.');
 const hash=await cloudPackageHash(new TextEncoder().encode(JSON.stringify([scope,user,kind,id])).buffer);
 const bytes=Uint8Array.from(hash.slice(0,32).match(/../g)!,h=>parseInt(h,16));bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;
 const s=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;
}
export async function validateCloudLibraryAssets(document:CloudLibraryDocument){
 if(document.kind==='artwork'){
  const {readArtworkLibraryBackup}=await import('./artworkLibraryMedia');await readArtworkLibraryBackup(new File([JSON.stringify({format:'gonggan-artwork-library',schemaVersion:1,items:[{template:document.template,thumbnail:document.thumbnail,archived:false}]})],'library.json'));
 }else{
  const {readMaterialLibraryBackup}=await import('./materialLibraryMedia');await readMaterialLibraryBackup(new File([JSON.stringify({format:'gonggan-material-library',schemaVersion:1,items:[{template:document.template,thumbnail:document.thumbnail,archived:false}]})],'library.json'));
  if(document.thumbnail){const {decodeMaterialImage}=await import('./materialLibraryMedia');await decodeMaterialImage(document.thumbnail);}
 }
}
export function createCloudLibrarySync(userId:string,client:ReturnType<typeof createCloudLibraryClient>,options:{repositories?:Repositories;links?:ReturnType<typeof createLibraryLinks>;guard?:()=>void;validate?:(d:CloudLibraryDocument)=>Promise<void>}={}){
 const repositories=options.repositories??{artwork:artworkLibrary(),material:materialLibrary()},links=options.links??libraryLinks(),guard=options.guard??(()=>{}),validate=options.validate??validateCloudLibraryAssets;
 async function local(kind:LibraryKind,id:string){
  if(kind==='artwork'){const f=await repositories.artwork.read(id);return f?{revision:f.summary.revision,archived:f.summary.archived,document:parseLibraryDocument({format:'gonggan-library-item',version:1,kind,template:f.template,thumbnail:f.summary.thumbnail})}:undefined;}
  const f=await repositories.material.read(id);return f?{revision:f.summary.revision,archived:f.summary.archived,document:parseLibraryDocument({format:'gonggan-library-item',version:1,kind,template:f.template,thumbnail:f.summary.thumbnail})}:undefined;
 }
 async function saveLocal(id:string,document:CloudLibraryDocument,archived:boolean,revision?:number){
  if(document.kind==='artwork'){const input={template:document.template,thumbnail:document.thumbnail,archived};return revision===undefined?repositories.artwork.importItem(input,id):repositories.artwork.replace(id,input,revision);}
  const input={template:document.template,thumbnail:document.thumbnail,archived};return revision===undefined?repositories.material.importItem(input,id):repositories.material.replace(id,input,revision);
 }
 const hash=async(document:CloudLibraryDocument)=>cloudPackageHash(new TextEncoder().encode(JSON.stringify(document)).buffer);
 return {
  async push(kind:LibraryKind,localId:string,asCopy=false){
   guard();const found=await local(kind,localId);if(!found)throw new Error('저장할 로컬 항목을 찾을 수 없습니다.');await validate(found.document);guard();
   const existingLink=await links.local(userId,kind,localId),link=asCopy?undefined:existingLink,id=asCopy?crypto.randomUUID():link?.remoteId??await libraryStableId('remote',userId,kind,localId),remoteLink=await links.remote(userId,kind,id);
   const blob=new Blob([JSON.stringify(found.document)],{type:'application/json'}),meta=libraryMetadata(found.document,localId,found.archived);
   if((await local(kind,localId))?.revision!==found.revision)throw new LibraryConflictError('저장 준비 중 로컬 항목이 변경됐습니다. 다시 시도해주세요.');guard();
   let summary;
   if(!link){
    try{const existing=await client.metadata(kind,id);if(existing.sha256!==await hash(found.document)||existing.bytes!==blob.size||existing.name!==meta.name||existing.detail!==meta.detail||existing.sourceItemId!==meta.sourceItemId||existing.archived!==meta.archived)throw new LibraryConflictError('계정에 이미 다른 버전이 있습니다. 가져와 비교한 뒤 저장해주세요.');summary=existing;}
    catch(e){if(!(e instanceof CloudProjectError&&e.status===404))throw e;}
   }
   guard();summary??=await client.save(kind,id,link?.remoteRevision??0,blob,meta);guard();
   await links.save({userId,kind,localId,remoteId:id,remoteRevision:summary.revision,localRevision:found.revision,sha256:summary.sha256},existingLink?.remoteRevision??0,mapping(remoteLink));guard();return summary;
  },
  async pull(kind:LibraryKind,id:string,asCopy=false){
   guard();const remoteLink=await links.remote(userId,kind,id),{bytes,summary}=await client.read(kind,id);guard();
   const document=parseLibraryDocument(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));if(document.kind!==kind)throw new Error('다른 종류의 라이브러리 파일입니다.');
   const derived=libraryMetadata(document,summary.sourceItemId,summary.archived);if(derived.name!==summary.name||derived.detail!==summary.detail)throw new Error('계정 항목 정보와 실제 자산이 다릅니다.');await validate(document);guard();
   const localId=asCopy?crypto.randomUUID():remoteLink?.localId??await libraryStableId('local',userId,kind,id),current=await local(kind,localId);
   const same=current&&JSON.stringify(current.document)===JSON.stringify(document)&&current.archived===summary.archived;
   if(!same&&current&&(!remoteLink||current.revision!==remoteLink.localRevision))throw new LibraryConflictError('로컬 항목도 수정됐습니다. 기존 항목을 보존하려면 새 로컬 복사본으로 가져오세요.');
   // Never overwrite a local edit with an older or unchanged cloud version.
   if(!asCopy&&!same&&current&&remoteLink&&summary.revision<=remoteLink.remoteRevision)throw new LibraryConflictError('계정 항목에 새 버전이 없습니다. 로컬 수정은 유지됩니다.');
   guard();const applied=same?{revision:current.revision}:await saveLocal(localId,document,summary.archived,current?.revision);guard();
   const localLink=await links.local(userId,kind,localId);if(localLink&&localLink.remoteId!==id)throw new LibraryConflictError('다른 계정 항목에 연결된 로컬 항목입니다.');
   await links.save({userId,kind,localId,remoteId:id,remoteRevision:summary.revision,localRevision:applied.revision,sha256:summary.sha256},localLink?.remoteRevision??0,mapping(remoteLink));guard();return {localId,unchanged:!!same};
  },
 };
}
