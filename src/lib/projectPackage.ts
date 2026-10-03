import JSZip from 'jszip';
import {parseProject} from '../domain/model';
import type {Project} from '../domain/types';

export const PROJECT_PACKAGE_MAX_BYTES=80*1024*1024;
const MAX_ASSETS=2000,MAX_FILES=MAX_ASSETS+3;
const encode=(value:string)=>new TextEncoder().encode(value);
const decode=(bytes:Uint8Array)=>new TextDecoder('utf-8',{fatal:true}).decode(bytes);
const hashPattern=/^[0-9a-f]{64}$/;
const types:Record<string,string>={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','model/gltf-binary':'glb'};
export interface PackageAsset {path:string;mime:string;bytes:number;sha256:string}
interface Manifest {format:'gonggan-project-backup';version:1;project:{path:'project.json';bytes:number;sha256:string};assets:PackageAsset[]}
type Slot={object:Record<string,unknown>;key:string;kind:'image'|'model'};

/** Only schema-defined asset fields are rewritten. Notes and arbitrary strings stay intact. */
function assetSlots(input:unknown):Slot[]{
 const slots:Slot[]=[];
 const object=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('백업 프로젝트 구조가 올바르지 않습니다.');return value as Record<string,unknown>;};
 const list=(value:unknown):unknown[]=>{if(!Array.isArray(value))throw new Error('백업 작품/Scene 목록이 올바르지 않습니다.');return value;};
 const artworks=(value:unknown)=>{for(const item of list(value))slots.push({object:object(item),key:'imageUrl',kind:'image'});};
 const model=(value:unknown)=>{if(value!==undefined)slots.push({object:object(value),key:'dataUrl',kind:'model'});};
 const project=object(input);artworks(project.artworks);if(project.unplacedArtworks!==undefined)artworks(project.unplacedArtworks);model(project.referenceModel);
 if(project.planImageUrl!==undefined)slots.push({object:project,key:'planImageUrl',kind:'image'});
 if(project.sourcePlan!==undefined)slots.push({object:object(project.sourcePlan),key:'imageUrl',kind:'image'});
 for(const value of list(project.scenes)){const scene=object(value);artworks(scene.artworks);if(scene.structure!==undefined){const structure=object(scene.structure);artworks(structure.unplacedArtworks);model(structure.referenceModel);}}
 return slots;
}
async function sha256(bytes:Uint8Array){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes.slice().buffer as ArrayBuffer))].map(n=>n.toString(16).padStart(2,'0')).join('');}
function fromDataUrl(value:string){
 const match=/^data:([^;,]+);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
 if(!match||!types[match[1]])throw new Error('백업 자산 형식이 올바르지 않습니다.');
 let bytes:Uint8Array;try{bytes=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0));}catch{throw new Error('백업 자산 데이터가 손상됐습니다.');}
 checkSignature(bytes,match[1]);return {mime:match[1],bytes};
}
function checkSignature(b:Uint8Array,mime:string){
 const starts=(values:number[])=>values.every((n,i)=>b[i]===n);
 const valid=mime==='image/png'?starts([137,80,78,71,13,10,26,10]):mime==='image/jpeg'?starts([255,216,255]):mime==='image/webp'?starts([82,73,70,70])&&b.length>=12&&decode(b.slice(8,12))==='WEBP':mime==='model/gltf-binary'?starts([103,108,84,70]):false;
 if(!valid)throw new Error('백업 자산의 실제 파일 형식이 일치하지 않습니다.');
}
function dataUrl(bytes:Uint8Array,mime:string){let raw='';for(let i=0;i<bytes.length;i+=32768)raw+=String.fromCharCode(...bytes.subarray(i,i+32768));return `data:${mime};base64,${btoa(raw)}`;}

