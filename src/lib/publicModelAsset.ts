import {inspectStaticArtworkGlb,recordValue} from './artworkModelPayload';
import {MODEL_MAX_BYTES} from './glbPayload';
/** Public models keep geometry/UV/PBR, but never source names, extras or generator metadata. */
const keys:Record<string,string[]>={
 root:['asset','scene','scenes','nodes','meshes','accessors','bufferViews','buffers','materials','textures','images','samplers','extensionsUsed','extensionsRequired'],
 asset:['version'],scene:['nodes'],node:['mesh','children','matrix','translation','rotation','scale'],mesh:['primitives'],primitive:['attributes','indices','material','mode'],
 accessor:['bufferView','byteOffset','componentType','normalized','count','type','min','max'],bufferView:['buffer','byteOffset','byteLength','byteStride','target'],buffer:['byteLength','uri'],image:['bufferView','mimeType','uri'],texture:['sampler','source','extensions'],sampler:['magFilter','minFilter','wrapS','wrapT'],
 material:['pbrMetallicRoughness','normalTexture','occlusionTexture','emissiveTexture','emissiveFactor','alphaMode','alphaCutoff','doubleSided','extensions'],pbr:['baseColorFactor','baseColorTexture','metallicFactor','roughnessFactor','metallicRoughnessTexture'],info:['index','texCoord','scale','strength','extensions']
};
const extensionKeys:Record<string,string[]>={
 KHR_materials_unlit:[],KHR_materials_clearcoat:['clearcoatFactor','clearcoatTexture','clearcoatRoughnessFactor','clearcoatRoughnessTexture','clearcoatNormalTexture'],KHR_materials_transmission:['transmissionFactor','transmissionTexture'],KHR_materials_volume:['thicknessFactor','thicknessTexture','attenuationDistance','attenuationColor'],KHR_materials_ior:['ior'],KHR_materials_specular:['specularFactor','specularTexture','specularColorFactor','specularColorTexture'],KHR_materials_sheen:['sheenColorFactor','sheenColorTexture','sheenRoughnessFactor','sheenRoughnessTexture'],KHR_materials_emissive_strength:['emissiveStrength'],KHR_materials_iridescence:['iridescenceFactor','iridescenceTexture','iridescenceIor','iridescenceThicknessMinimum','iridescenceThicknessMaximum','iridescenceThicknessTexture'],KHR_materials_anisotropy:['anisotropyStrength','anisotropyRotation','anisotropyTexture'],KHR_materials_dispersion:['dispersion'],KHR_texture_transform:['offset','rotation','scale','texCoord'],KHR_mesh_quantization:[],EXT_texture_webp:['source']
};
function selected(value:unknown,fields:readonly string[]){const raw=recordValue(value);return Object.fromEntries(fields.filter(k=>raw[k]!==undefined).map(k=>[k,raw[k]]));}
function scalar(value:unknown):unknown{if(Array.isArray(value))return value.map(scalar);if(typeof value==='number'&&Number.isFinite(value)||typeof value==='boolean')return value;throw new Error('공유 모델 속성은 숫자·불리언이어야 합니다.');}
function info(value:unknown){const out=selected(value,keys.info);for(const k of Object.keys(out))out[k]=k==='extensions'?extensions(out[k]):scalar(out[k]);return out;}
function extensions(value:unknown){const raw=recordValue(value),out:Record<string,unknown>={};for(const [name,fields] of Object.entries(extensionKeys))if(raw[name]!==undefined){const e=selected(raw[name],fields);for(const key of Object.keys(e))e[key]=key.endsWith('Texture')?info(e[key]):scalar(e[key]);out[name]=e;}return out;}
function cleanDocument(value:unknown){
 const doc=selected(value,keys.root);if(doc.scene!==undefined)doc.scene=scalar(doc.scene);doc.asset=selected(doc.asset,keys.asset);
 for(const [name,kind] of [['scenes','scene'],['nodes','node'],['meshes','mesh'],['accessors','accessor'],['bufferViews','bufferView'],['buffers','buffer'],['materials','material'],['textures','texture'],['images','image'],['samplers','sampler']] as const){if(doc[name]===undefined)continue;if(!Array.isArray(doc[name]))throw new Error('공유 모델 목록이 올바르지 않습니다.');doc[name]=(doc[name] as unknown[]).map(value=>{
  const out=selected(value,keys[kind]);
  if(kind==='mesh')out.primitives=(out.primitives as unknown[]).map(v=>{const p=selected(v,keys.primitive),a=recordValue(p.attributes);p.attributes=Object.fromEntries(Object.entries(a).filter(([k])=>/^(POSITION|NORMAL|TANGENT|TEXCOORD_[0-9]+|COLOR_[0-9]+)$/.test(k)).map(([k,v])=>[k,scalar(v)]));for(const k of ['indices','material','mode'])if(p[k]!==undefined)p[k]=scalar(p[k]);return p;});
  if(kind==='material'){if(out.pbrMetallicRoughness!==undefined){const p=selected(out.pbrMetallicRoughness,keys.pbr);for(const k of Object.keys(p))p[k]=k.endsWith('Texture')?info(p[k]):scalar(p[k]);out.pbrMetallicRoughness=p;}for(const k of ['normalTexture','occlusionTexture','emissiveTexture'])if(out[k]!==undefined)out[k]=info(out[k]);if(out.emissiveFactor!==undefined)out.emissiveFactor=scalar(out.emissiveFactor);if(out.alphaMode!==undefined&&!['OPAQUE','MASK','BLEND'].includes(String(out.alphaMode)))throw new Error('공유 모델 투명 속성이 올바르지 않습니다.');if(out.alphaCutoff!==undefined)out.alphaCutoff=scalar(out.alphaCutoff);if(out.doubleSided!==undefined&&typeof out.doubleSided!=='boolean')throw new Error('공유 모델 면 속성이 올바르지 않습니다.');}
  if(out.extensions!==undefined)out.extensions=extensions(out.extensions);
  if(!['mesh','material'].includes(kind))for(const k of Object.keys(out))if(!['extensions','type','mimeType','uri'].includes(k))out[k]=scalar(out[k]);return out;
 });}
 for(const k of ['extensionsUsed','extensionsRequired'])if(doc[k]!==undefined)doc[k]=(doc[k] as string[]).filter(e=>Object.hasOwn(extensionKeys,e));
 return doc;
}
export function publicModelBytes(input:ArrayBuffer):ArrayBuffer{
 const source=inspectStaticArtworkGlb(input),doc=cleanDocument(source),view=new DataView(input),jsonLength=view.getUint32(12,true),tail=(()=>{let offset=20+jsonLength;while(offset<input.byteLength){const length=view.getUint32(offset,true);if(view.getUint32(offset+4,true)===0x004e4942)return new Uint8Array(input,offset,8+length);offset+=8+length;}throw new Error('공유 모델 바이너리가 없습니다.');})(),json=new TextEncoder().encode(JSON.stringify(doc)),length=Math.ceil(json.length/4)*4,total=20+length+tail.length;
 if(total>MODEL_MAX_BYTES)throw new Error('공유 3D 모델은 12MiB 이하여야 합니다.');
 const bytes=new ArrayBuffer(total),header=new DataView(bytes),out=new Uint8Array(bytes);header.setUint32(0,0x46546c67,true);header.setUint32(4,2,true);header.setUint32(8,total,true);header.setUint32(12,length,true);header.setUint32(16,0x4e4f534a,true);out.fill(32,20,20+length);out.set(json,20);out.set(tail,20+length);inspectStaticArtworkGlb(bytes);return bytes;
}
export async function publicModelHash(bytes:ArrayBuffer){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');}
export const PUBLIC_MODELS_MAX_BYTES=80*1024*1024;
export const PUBLIC_MODEL_ASSETS_MAX=51; // 50 independent artworks plus one venue model.
export type PublicModelCache=Map<string,{hash:string;bytes:ArrayBuffer}>;
export async function preparePublicModels(project:{referenceModel?:{dataUrl:string;visible:boolean};modelArtworks?:readonly {id:string;visible:boolean;model:{dataUrl:string}}[]},cache:PublicModelCache=new Map()){
 const ids=new Map<string,string>(),uploads=new Map<string,ArrayBuffer>();let total=0;
 async function register(dataUrl:string){
  let asset=cache.get(dataUrl);
  if(!asset){
   if(!/^data:model\/gltf-binary;base64,[A-Za-z0-9+/]+={0,2}$/.test(dataUrl)||dataUrl.length>MODEL_MAX_BYTES*4/3+100)throw new Error('공유 모델 파일 데이터가 올바르지 않습니다.');
   const raw=Uint8Array.from(atob(dataUrl.split(',')[1]),c=>c.charCodeAt(0)),bytes=publicModelBytes(raw.buffer);
   asset={hash:await publicModelHash(bytes),bytes};cache.set(dataUrl,asset);
  }
  if(!uploads.has(asset.hash)){total+=asset.bytes.byteLength;if(total>PUBLIC_MODELS_MAX_BYTES||uploads.size>=PUBLIC_MODEL_ASSETS_MAX)throw new Error('공유 모델 자산 총합은 80MiB·51개 이하여야 합니다.');uploads.set(asset.hash,asset.bytes);}
  return asset.hash;
 }
 const referenceId=project.referenceModel?.visible?await register(project.referenceModel.dataUrl):undefined;
 for(const a of project.modelArtworks??[])if(a.visible)ids.set(a.id,await register(a.model.dataUrl));
 return {ids,uploads,referenceId};
}
