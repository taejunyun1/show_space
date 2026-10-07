import {LoadingManager,type Texture} from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {inspectStaticArtworkGlb} from './artworkModelPayload';
import {disposeModelAsset} from './modelAssetResources';

/** GLTFLoader swallows image failures. Check the slots it actually requests,
 * including supported material extensions, before exposing a partial model.
 * Unused images and slots ignored by unlit materials need no decoder work. */
export async function loadStaticModel(bytes:ArrayBuffer){
 inspectStaticArtworkGlb(bytes);
 const requested:(Texture|null)[]=[],urls=new Set<string>(),manager=new LoadingManager();
 manager.setURLModifier(url=>{if(url.startsWith('blob:'))urls.add(url);return url;});
 const loader=new GLTFLoader(manager);
 loader.register(parser=>{
  const assign=parser.assignTexture.bind(parser);
  parser.assignTexture=async (...args)=>{const texture=await assign(...args);requested.push(texture);return texture;};
  return {name:'GONGGAN_required_texture_check'};
 });
 try{
  const gltf=await loader.parseAsync(bytes,'');
  try{
   const images=new Set<unknown>();let pixels=0;
   for(const texture of requested){
    const image=texture?.image as {width?:number;height?:number;naturalWidth?:number;complete?:boolean}|undefined;
    const width=image?.width??0,height=image?.height??0;
    if(!texture||!image||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||image.complete===false||image.naturalWidth===0)throw new Error('3D 모델의 텍스처를 읽지 못했습니다. 원본 모델에서 이미지를 다시 저장한 뒤 가져오세요.');
    if(width>8192||height>8192)throw new Error('모델 텍스처는 한 변 8192px 이하여야 합니다.');
    if(!images.has(image)){images.add(image);pixels+=width*height;}
   }
   if(pixels>64_000_000)throw new Error('모델 텍스처의 전체 해상도가 너무 큽니다.');
   return gltf;
  }catch(error){disposeModelAsset(gltf.scenes);throw error;}
 }finally{
  // Three revokes embedded image URLs on success, but not on a decoder failure.
  // Revoking an already revoked URL is harmless; all tracked URLs belong to this parse.
  for(const url of urls)URL.revokeObjectURL(url);
 }
}