export async function exportProjectPackage(project:Project,resolveSample:(url:string)=>Promise<string>,onProgress:(message:string)=>void=()=>{}):Promise<Blob>{
 const document=parseProject(project),slots=assetSlots(document),cache=new Map<string,string>(),urls=new Map<string,string>(),assets=new Map<string,{meta:PackageAsset;bytes:Uint8Array}>();
 let restoredSize=encode(JSON.stringify(document)).length;
 if(restoredSize>PROJECT_PACKAGE_MAX_BYTES)throw new Error('복원 프로젝트가 80MB를 넘습니다. 사용하지 않는 Scene이나 모델을 정리해주세요.');
 const restored=structuredClone(document);const restoredSlots=assetSlots(restored);
 for(const [index,slot] of slots.entries()){
  onProgress(`백업 자산 준비 중 · ${index+1}/${slots.length}`);
  const value=slot.object[slot.key];if(typeof value!=='string')throw new Error('백업 자산 참조가 올바르지 않습니다.');
  let pointer=cache.get(value);
  if(!pointer){
   const embedded=value.startsWith('/artworks/')?await resolveSample(value):value;
   const {mime,bytes}=fromDataUrl(embedded);if((slot.kind==='model')!==(mime==='model/gltf-binary'))throw new Error('백업 자산 종류가 일치하지 않습니다.');
   const hash=await sha256(bytes),path=`assets/${slot.kind==='model'?'models':'images'}/${hash}.${types[mime]}`;
   pointer=`gonggan-asset:${path}`;
   if(!assets.has(path))assets.set(path,{meta:{path,mime,bytes:bytes.byteLength,sha256:hash},bytes});
   if(assets.size>MAX_ASSETS)throw new Error('백업 자산은 2,000개 이하여야 합니다.');
   cache.set(value,pointer);
  }
  slot.object[slot.key]=pointer;
  const asset=assets.get(pointer.slice('gonggan-asset:'.length))!;
  let url=urls.get(asset.meta.path);if(!url){url=dataUrl(asset.bytes,asset.meta.mime);urls.set(asset.meta.path,url);}
  restoredSize+=url.length-value.length;
  if(restoredSize>PROJECT_PACKAGE_MAX_BYTES)throw new Error('복원 프로젝트가 80MB를 넘습니다. 사용하지 않는 Scene이나 모델을 정리해주세요.');
  restoredSlots[index].object[restoredSlots[index].key]=url;
 }
 parseProject(restored);
 if(encode(JSON.stringify(restored)).length>PROJECT_PACKAGE_MAX_BYTES)throw new Error('복원 프로젝트가 80MB를 넘습니다. 사용하지 않는 Scene이나 모델을 정리해주세요.');
 const bytes=encode(JSON.stringify(document)),manifest:Manifest={format:'gonggan-project-backup',version:1,project:{path:'project.json',bytes:bytes.byteLength,sha256:await sha256(bytes)},assets:[...assets.values()].map(a=>a.meta)};
 const zip=new JSZip();zip.file('project.json',bytes);zip.file('manifest.json',JSON.stringify(manifest,null,2));
 zip.file('README.txt','공간 · 프로젝트 자산 백업\n\n공간 앱 상단 불러오기 → 저장 프로젝트 → 이 .gonggan.zip 파일을 선택하세요. 압축을 풀 필요가 없습니다.\n모든 Scene·숨김/미배치 작품·치수·내부 메모·저장된 도면 이미지·참고 GLB를 포함합니다.\n프로젝트에 저장되지 않은 원본 업로드 PDF/JPG 파일, Undo 기록, 공유 링크 관리 정보는 포함하지 않습니다.\n이 파일에는 비공개 메모도 포함되므로 공개 전시 전달에는 공유 링크·PDF·glTF를 사용하세요.\nproject.json의 자산 포인터는 이 ZIP의 manifest.json과 assets 폴더로 함께 복원합니다.\n');
 for(const asset of assets.values())zip.file(asset.meta.path,asset.bytes,{createFolders:false});
 const packed=await zip.generateAsync({type:'uint8array',compression:'DEFLATE',compressionOptions:{level:3}},m=>onProgress(`프로젝트 묶는 중 · ${Math.round(m.percent)}%`));
 inspectArchive(packed);
 return new Blob([packed.slice().buffer as ArrayBuffer],{type:'application/octet-stream'});
}

