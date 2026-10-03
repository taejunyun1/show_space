import {useEffect,useMemo,useState} from 'react';
import {Html,Line,PivotControls} from '@react-three/drei';
import {useThree,type ThreeEvent} from '@react-three/fiber';
import {Euler,Quaternion,Vector3,type Group} from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {useEditor} from '../state/editor';
import {modelArtworkMatrix,modelArtworkCorners} from '../domain/modelArtworks';
import type {ModelArtwork} from '../domain/types';
import {fixedAnchor} from '../domain/measurements';
import {disposeModelAsset} from '../lib/modelAssetResources';
import {checkModelArtworkBounds,placeModelArtwork} from '../lib/modelArtworkGeometry';

// Each model's geometry and textures are shared by duplicates; node transforms are independent.
const assets=new Map<string,{refs:number;promise:Promise<Group>;scene?:Group;scenes?:Group[]}>();
function acquire(dataUrl:string){let entry=assets.get(dataUrl);if(!entry){const bytes=Uint8Array.from(atob(dataUrl.split(',')[1]),c=>c.charCodeAt(0));entry={refs:0,promise:new GLTFLoader().parseAsync(bytes.buffer,'').then(g=>{owned.scenes=g.scenes;return g.scene;})};assets.set(dataUrl,entry);const owned=entry;void entry.promise.then(scene=>{owned.scene=scene;if(!owned.refs){disposeModelAsset(owned.scenes??scene);owned.scene=undefined;if(assets.get(dataUrl)===owned)assets.delete(dataUrl);}},()=>{if(assets.get(dataUrl)===owned)assets.delete(dataUrl);});}entry.refs++;const owned=entry;return {promise:entry.promise,release:()=>{owned.refs--;setTimeout(()=>{if(!owned.refs&&owned.scene){disposeModelAsset(owned.scenes??owned.scene);if(assets.get(dataUrl)===owned)assets.delete(dataUrl);owned.scene=undefined;}},0);}};}
function Artwork3D({artwork:a}:{artwork:ModelArtwork}){
 const state=useEditor(),{invalidate}=useThree(),[source,setSource]=useState<Group|null>(null),[error,setError]=useState('');
 const selected=state.selected.some(s=>s.type==='modelArtwork'&&s.id===a.id);
 useEffect(()=>{let cancelled=false;setSource(null);setError('');const asset=acquire(a.model.dataUrl);void asset.promise.then(scene=>{if(cancelled)return;try{checkModelArtworkBounds(scene,a.model);scene.traverse(o=>{if('castShadow' in o){o.castShadow=true;o.receiveShadow=true;}});setSource(scene);invalidate();}catch(e){setError(e instanceof Error?e.message:'3D 작품을 표시하지 못했습니다.');}},()=>{if(!cancelled)setError('3D 작품을 표시하지 못했습니다. 모델을 다시 가져오세요.');});return()=>{cancelled=true;asset.release();};},[a.model.dataUrl,a.model.sizeMm,a.model.sourceOffsetM,invalidate]);
 useEffect(()=>()=>{if(useEditor.getState().modelArtworkGesture?.id===a.id)useEditor.getState().finishModelArtworkTransform(true);},[a.id]);
 const placed=useMemo(()=>source?placeModelArtwork(a,source):null,[a,source]),matrix=useMemo(()=>modelArtworkMatrix(a),[a.position.x,a.position.y,a.position.z,a.rotation.x,a.rotation.y,a.rotation.z]);
 const box=modelArtworkCorners(a),pairs=[[0,1],[0,2],[0,4],[1,3],[1,5],[2,3],[2,6],[3,7],[4,5],[4,6],[5,7],[6,7]];
 function pick(e:ThreeEvent<PointerEvent>){if(state.activeTool==='pan'||state.activeTool==='draw')return;e.stopPropagation();if(state.activeTool==='measure'){const p=e.point;state.pickMeasurement(fixedAnchor({x:p.x*1000,y:p.y*1000,z:p.z*1000}),'3d');}else state.select({type:'modelArtwork',id:a.id},e.shiftKey);}
 return <>{placed&&<primitive object={placed} dispose={null} onPointerDown={pick}/>} {error&&<Html position={[a.position.x/1000,a.position.y/1000,a.position.z/1000]}><span className="dimension-label">{error}</span></Html>}
 {selected&&!state.captureClean&&<>{pairs.map(([i,j],k)=><Line key={k} points={[box[i],box[j]].map(p=>[p.x/1000,p.y/1000,p.z/1000]) as [number,number,number][]} color="#365cf5" lineWidth={1.5}/>)}</>}
 {placed&&selected&&!a.locked&&!state.captureClean&&state.selected.filter(s=>s.type==='modelArtwork')[0]?.id===a.id&&['select','move','rotate'].includes(state.activeTool)&&<PivotControls matrix={matrix} autoTransform={false} fixed scale={75} depthTest={false} disableScaling disableSliders disableRotations={state.activeTool!=='rotate'} disableAxes={state.activeTool==='rotate'} userData={{modelArtworkHandle:true}} onDragStart={()=>state.beginModelArtworkTransform(a.id)} onDrag={(_local,_delta,world)=>{if(useEditor.getState().modelArtworkGesture?.id!==a.id)return;const p=new Vector3(),q=new Quaternion(),s=new Vector3();world.decompose(p,q,s);const e=new Euler().setFromQuaternion(q,'XYZ');state.updateModelArtworkTransform({x:p.x*1000,y:p.y*1000,z:p.z*1000},{x:e.x*180/Math.PI,y:e.y*180/Math.PI,z:e.z*180/Math.PI});}} onDragEnd={()=>state.finishModelArtworkTransform()}/>}</>;
}
export function ModelArtworks3D(){const state=useEditor(),project=state.previewProject??state.project;return <>{project.modelArtworks?.filter(a=>a.visible).map(a=><Artwork3D key={a.id} artwork={a}/>)}</>;}
