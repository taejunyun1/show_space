import {Box3,Euler,Matrix4,Quaternion,Vector3} from 'three';
import type {ModelArtwork,Project,ReferenceModel,WorldPoint} from './types';
import {validateReferenceModel} from './referenceModel';
import {inspectStaticArtworkGlb} from '../lib/artworkModelPayload';

export const MAX_MODEL_ARTWORKS=50;
export function parseModelArtwork(value:unknown,checkAsset=true):ModelArtwork{
 const a=value as ModelArtwork;
 if(!a||typeof a!=='object')throw new Error('3D 작품 정보가 올바르지 않습니다.');
 for(const key of ['id','name','artist','year','note'] as const)if(typeof a[key]!=='string'||a[key].length>(key==='note'?20000:200)||(['id','name'].includes(key)&&!a[key].trim()))throw new Error(`3D 작품 ${key}가 올바르지 않습니다.`);
 if(!['sculpture','installation','object','custom'].includes(a.kind)||typeof a.visible!=='boolean'||typeof a.locked!=='boolean'||(a.groupId!==undefined&&(typeof a.groupId!=='string'||!a.groupId||a.groupId.length>200)))throw new Error('3D 작품 속성이 올바르지 않습니다.');
 for(const key of ['widthMm','heightMm','depthMm'] as const)if(!Number.isFinite(a[key])||a[key]<1||a[key]>50000)throw new Error('3D 작품 크기는 1–50,000mm 범위여야 합니다.');
 for(const key of ['position','rotation'] as const){const p=a[key];if(!p||['x','y','z'].some(k=>!Number.isFinite(p[k as keyof WorldPoint])||Math.abs(p[k as keyof WorldPoint])>(key==='position'?1e7:180)))throw new Error('3D 작품 위치 또는 회전이 올바르지 않습니다.');}
 if(!a.model||typeof a.model!=='object')throw new Error('3D 작품 원본이 없습니다.');
 if(checkAsset){
 validateReferenceModel({...a.model,visible:true,positionMm:[0,0,0],rotationDeg:0,scale:1});
 if(a.model.sizeMm.some(n=>n<.001))throw new Error('3D 작품에는 폭·높이·깊이가 있는 형상이 필요합니다.');
 inspectStaticArtworkGlb(Uint8Array.from(atob(a.model.dataUrl.split(',')[1]),c=>c.charCodeAt(0)).buffer);
 }
 return {...a,position:{...a.position},rotation:{...a.rotation}};
}
export function parseModelArtworks(value:unknown,reserved:Iterable<string>=[]):ModelArtwork[]{
 if(!Array.isArray(value)||value.length>MAX_MODEL_ARTWORKS)throw new Error(`3D 작품은 최대 ${MAX_MODEL_ARTWORKS}개까지 만들 수 있습니다.`);
 const ids=new Set(reserved);return value.map(v=>{const a=parseModelArtwork(v);if(ids.has(a.id))throw new Error('3D 작품에 중복된 객체 ID가 있습니다.');ids.add(a.id);return a;});
}
export function modelArtworkMembers(project:Pick<Project,'modelArtworks'>,id:string){const a=project.modelArtworks?.find(a=>a.id===id);return project.modelArtworks?.filter(b=>b.id===id||!!a?.groupId&&a.groupId===b.groupId)??[];}
export function modelArtworkMatrix(a:Pick<ModelArtwork,'position'|'rotation'>){return new Matrix4().compose(new Vector3(a.position.x/1000,a.position.y/1000,a.position.z/1000),new Quaternion().setFromEuler(new Euler(a.rotation.x*Math.PI/180,a.rotation.y*Math.PI/180,a.rotation.z*Math.PI/180,'XYZ')),new Vector3(1,1,1));}
export function modelArtworkCorners(a:ModelArtwork):WorldPoint[]{
 const m=modelArtworkMatrix(a),points:WorldPoint[]=[];
 for(const x of [-a.widthMm/2000,a.widthMm/2000])for(const y of [0,a.heightMm/1000])for(const z of [-a.depthMm/2000,a.depthMm/2000]){const p=new Vector3(x,y,z).applyMatrix4(m);points.push({x:p.x*1000,y:p.y*1000,z:p.z*1000});}return points;
}
export function modelArtworkBounds(a:ModelArtwork){const b=new Box3().setFromPoints(modelArtworkCorners(a).map(p=>new Vector3(p.x,p.y,p.z)));return {minX:b.min.x,maxX:b.max.x,minY:b.min.y,maxY:b.max.y,minZ:b.min.z,maxZ:b.max.z};}
export function modelArtworkFootprint(a:ModelArtwork){
 // Convex hull of all eight corners: tipping an object changes its plan footprint.
 const points=modelArtworkCorners(a).map(p=>({x:p.x,z:p.z})).sort((a,b)=>a.x-b.x||a.z-b.z),cross=(a:WorldPoint|{x:number;z:number},b:{x:number;z:number},c:{x:number;z:number})=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
 const half=(list:typeof points)=>{const out:typeof points=[];for(const p of list){while(out.length>=2&&cross(out[out.length-2],out[out.length-1],p)<=0)out.pop();out.push(p);}out.pop();return out;};return [...half(points),...half([...points].reverse())];
}
export function addModelArtwork(project:Project,model:ReferenceModel):{project:Project;artwork:ModelArtwork}{
 if(project.planDraft&&!project.planReference?.calibrated)throw new Error('3D 작품을 배치하려면 도면 축척을 먼저 보정하세요.');
 if((project.modelArtworks?.length??0)>=MAX_MODEL_ARTWORKS)throw new Error(`3D 작품은 최대 ${MAX_MODEL_ARTWORKS}개까지 만들 수 있습니다.`);
 const used=new Set([...project.walls,...project.artworks,...project.unplacedArtworks??[],...project.lights??[],...project.modelArtworks??[]].map(a=>a.id));let index=1;while(used.has(`model-artwork-${index}`))index++;
 const artwork=parseModelArtwork({id:`model-artwork-${index}`,name:model.name.replace(/\.[^.]+$/,''),artist:'',year:'',kind:'sculpture',model:{name:model.name,dataUrl:model.dataUrl,sizeMm:model.sizeMm,sourceOffsetM:model.sourceOffsetM},widthMm:Math.max(1,model.sizeMm[0]),heightMm:Math.max(1,model.sizeMm[1]),depthMm:Math.max(1,model.sizeMm[2]),position:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0},visible:true,locked:false,note:''});
 return {project:{...project,modelArtworks:[...project.modelArtworks??[],artwork]},artwork};
}
export function patchModelArtwork(project:Project,id:string,patch:Partial<ModelArtwork>):Project{
 const a=project.modelArtworks?.find(a=>a.id===id);if(!a)throw new Error('3D 작품을 찾을 수 없습니다.');
 if(['id','model','groupId'].some(k=>k in patch))throw new Error('3D 작품의 원본·ID·그룹은 직접 변경할 수 없습니다.');
 if(a.locked&&Object.keys(patch).some(k=>!['name','note','visible','locked'].includes(k)))throw new Error('잠긴 3D 작품은 편집할 수 없습니다.');
 const next=parseModelArtwork({...a,...patch},false);return {...project,modelArtworks:project.modelArtworks!.map(b=>b.id===id?next:b)};
}
/** Apply one world delta to a selection, preserving spacing and each model's dimensions. */
export function transformModelArtworks(project:Project,ids:string[],pivotId:string,position:WorldPoint,rotation:WorldPoint):Project{
 const items=project.modelArtworks??[],pivot=items.find(a=>a.id===pivotId);if(!pivot||!ids.includes(pivotId))throw new Error('선택한 3D 작품을 찾을 수 없습니다.');
 if(items.some(a=>ids.includes(a.id)&&a.locked))throw new Error('잠긴 3D 작품이 포함되어 이동·회전할 수 없습니다.');
 const delta=modelArtworkMatrix({...pivot,position,rotation}).multiply(modelArtworkMatrix(pivot).invert());
 return {...project,modelArtworks:items.map(a=>{if(!ids.includes(a.id))return a;const matrix=delta.clone().multiply(modelArtworkMatrix(a)),p=new Vector3(),q=new Quaternion(),scale=new Vector3();matrix.decompose(p,q,scale);const e=new Euler().setFromQuaternion(q,'XYZ');return parseModelArtwork({...a,position:{x:p.x*1000,y:p.y*1000,z:p.z*1000},rotation:{x:e.x*180/Math.PI,y:e.y*180/Math.PI,z:e.z*180/Math.PI}},false);})};
}
export function groupModelArtworks(project:Project,ids:string[],ungroup=false):Project{
 const members=new Set(ids.flatMap(id=>modelArtworkMembers(project,id).map(a=>a.id)));
 if(!ungroup&&members.size<2)throw new Error('3D 작품을 두 개 이상 선택하세요.');
 if(project.modelArtworks?.some(a=>members.has(a.id)&&a.locked))throw new Error('잠긴 3D 작품의 그룹은 변경할 수 없습니다.');
 const groupId=ungroup?undefined:crypto.randomUUID();return {...project,modelArtworks:project.modelArtworks?.map(a=>members.has(a.id)?{...a,groupId}:a)};
}