/** Inspect the classic ZIP central directory before the decompressor allocates any output. */
function inspectArchive(bytes:Uint8Array){
 if(bytes.length<22||bytes.length>PROJECT_PACKAGE_MAX_BYTES)throw new Error('프로젝트 백업 ZIP은 올바른 파일이며 80MB 이하여야 합니다.');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),names=new Map<string,number>();let eocd=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50&&i+22+view.getUint16(i+20,true)===bytes.length){eocd=i;break;}
 if(eocd<0||view.getUint16(eocd+4,true)||view.getUint16(eocd+6,true)||view.getUint16(eocd+8,true)!==view.getUint16(eocd+10,true))throw new Error('분할되거나 손상된 ZIP은 지원하지 않습니다.');
 const count=view.getUint16(eocd+10,true),length=view.getUint32(eocd+12,true),start=view.getUint32(eocd+16,true);
 if(count<3||count>MAX_FILES||start+length!==eocd)throw new Error('백업 ZIP의 파일 수/구조 제한을 초과했습니다.');
 let pos=start,total=0;
 for(let i=0;i<count;i++){
  if(pos+46>eocd||view.getUint32(pos,true)!==0x02014b50)throw new Error('백업 ZIP 파일 목록이 손상됐습니다.');
  const flags=view.getUint16(pos+8,true),method=view.getUint16(pos+10,true),compressed=view.getUint32(pos+20,true),size=view.getUint32(pos+24,true),nameLength=view.getUint16(pos+28,true),extra=view.getUint16(pos+30,true),comment=view.getUint16(pos+32,true),offset=view.getUint32(pos+42,true),end=pos+46+nameLength+extra+comment;
  if(end>eocd||view.getUint16(pos+34,true)||flags&1||![0,8].includes(method)||compressed===0xffffffff||size===0xffffffff||offset===0xffffffff||offset+30>start)throw new Error('암호화·ZIP64 또는 손상된 백업 ZIP은 지원하지 않습니다.');
  const name=decode(bytes.subarray(pos+46,pos+46+nameLength));
  if(!/^(manifest\.json|project\.json|README\.txt|assets\/(images\/[0-9a-f]{64}\.(png|jpg|webp)|models\/[0-9a-f]{64}\.glb))$/.test(name)||names.has(name))throw new Error('백업 ZIP에 잘못되거나 중복된 파일 경로가 있습니다.');
  if(view.getUint32(offset,true)!==0x04034b50||view.getUint16(offset+6,true)!==flags||view.getUint16(offset+8,true)!==method)throw new Error('백업 ZIP 파일 헤더가 일치하지 않습니다.');
  const localName=view.getUint16(offset+26,true),localExtra=view.getUint16(offset+28,true),dataStart=offset+30+localName+localExtra;
  if(dataStart+compressed>start||decode(bytes.subarray(offset+30,offset+30+localName))!==name)throw new Error('백업 ZIP 파일 경로/범위가 일치하지 않습니다.');
  total+=size;if(total>PROJECT_PACKAGE_MAX_BYTES||(name==='manifest.json'&&size>1024*1024)||(name==='README.txt'&&size>64*1024))throw new Error('백업 ZIP을 푼 크기가 제한을 초과합니다.');
  names.set(name,size);pos=end;
 }
 if(pos!==eocd||!names.has('manifest.json')||!names.has('project.json')||!names.has('README.txt'))throw new Error('공간 프로젝트 백업이 아닙니다. glTF ZIP은 3D 프로그램에서 여세요.');
 return names;
}

