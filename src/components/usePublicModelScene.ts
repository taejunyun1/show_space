import {useReadonlyAssets} from './ReadonlyAssets';
import {localPresentationModelBytes} from '../lib/localPresentationModel';
import {useEffect,useState} from 'react';
import {useThree} from '@react-three/fiber';
import {Mesh,type Group} from 'three';
import {loadStaticModel} from '../lib/loadStaticModel';
import {inspectStaticArtworkGlb} from '../lib/artworkModelPayload';
import {publicModelHash} from '../lib/publicModelAsset';
import {MODEL_MAX_BYTES} from '../lib/glbPayload';
import {disposeModelAsset} from '../lib/modelAssetResources';
import {checkModelAssetBounds} from '../lib/modelArtworkGeometry';
interface Asset {refs:number;promise:Promise<Group>;controller:AbortController;scenes?:Group[];scene?:Group}
const assets=new Map<string,Asset>();
async function boundedModelResponse(response:Response){if(!response.ok)throw new Error(response.status===410?'중단된 공유 링크입니다.':'3D 작품 모델을 불러오지 못했습니다.');if(Number(response.headers.get('content-length'))>MODEL_MAX_BYTES)throw new Error('공유 모델 크기가 제한을 초과합니다.');const reader=response.body?.getReader();if(!reader)throw new Error('공유 모델 자산이 없습니다.');const chunks:Uint8Array[]=[];let length=0;try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>MODEL_MAX_BYTES){await reader.cancel();throw new Error('공유 모델 크기가 제한을 초과합니다.');}chunks.push(value);}}finally{reader.releaseLock();}const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes.buffer;}
function acquire(shareId:string,hash:string,localUrl?:string){
 const key=localUrl?`local:${localUrl}`:`public:${shareId}:${hash}`;let entry=assets.get(key);
 if(!entry){
  const controller=new AbortController(),owned={refs:0,controller} as Asset;
  const timer=localUrl?undefined:setTimeout(()=>controller.abort(),20000);
  const bytes=localUrl?Promise.resolve().then(()=>localPresentationModelBytes(localUrl)):fetch(`/api/public/${shareId}/models/${hash}`,{signal:controller.signal,cache:'no-store'}).then(boundedModelResponse);
  owned.promise=bytes.then(async bytes=>{
   inspectStaticArtworkGlb(bytes);
   if(!localUrl&&await publicModelHash(bytes)!==hash)throw new Error('공유 모델 자산이 손상됐습니다.');
   const gltf=await loadStaticModel(bytes);owned.scenes=gltf.scenes;return gltf.scene;
  }).finally(()=>{if(timer!==undefined)clearTimeout(timer);});
  entry=owned;assets.set(key,owned);
  void owned.promise.then(scene=>{owned.scene=scene;if(!owned.refs){disposeModelAsset(owned.scenes??scene);owned.scene=undefined;if(assets.get(key)===owned)assets.delete(key);}},()=>{if(assets.get(key)===owned)assets.delete(key);});
 }
 entry.refs++;const owned=entry;
 return {promise:owned.promise,release:()=>{owned.refs--;setTimeout(()=>{if(!owned.refs){owned.controller.abort();if(owned.scene){disposeModelAsset(owned.scenes??owned.scene);owned.scene=undefined;}if(assets.get(key)===owned)assets.delete(key);}},0);}};
}

/** Shared venue/artwork cache; no editor store, transform controls or private model fields. */
export function usePublicModelScene(shareId:string,hash:string,bounds:{sizeMm:[number,number,number];sourceOffsetM:[number,number,number]},allowFlat=false){
 const local=useReadonlyAssets(),localUrl=local?.models.get(hash);
 const {invalidate}=useThree(),[source,setSource]=useState<Group|null>(null),[error,setError]=useState('');
 useEffect(()=>{let canceled=false;if(local&&!localUrl){setSource(null);setError('발표 모델 자산을 찾지 못했습니다.');return;}const asset=acquire(shareId,hash,localUrl);setSource(null);setError('');void asset.promise.then(scene=>{if(canceled)return;try{checkModelAssetBounds(scene,bounds,allowFlat);scene.traverse(o=>{if(o instanceof Mesh){o.castShadow=true;o.receiveShadow=true;}});setSource(scene);invalidate();}catch(e){setError(e instanceof Error?e.message:'3D 모델을 불러오지 못했습니다.');invalidate();}},e=>{if(!canceled){setError(e instanceof Error?e.message:'3D 모델을 불러오지 못했습니다.');invalidate();}});return()=>{canceled=true;asset.release();};},[shareId,hash,local,localUrl,bounds,allowFlat,invalidate]);
 return {source,error};
}
