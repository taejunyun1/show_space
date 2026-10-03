import {disposeModelAsset} from './modelAssetResources';
import {modelAssetBounds} from './modelArtworkGeometry';
import JSZip from 'jszip';
import {Mesh,Texture} from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MODEL_MAX_BYTES} from './glbPayload';
import {inspectStaticArtworkGlb,modelDataUrl,packEmbeddedGltf,recordValue} from './artworkModelPayload';
import type {ReferenceModel} from '../domain/types';

function pathName(raw:string,base=''){
 let decoded:string;try{decoded=decodeURIComponent(raw);}catch{throw new Error('모델 자산 경로가 올바르지 않습니다.');}
 if(!decoded||/[\\\u0000-\u001f?#:]/.test(decoded)||decoded.startsWith('/'))throw new Error('모델 자산은 함께 선택한 파일의 상대 경로만 사용할 수 있습니다.');
 const parts=base.split('/').filter(Boolean);for(const part of decoded.split('/')){if(!part||part==='.')continue;if(part==='..'){if(!parts.length)throw new Error('모델 자산 경로가 파일 묶음 밖을 참조합니다.');parts.pop();}else parts.push(part);}return parts.join('/');
}
function zipSizes(bytes:Uint8Array){
 if(bytes.length<22||bytes.length>MODEL_MAX_BYTES)throw new Error('모델 ZIP은 12MB 이하여야 합니다.');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50&&i+22+view.getUint16(i+20,true)===bytes.length){end=i;break;}
 if(end<0||view.getUint16(end+4,true)||view.getUint16(end+6,true)||view.getUint16(end+8,true)!==view.getUint16(end+10,true))throw new Error('손상·분할 ZIP은 지원하지 않습니다.');
 const count=view.getUint16(end+10,true),start=view.getUint32(end+16,true);if(count<1||count>250||start+view.getUint32(end+12,true)!==end)throw new Error('모델 ZIP의 파일 수·범위가 올바르지 않습니다.');
 const names=new Map<string,number>();let pos=start,total=0;
 for(let i=0;i<count;i++){
  if(pos+46>end||view.getUint32(pos,true)!==0x02014b50)throw new Error('모델 ZIP 목록이 손상됐습니다.');
  const flags=view.getUint16(pos+8,true),method=view.getUint16(pos+10,true),compressed=view.getUint32(pos+20,true),size=view.getUint32(pos+24,true),n=view.getUint16(pos+28,true),extra=view.getUint16(pos+30,true),comment=view.getUint16(pos+32,true),offset=view.getUint32(pos+42,true),next=pos+46+n+extra+comment;
  if(next>end||flags&1||view.getUint16(pos+34,true)||![0,8].includes(method)||size===0xffffffff||compressed===0xffffffff||offset+30>start)throw new Error('암호화·ZIP64·손상 ZIP은 지원하지 않습니다.');
  const name=new TextDecoder().decode(bytes.subarray(pos+46,pos+46+n));if(pathName(name)!==name.replace(/\/$/,'' )||names.has(name))throw new Error('모델 ZIP 경로가 잘못됐거나 중복됐습니다.');
  if(view.getUint32(offset,true)!==0x04034b50||view.getUint16(offset+6,true)!==flags||view.getUint16(offset+8,true)!==method)throw new Error('모델 ZIP 파일 헤더가 일치하지 않습니다.');
  const localN=view.getUint16(offset+26,true),localExtra=view.getUint16(offset+28,true);if(offset+30+localN+localExtra+compressed>start||new TextDecoder().decode(bytes.subarray(offset+30,offset+30+localN))!==name)throw new Error('모델 ZIP 파일 범위가 올바르지 않습니다.');
  total+=size;if(total>MODEL_MAX_BYTES||name.endsWith('/')&&size!==0)throw new Error('모델 ZIP을 푼 크기는 12MB 이하여야 합니다.');names.set(name,size);pos=next;
 }
 if(pos!==end)throw new Error('모델 ZIP 목록이 손상됐습니다.');return names;
}
function boundedZipFile(file:JSZip.JSZipObject,size:number):Promise<Uint8Array>{
 return new Promise((resolve,reject)=>{const chunks:Uint8Array[]=[];let length=0,failed=false;const stream=(file as JSZip.JSZipObject&{internalStream(type:'uint8array'):JSZip.JSZipStreamHelper<Uint8Array>}).internalStream('uint8array');stream.on('data',chunk=>{if(failed)return;length+=chunk.length;if(length>size){failed=true;stream.pause();reject(new Error('모델 ZIP의 실제 크기가 선언 크기를 초과합니다.'));}else chunks.push(chunk);});stream.on('error',e=>{failed=true;reject(e);});stream.on('end',()=>{if(failed)return;if(length!==size){reject(new Error('모델 ZIP 자산 크기가 일치하지 않습니다.'));return;}const out=new Uint8Array(length);let offset=0;for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.length;}resolve(out);});stream.resume();});
}
export async function artworkModelBytes(files:readonly File[]):Promise<{bytes:ArrayBuffer;name:string}>{
 if(!files.length||files.length>250||files.reduce((n,f)=>n+f.size,0)>MODEL_MAX_BYTES)throw new Error('3D 작품 파일과 자산 총합은 12MB 이하여야 합니다.');
 if(files.length===1&&/\.glb$/i.test(files[0].name)){const bytes=await files[0].arrayBuffer();inspectStaticArtworkGlb(bytes);return {bytes,name:files[0].name};}
 const entries=new Map<string,Uint8Array>();let modelNames:string[]=[];
 if(files.length===1&&/\.zip$/i.test(files[0].name)){
  const raw=new Uint8Array(await files[0].arrayBuffer()),sizes=zipSizes(raw),zip=await JSZip.loadAsync(raw);for(const [name,size] of sizes)if(!name.endsWith('/')){const file=zip.file(name);if(!file)throw new Error('모델 ZIP의 자산이 누락됐습니다.');entries.set(name,await boundedZipFile(file,size));}
 }else for(const f of files){const name=pathName(f.webkitRelativePath||f.name);if(entries.has(name))throw new Error('같은 이름의 모델 자산이 중복됐습니다.');entries.set(name,new Uint8Array(await f.arrayBuffer()));}
 modelNames=[...entries.keys()].filter(n=>/\.gltf$/i.test(n));if(modelNames.length!==1)throw new Error('glTF 파일 하나와 해당 BIN·텍스처를 함께 선택하거나 ZIP으로 묶어주세요.');
 const name=modelNames[0],base=name.includes('/')?name.slice(0,name.lastIndexOf('/')+1):'';let doc:Record<string,unknown>;
 try{doc=recordValue(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(entries.get(name))));}catch{throw new Error('glTF 파일을 읽지 못했습니다.');}
 let total=0;for(const key of ['buffers','images']){const values=doc[key];if(values===undefined)continue;if(!Array.isArray(values))throw new Error('glTF 자산 목록이 올바르지 않습니다.');for(const item of values){const v=recordValue(item);if(typeof v.uri!=='string'||v.uri.startsWith('data:'))continue;const resource=pathName(v.uri,base),bytes=entries.get(resource);if(!bytes)throw new Error(`glTF 자산이 누락됐습니다: ${resource.slice(0,160)}. 폴더 경로를 유지한 ZIP으로 가져오세요.`);total+=bytes.length;if(total>MODEL_MAX_BYTES)throw new Error('glTF 자산 총합은 12MB 이하여야 합니다.');const mime=key==='buffers'?'application/octet-stream':/\.png$/i.test(resource)?'image/png':/\.jpe?g$/i.test(resource)?'image/jpeg':/\.webp$/i.test(resource)?'image/webp':null;if(!mime)throw new Error('모델 텍스처는 PNG·JPG·WebP만 지원합니다.');v.uri=modelDataUrl(bytes.slice().buffer).replace('model/gltf-binary',mime);}}
 return {bytes:packEmbeddedGltf(doc),name:name.split('/').pop()!};
}
export async function readModelArtworkFiles(files:readonly File[]):Promise<ReferenceModel>{
 const {bytes,name}=await artworkModelBytes(files),gltf=await new GLTFLoader().parseAsync(bytes,'');
 try{
  const bounds=modelAssetBounds(gltf.scene);
  let pixels=0;const decodedImages=new Set<unknown>();gltf.scene.traverse(o=>{if(o instanceof Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])for(const v of Object.values(m))if(v instanceof Texture){const image=v.image as {width?:number;height?:number}|undefined;const w=image?.width??0,h=image?.height??0;if(w>8192||h>8192)throw new Error('모델 텍스처는 한 변 8192px 이하여야 합니다.');if(image&&!decodedImages.has(image)){decodedImages.add(image);pixels+=w*h;}}});if(pixels>64_000_000)throw new Error('모델 텍스처의 전체 해상도가 너무 큽니다.');
  return {name:name.slice(0,200),dataUrl:modelDataUrl(bytes),visible:true,sizeMm:bounds.sizeMm,sourceOffsetM:bounds.sourceOffsetM,positionMm:[0,0,0],rotationDeg:0,scale:1};
 }finally{disposeModelAsset(gltf.scenes);}
}