function boundedRead(file:JSZip.JSZipObject,size:number):Promise<Uint8Array>{
 // JSZip 3.10.2 documents ZipObject.internalStream but omits it from its bundled types.
 return new Promise((resolve,reject)=>{const chunks:Uint8Array[]=[];let length=0,failed=false;const stream=(file as JSZip.JSZipObject&{internalStream(type:'uint8array'):JSZip.JSZipStreamHelper<Uint8Array>}).internalStream('uint8array');
  stream.on('data',chunk=>{if(failed)return;length+=chunk.length;if(length>size){failed=true;stream.pause();reject(new Error('백업 ZIP의 실제 크기가 선언된 크기를 초과합니다.'));}else chunks.push(chunk);});
  stream.on('error',error=>{failed=true;reject(error);});stream.on('end',()=>{if(failed)return;if(length!==size){reject(new Error('백업 자산 크기가 일치하지 않습니다.'));return;}const result=new Uint8Array(length);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}resolve(result);});stream.resume();
 });
}
export async function importProjectPackage(input:ArrayBuffer,onProgress:(message:string)=>void=()=>{}):Promise<Project>{
 const bytes=new Uint8Array(input),names=inspectArchive(bytes);onProgress('백업 파일 목록 확인 중');
 const zip=await JSZip.loadAsync(bytes),read=async(path:string)=>{const file=zip.file(path),size=names.get(path);if(!file||size===undefined)throw new Error(`백업 자산이 없습니다: ${path}`);return boundedRead(file,size);};
 let manifest:Manifest;try{manifest=JSON.parse(decode(await read('manifest.json')));}catch{throw new Error('백업 manifest.json을 읽지 못했습니다.');}
 if(manifest?.format!=='gonggan-project-backup'||manifest.version!==1||manifest.project?.path!=='project.json'||!Array.isArray(manifest.assets)||manifest.assets.length>MAX_ASSETS)throw new Error('지원하는 공간 프로젝트 백업이 아닙니다.');
 const validMeta=(a:{path:string;bytes:number;sha256:string})=>typeof a?.path==='string'&&Number.isSafeInteger(a.bytes)&&a.bytes>0&&a.bytes===names.get(a.path)&&hashPattern.test(a.sha256);
 if(!validMeta(manifest.project))throw new Error('백업 프로젝트 크기/해시 정보가 올바르지 않습니다.');
 const assets=new Map<string,PackageAsset>();for(const a of manifest.assets){if(!validMeta(a)||!types[a.mime]||a.path!==`assets/${a.mime==='model/gltf-binary'?'models':'images'}/${a.sha256}.${types[a.mime]}`||assets.has(a.path))throw new Error('백업 자산 목록이 올바르지 않습니다.');assets.set(a.path,a);}
 if(names.size!==assets.size+3)throw new Error('백업 목록에 없는 자산이 포함됐습니다.');
 const projectBytes=await read('project.json');if(await sha256(projectBytes)!==manifest.project.sha256)throw new Error('백업 프로젝트 해시가 일치하지 않습니다.');
 let project:unknown;try{project=JSON.parse(decode(projectBytes));}catch{throw new Error('백업 프로젝트 JSON이 손상됐습니다.');}
 const slots=assetSlots(project),cache=new Map<string,string>();let restoredSize=projectBytes.length;
 for(const [index,slot] of slots.entries()){
  onProgress(`백업 자산 검사 중 · ${index+1}/${slots.length}`);
  const value=slot.object[slot.key];if(typeof value!=='string'||!value.startsWith('gonggan-asset:'))throw new Error('백업 자산 참조가 올바르지 않습니다.');
  const path=value.slice('gonggan-asset:'.length),meta=assets.get(path);if(!meta||(slot.kind==='model')!==(meta.mime==='model/gltf-binary'))throw new Error('백업 자산이 누락됐거나 종류가 일치하지 않습니다.');
  let url=cache.get(path);if(!url){const raw=await read(path);if(await sha256(raw)!==meta.sha256)throw new Error('백업 자산 해시가 일치하지 않습니다.');checkSignature(raw,meta.mime);url=dataUrl(raw,meta.mime);cache.set(path,url);}
  restoredSize+=url.length-value.length;if(restoredSize>PROJECT_PACKAGE_MAX_BYTES)throw new Error('복원 프로젝트가 80MB를 넘습니다.');
  slot.object[slot.key]=url;
 }
 if(cache.size!==assets.size)throw new Error('백업에 참조되지 않는 자산이 있습니다.');
 if(encode(JSON.stringify(project)).length>PROJECT_PACKAGE_MAX_BYTES)throw new Error('복원 프로젝트가 80MB를 넘습니다.');
 onProgress('벽·작품·Scene 구조 검사 중');return parseProject(project);
}

/** Distinct source images for a final browser decode/pixel-limit check. */
export function projectImageUrls(project:Project){return [...new Set(assetSlots(project).filter(s=>s.kind==='image').map(s=>s.object[s.key] as string))];}
