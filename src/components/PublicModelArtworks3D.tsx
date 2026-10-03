import {useEffect,useMemo,useState} from 'react';
import {Html,Line} from '@react-three/drei';
import {useThree,type ThreeEvent} from '@react-three/fiber';
import {Mesh,type Group} from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import type {PublicModelArtwork} from '../domain/publicShare';
import {publicModelArtworkPose} from '../domain/publicModelArtwork';
import {modelArtworkCorners} from '../domain/modelArtworks';
import {checkModelArtworkBounds,placeModelArtwork} from '../lib/modelArtworkGeometry';
import {inspectStaticArtworkGlb} from '../lib/artworkModelPayload';
import {publicModelHash} from '../lib/publicModelAsset';
import {MODEL_MAX_BYTES} from '../lib/glbPayload';
import {disposeModelAsset} from '../lib/modelAssetResources';

interface Asset {refs:number;promise:Promise<Group>;controller:AbortController;scenes?:Group[];scene?:Group}
const assets=new Map<string,Asset>();
async function boundedModelResponse(response:Response){if(!response.ok)throw new Error(response.status===410?'중단된 공유 링크입니다.':'3D 작품 모델을 불러오지 못했습니다.');if(Number(response.headers.get('content-length'))>MODEL_MAX_BYTES)throw new Error('공유 모델 크기가 제한을 초과합니다.');const reader=response.body?.getReader();if(!reader)throw new Error('공유 모델 자산이 없습니다.');const chunks:Uint8Array[]=[];let length=0;try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>MODEL_MAX_BYTES){await reader.cancel();throw new Error('공유 모델 크기가 제한을 초과합니다.');}chunks.push(value);}}finally{reader.releaseLock();}const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes.buffer;}
function acquire(shareId:string,hash:string){const key=`${shareId}:${hash}`;let entry=assets.get(key);if(!entry){const controller=new AbortController();const owned={refs:0,controller} as Asset;const timer=setTimeout(()=>controller.abort(),20000);owned.promise=fetch(`/api/public/${shareId}/models/${hash}`,{signal:controller.signal,cache:'no-store'}).then(boundedModelResponse).then(async bytes=>{inspectStaticArtworkGlb(bytes);if(await publicModelHash(bytes)!==hash)throw new Error('공유 모델 자산이 손상됐습니다.');const gltf=await new GLTFLoader().parseAsync(bytes,'');owned.scenes=gltf.scenes;return gltf.scene;}).finally(()=>clearTimeout(timer));entry=owned;assets.set(key,owned);void owned.promise.then(scene=>{owned.scene=scene;if(!owned.refs){disposeModelAsset(owned.scenes??scene);owned.scene=undefined;if(assets.get(key)===owned)assets.delete(key);}},()=>{if(assets.get(key)===owned)assets.delete(key);});}entry.refs++;const owned=entry;return {promise:owned.promise,release:()=>{owned.refs--;setTimeout(()=>{if(!owned.refs){owned.controller.abort();if(owned.scene){disposeModelAsset(owned.scenes??owned.scene);owned.scene=undefined;}if(assets.get(key)===owned)assets.delete(key);}},0);}};}
function PublicModel({artwork:a,shareId,selected,onSelect,measuring,onMeasure}:{artwork:PublicModelArtwork;shareId:string;selected:boolean;onSelect:(id:string)=>void;measuring:boolean;onMeasure:(event:ThreeEvent<PointerEvent>)=>void}){
 const {invalidate}=useThree(),[source,setSource]=useState<Group|null>(null),[error,setError]=useState('');
 const pose=useMemo(()=>publicModelArtworkPose(a),[a]);
 useEffect(()=>{let canceled=false;const asset=acquire(shareId,a.modelId);setSource(null);setError('');void asset.promise.then(scene=>{if(canceled)return;try{checkModelArtworkBounds(scene,pose.model);scene.traverse(o=>{if(o instanceof Mesh){o.castShadow=true;o.receiveShadow=true;}});setSource(scene);invalidate();}catch(e){setError(e instanceof Error?e.message:'3D 작품을 불러오지 못했습니다.');}},e=>{if(!canceled){setError(e instanceof Error?e.message:'3D 작품을 불러오지 못했습니다.');invalidate();}});return()=>{canceled=true;asset.release();};},[shareId,a.modelId,pose.model,invalidate]);
 const object=useMemo(()=>source?placeModelArtwork(pose,source):null,[pose,source]),corners=modelArtworkCorners(a),pairs=[[0,1],[0,2],[0,4],[1,3],[1,5],[2,3],[2,6],[3,7],[4,5],[4,6],[5,7],[6,7]];
 return <>{object&&<primitive object={object} dispose={null} onPointerDown={measuring?onMeasure:undefined} onClick={(event:ThreeEvent<MouseEvent>)=>{event.stopPropagation();if(!measuring)onSelect(a.id);}}/>} {selected&&pairs.map(([i,j],k)=><Line key={k} points={[corners[i],corners[j]].map(p=>[p.x/1000,p.y/1000,p.z/1000]) as [number,number,number][]} color="#365cf5" lineWidth={1.2}/>)}{error&&<Html position={[a.position.x/1000,a.position.y/1000,a.position.z/1000]} center><span className="shared-image-error" role="alert">{error}</span></Html>}</>;
}
export function PublicModelArtworks3D({artworks,shareId,selectedId,onSelect,measuring,onMeasure}:{artworks:PublicModelArtwork[];shareId:string;selectedId:string|null;onSelect:(id:string)=>void;measuring:boolean;onMeasure:(event:ThreeEvent<PointerEvent>)=>void}){return <>{artworks.map(a=><PublicModel key={a.id} artwork={a} shareId={shareId} selected={selectedId===a.id} onSelect={onSelect} measuring={measuring} onMeasure={onMeasure}/>)}</>;}
