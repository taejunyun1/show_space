import {Box3,Group,Mesh,Vector3,type Object3D} from 'three';
import type {ModelArtwork} from '../domain/types';
import type {ReferenceModelPlacement} from '../domain/referenceModel';
/** Recompute bounds from actual decoded geometry instead of trusting accessor min/max. */
export function modelAssetBounds(scene:Object3D,allowFlat=false){
 scene.traverse(o=>{if(o instanceof Mesh){const p=o.geometry.getAttribute('position');if(!p)throw new Error('모델 정점이 없습니다.');for(let i=0;i<p.count;i++)if(![p.getX(i),p.getY(i),p.getZ(i)].every(Number.isFinite))throw new Error('모델에 올바르지 않은 정점이 있습니다.');o.geometry.computeBoundingBox();o.geometry.computeBoundingSphere();}});
 const box=new Box3().setFromObject(scene,true),size=box.getSize(new Vector3()),center=box.getCenter(new Vector3());
 if(box.isEmpty()||![...size.toArray(),...center.toArray()].every(Number.isFinite)||(allowFlat?Math.max(...size.toArray())<.000001:size.toArray().some(n=>n<.000001)))throw new Error('표시할 크기가 있는 정적 모델을 선택하세요.');
 return {sizeMm:[size.x*1000,size.y*1000,size.z*1000] as [number,number,number],sourceOffsetM:[-center.x,-box.min.y,-center.z] as [number,number,number]};
}
type AssetBounds=Pick<ModelArtwork['model'],'sizeMm'|'sourceOffsetM'>;
export function checkModelAssetBounds(scene:Object3D,model:AssetBounds,allowFlat=false){const actual=modelAssetBounds(scene,allowFlat);if(actual.sizeMm.some((n,i)=>Math.abs(n-model.sizeMm[i])>Math.max(.01,n*1e-5))||actual.sourceOffsetM.some((n,i)=>Math.abs(n-model.sourceOffsetM[i])>.00001))throw new Error('모델의 저장된 크기·기준점이 원본 형상과 일치하지 않습니다. 다시 가져오세요.');}
export function checkModelArtworkBounds(scene:Object3D,model:AssetBounds){checkModelAssetBounds(scene,model);}
export function checkReferenceModelBounds(scene:Object3D,model:AssetBounds){checkModelAssetBounds(scene,model,true);}
export function placeReferenceModel(model:ReferenceModelPlacement,source:Object3D){const root=new Group(),offset=new Group();root.position.set(...model.positionMm.map(v=>v/1000) as [number,number,number]);root.rotation.y=model.rotationDeg*Math.PI/180;root.scale.setScalar(model.scale);offset.position.set(...model.sourceOffsetM);offset.add(source.clone(true));root.add(offset);return root;}
export function placeModelArtwork(a:ModelArtwork,source:Object3D){
 const root=new Group(),scaled=new Group(),offset=new Group();root.name=`model-artwork-${a.id}`;root.position.set(a.position.x/1000,a.position.y/1000,a.position.z/1000);root.rotation.set(a.rotation.x*Math.PI/180,a.rotation.y*Math.PI/180,a.rotation.z*Math.PI/180,'XYZ');scaled.scale.set(a.widthMm/a.model.sizeMm[0],a.heightMm/a.model.sizeMm[1],a.depthMm/a.model.sizeMm[2]);offset.position.set(...a.model.sourceOffsetM);offset.add(source.clone(true));scaled.add(offset);root.add(scaled);root.userData={gonggan:{kind:'modelArtwork',id:a.id,name:a.name,artist:a.artist,year:a.year,type:a.kind,widthMm:a.widthMm,heightMm:a.heightMm,depthMm:a.depthMm}};return root;
}
