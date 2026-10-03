import {inspectGlb,MODEL_MAX_BYTES} from './glbPayload';
type RecordValue=Record<string,unknown>;
export function recordValue(value:unknown):RecordValue{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('모델 구조 정보가 올바르지 않습니다.');return value as RecordValue;}
function list(value:unknown):RecordValue[]{if(value===undefined)return [];if(!Array.isArray(value))throw new Error('모델 목록 정보가 올바르지 않습니다.');return value.map(recordValue);}
const supportedRequired=new Set(['KHR_materials_unlit','KHR_materials_clearcoat','KHR_materials_transmission','KHR_materials_volume','KHR_materials_ior','KHR_materials_specular','KHR_materials_sheen','KHR_materials_emissive_strength','KHR_materials_iridescence','KHR_materials_anisotropy','KHR_materials_dispersion','KHR_texture_transform','KHR_mesh_quantization','EXT_texture_webp']);
/** Validate before invoking a loader: no remote resources, animation, skin or unbounded geometry. */
export function inspectStaticArtworkDocument(value:unknown){
 const doc=recordValue(value),asset=recordValue(doc.asset);
 if(asset.version!=='2.0'||!Array.isArray(doc.meshes)||!doc.meshes.length)throw new Error('glTF 2.0의 형상이 있는 모델을 선택하세요.');
 if((doc.animations as unknown[]|undefined)?.length||(doc.skins as unknown[]|undefined)?.length)throw new Error('움직이는 모델·스킨은 아직 지원하지 않습니다. 정적인 작품으로 내보내세요.');
 const nodes=list(doc.nodes),meshes=list(doc.meshes),accessors=list(doc.accessors),views=list(doc.bufferViews),buffers=list(doc.buffers);
 if(nodes.length>5000||meshes.length>2000||accessors.length>20000||views.length>20000||buffers.length>100)throw new Error('3D 작품 모델의 객체가 너무 많습니다.');
 if(!Array.isArray(doc.scenes)||!doc.scenes.length||doc.scenes.length>20)throw new Error('3D 작품 모델의 장면이 올바르지 않습니다.');
 if(doc.extensionsRequired!==undefined&&(!Array.isArray(doc.extensionsRequired)||doc.extensionsRequired.some(e=>!supportedRequired.has(String(e)))))throw new Error('이 모델의 필수 확장·압축 형식은 아직 지원하지 않습니다. 압축하지 않은 정적 glTF/GLB로 내보내세요.');
 // Optional compressed resources also cannot be decoded, nor should a loader follow extension URIs.
 const walk=(v:unknown,depth=0)=>{if(depth>60)throw new Error('모델 정보의 계층이 너무 깊습니다.');if(v&&typeof v==='object')for(const [k,item] of Object.entries(v)){if(['KHR_draco_mesh_compression','EXT_meshopt_compression','KHR_texture_basisu','EXT_mesh_gpu_instancing','KHR_lights_punctual'].includes(k))throw new Error('압축·인스턴스·내장 조명을 제거한 정적 작품 모델을 선택하세요.');if(k==='uri'&&typeof item==='string'&&!/^data:/.test(item))throw new Error('외부 모델 자산을 함께 선택하거나 ZIP으로 묶어주세요.');walk(item,depth+1);}};
 walk(doc);
 // Bound all accessor allocations, including normals and UVs, before decoding.
 for(const a of accessors){if(!Number.isSafeInteger(a.count)||Number(a.count)<1||Number(a.count)>600000||![5120,5121,5122,5123,5125,5126].includes(Number(a.componentType))||!['SCALAR','VEC2','VEC3','VEC4','MAT2','MAT3','MAT4'].includes(String(a.type)))throw new Error('모델 정점 자산의 형식·수가 올바르지 않습니다.');if(a.sparse!==undefined)throw new Error('희소 정점은 아직 지원하지 않습니다. 일반 정점으로 내보내세요.');if(!Number.isInteger(a.bufferView)||!views[Number(a.bufferView)])throw new Error('모델 정점 버퍼가 누락됐습니다.');}
 const meshCounts:number[]=[];let count=0,vertices=0;
 for(const mesh of meshes){let meshCount=0;for(const p of list(mesh.primitives)){
  if(p.targets!==undefined)throw new Error('변형 애니메이션은 아직 지원하지 않습니다.');
  const position=recordValue(p.attributes).POSITION;if(!Number.isInteger(position)||!accessors[Number(position)])throw new Error('모델의 정점 정보가 누락됐습니다.');
  const a=accessors[Number(position)];if(a.type!=='VEC3'||!Number.isInteger(a.count)||Number(a.count)<1||Number(a.count)>600000)throw new Error('모델 정점 수가 제한을 초과했습니다.');
  if(p.indices!==undefined&&(!Number.isInteger(p.indices)||!accessors[Number(p.indices)]||accessors[Number(p.indices)].type!=='SCALAR'))throw new Error('모델 인덱스 정보가 올바르지 않습니다.');
  const primitiveCount=Number(p.indices!==undefined?accessors[Number(p.indices)]?.count:a.count);count+=primitiveCount;meshCount+=primitiveCount;vertices+=Number(a.count);
  if(!Number.isFinite(count)||count>600000||vertices>600000)throw new Error('3D 작품 모델은 삼각형 약 20만 개 이하로 단순화해주세요.');
 }meshCounts.push(meshCount);}
 let instances=0;for(const n of nodes)if(n.mesh!==undefined){if(!Number.isInteger(n.mesh)||!meshes[Number(n.mesh)])throw new Error('모델 형상 연결이 올바르지 않습니다.');instances+=meshCounts[Number(n.mesh)];if(instances>600000)throw new Error('반복된 모델 형상이 너무 많습니다. 삼각형 약 20만 개 이하로 단순화해주세요.');}
 if(!count)throw new Error('모델에 표시할 형상이 없습니다.');
 // Node cycles and deep trees otherwise cause loader recursion or traversal failure.
 const parents=new Set<number>();for(const n of nodes)if(Array.isArray(n.children))for(const child of n.children){if(parents.has(Number(child)))throw new Error('모델 객체가 여러 부모에 중복 연결됐습니다.');parents.add(Number(child));}
 const active=new Set<number>(),done=new Set<number>();
 function node(index:unknown,depth=0){if(!Number.isInteger(index)||Number(index)<0||!nodes[Number(index)]||depth>60||active.has(Number(index)))throw new Error('모델 객체 연결이 손상됐거나 너무 깊습니다.');if(done.has(Number(index)))return;active.add(Number(index));const n=nodes[Number(index)];if(n.children!==undefined){if(!Array.isArray(n.children))throw new Error('모델 객체 연결이 손상됐습니다.');n.children.forEach(i=>node(i,depth+1));}active.delete(Number(index));done.add(Number(index));}
 for(const n of nodes)for(const [key,length] of [['translation',3],['rotation',4],['scale',3],['matrix',16]] as const)if(n[key]!==undefined&&(!Array.isArray(n[key])||(n[key] as unknown[]).length!==length||(n[key] as unknown[]).some(v=>typeof v!=='number'||!Number.isFinite(v))))throw new Error('모델 객체 좌표가 올바르지 않습니다.');
 nodes.forEach((_,i)=>node(i));
 for(const s of list(doc.scenes)){if(!Array.isArray(s.nodes))throw new Error('모델 장면 연결이 올바르지 않습니다.');const roots=new Set<number>();s.nodes.forEach(i=>{if(roots.has(Number(i))||parents.has(Number(i)))throw new Error('모델 장면에 객체가 중복 연결됐습니다.');roots.add(Number(i));node(i);});}
 for(const view of views){const b=buffers[Number(view.buffer)],start=Number(view.byteOffset??0),length=Number(view.byteLength);if(!Number.isInteger(view.buffer)||!b||!Number.isInteger(start)||!Number.isInteger(length)||start<0||length<=0||start+length>Number(b.byteLength))throw new Error('모델 버퍼 범위가 올바르지 않습니다.');}
 return doc;
}
export function inspectStaticArtworkGlb(bytes:ArrayBuffer){
 const doc=inspectGlb(bytes);inspectStaticArtworkDocument(doc);
 const view=new DataView(bytes);let offset=20+view.getUint32(12,true),binary=0;
 let binaryOffset=0;
 while(offset<bytes.byteLength){if(offset+8>bytes.byteLength)throw new Error('GLB 자산이 손상됐습니다.');const length=view.getUint32(offset,true),kind=view.getUint32(offset+4,true);if(length%4||offset+8+length>bytes.byteLength)throw new Error('GLB 자산 범위가 올바르지 않습니다.');if(kind===0x004e4942){if(binary)throw new Error('GLB에 중복된 바이너리가 있습니다.');binary=length;binaryOffset=offset+8;}offset+=8+length;}
 if(doc.buffers?.length!==1||!Number.isInteger(doc.buffers[0].byteLength)||doc.buffers[0].byteLength<1||doc.buffers[0].byteLength>binary||binary-doc.buffers[0].byteLength>3)throw new Error('GLB의 버퍼 자산이 누락됐거나 크기가 일치하지 않습니다.');
 let pixels=0;
 for(const image of doc.images??[]){let data:Uint8Array,mime:string;if(image.uri!==undefined){data=embeddedBytes(image.uri);mime=image.uri.slice(5,image.uri.indexOf(';'));}else{const v=doc.bufferViews?.[image.bufferView];if(!Number.isInteger(image.bufferView)||!v||v.buffer!==0)throw new Error('모델 텍스처 자산이 누락됐습니다.');data=new Uint8Array(bytes,binaryOffset+(v.byteOffset??0),v.byteLength);mime=image.mimeType;}const [w,h]=textureHeaderSize(data,mime);if(w<1||h<1||w>8192||h>8192||(pixels+=w*h)>64_000_000)throw new Error('모델 텍스처는 한 변 8192px·전체 6,400만 픽셀 이하여야 합니다.');}
 return doc;
}
/** Header-only dimension checks happen before the browser allocates decoded pixels. */
export function textureHeaderSize(b:Uint8Array,mime:string):[number,number]{
 const view=new DataView(b.buffer,b.byteOffset,b.byteLength),str=(start:number,end:number)=>new TextDecoder().decode(b.subarray(start,end));
 if(mime==='image/png'&&b.length>=24&&[137,80,78,71,13,10,26,10].every((n,i)=>b[i]===n)&&str(12,16)==='IHDR')return [view.getUint32(16),view.getUint32(20)];
 if(mime==='image/jpeg'&&b.length>=4&&b[0]===255&&b[1]===216){let i=2;while(i+4<=b.length){if(b[i++]!==255)break;while(b[i]===255)i++;const marker=b[i++];if(marker===217||marker===218)break;const len=view.getUint16(i);if(len<2||i+len>b.length)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&len>=8)return [view.getUint16(i+5),view.getUint16(i+3)];i+=len;}}
 if(mime==='image/webp'&&b.length>=25&&str(0,4)==='RIFF'&&str(8,12)==='WEBP'){
  const kind=str(12,16),u24=(i:number)=>b[i]+(b[i+1]<<8)+(b[i+2]<<16);
  if(kind==='VP8X'&&b.length>=30)return [u24(24)+1,u24(27)+1];
  if(kind==='VP8L'&&b[20]===47){const bits=view.getUint32(21,true);return [(bits&0x3fff)+1,((bits>>>14)&0x3fff)+1];}
  if(kind==='VP8 '&&b.length>=30&&b[23]===157&&b[24]===1&&b[25]===42)return [view.getUint16(26,true)&0x3fff,view.getUint16(28,true)&0x3fff];
 }
 throw new Error('모델 텍스처의 실제 형식·크기를 읽을 수 없습니다. PNG·JPG·WebP를 사용하세요.');
}
export function modelDataUrl(bytes:ArrayBuffer){let raw='';const b=new Uint8Array(bytes);for(let i=0;i<b.length;i+=32768)raw+=String.fromCharCode(...b.subarray(i,i+32768));return `data:model/gltf-binary;base64,${btoa(raw)}`;}
function embeddedBytes(uri:string){const m=/^data:(?:application\/(?:octet-stream|gltf-buffer)|image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(uri);if(!m||uri.length>MODEL_MAX_BYTES*4/3+100)throw new Error('모델에 포함된 자산 형식·크기가 올바르지 않습니다.');return Uint8Array.from(atob(m[1]),c=>c.charCodeAt(0));}
/** Canonical single GLB, preserving materials and binary data without texture resampling. */
export function packEmbeddedGltf(value:unknown):ArrayBuffer{
 const doc=structuredClone(inspectStaticArtworkDocument(value)),buffers=list(doc.buffers),views=list(doc.bufferViews),images=list(doc.images),parts:Uint8Array[]=[],offsets:number[]=[];let length=0;
 const append=(bytes:Uint8Array)=>{const offset=length;const padded=new Uint8Array(Math.ceil(bytes.length/4)*4);padded.set(bytes);parts.push(padded);length+=padded.length;if(length>MODEL_MAX_BYTES)throw new Error('3D 작품 자산 총합은 12MB 이하여야 합니다.');return offset;};
 for(const b of buffers){if(typeof b.uri!=='string')throw new Error('glTF의 버퍼 자산이 누락됐습니다.');const bytes=embeddedBytes(b.uri);if(bytes.length!==b.byteLength)throw new Error('glTF 버퍼 크기가 일치하지 않습니다.');offsets.push(append(bytes));}
 for(const v of views){v.byteOffset=offsets[Number(v.buffer)]+Number(v.byteOffset??0);v.buffer=0;}
 for(const image of images)if(image.uri!==undefined){if(typeof image.uri!=='string'||!/^data:image\/(png|jpeg|webp);base64,/.test(image.uri))throw new Error('모델 텍스처는 PNG·JPG·WebP만 지원합니다.');const bytes=embeddedBytes(image.uri),mime=image.uri.slice(5,image.uri.indexOf(';'));image.bufferView=views.length;image.mimeType=mime;views.push({buffer:0,byteOffset:append(bytes),byteLength:bytes.length});delete image.uri;}
 doc.bufferViews=views;doc.buffers=[{byteLength:length}];
 const json=new TextEncoder().encode(JSON.stringify(doc)),jsonLength=Math.ceil(json.length/4)*4,total=12+8+jsonLength+8+length;
 if(total>MODEL_MAX_BYTES)throw new Error('3D 작품 모델은 자산을 포함해 12MB 이하여야 합니다.');
 const result=new ArrayBuffer(total),header=new DataView(result),out=new Uint8Array(result);header.setUint32(0,0x46546c67,true);header.setUint32(4,2,true);header.setUint32(8,total,true);header.setUint32(12,jsonLength,true);header.setUint32(16,0x4e4f534a,true);out.fill(32,20,20+jsonLength);out.set(json,20);header.setUint32(20+jsonLength,length,true);header.setUint32(24+jsonLength,0x004e4942,true);let offset=28+jsonLength;for(const part of parts){out.set(part,offset);offset+=part.length;}inspectStaticArtworkGlb(result);return result;
}
