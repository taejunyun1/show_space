import {parseOutdoor,type OutdoorSettings} from './outdoor';
import {parseLights,parseLighting,type ExhibitionLight,type LightingSettings} from './lighting';
import {textureSize} from './surfaceTexture';
import {parseSurfaceMaterial,type SurfaceMaterial} from './materials';
import {validateImportedFloor} from './importedFloor';
import {installationZones} from './installationZones';
import {resolveMeasurement} from './measurements';
import {openingSegments} from './openings';
import {artPanel} from '../lib/art';
import type {Point,Project,WorldPoint,CameraView,ModelArtwork,ReferenceModel} from './types';

export type PublicSurfaceMaterial=Omit<SurfaceMaterial,'texture'>&{texture?:{imageId:string;widthMm:number;heightMm:number}};
export type PublicModelArtwork=Pick<ModelArtwork,'id'|'name'|'artist'|'year'|'kind'|'widthMm'|'heightMm'|'depthMm'|'position'|'rotation'>&{modelId:string;sizeMm:[number,number,number];sourceOffsetM:[number,number,number]};
export type PublicReferenceModel=Pick<ReferenceModel,'sizeMm'|'sourceOffsetM'|'positionMm'|'rotationDeg'|'scale'>&{modelId:string};
export type PublicLight=Pick<ExhibitionLight,'id'|'name'|'kind'|'position'|'target'|'intensity'|'kelvin'|'beamDeg'|'penumbra'|'distanceMm'|'widthMm'|'heightMm'|'shadow'|'visible'>;
function publicLight(l:ExhibitionLight):PublicLight{return {id:l.id,name:l.name,kind:l.kind,position:{...l.position},target:{...l.target},intensity:l.intensity,kelvin:l.kelvin,beamDeg:l.beamDeg,penumbra:l.penumbra,distanceMm:l.distanceMm,widthMm:l.widthMm,heightMm:l.heightMm,shadow:l.shadow,visible:l.visible};}
export interface PublicSceneSnapshot {
  referenceModel?:PublicReferenceModel;
  modelArtworks?:PublicModelArtwork[]
  outdoor?:OutdoorSettings
  lights?:PublicLight[]
  lighting?:LightingSettings
  importedFloor?:Point[][];
  schemaVersion:1;
  name:string;
  venue:string;
  floorColor:string;
  floorMaterial?:PublicSurfaceMaterial;
  walls:Array<{id:string;name:string;start:Point;end:Point;heightMm:number;thicknessMm:number;color:string;material?:PublicSurfaceMaterial;role?:'boundary'|'partition'}>;
  artworks:Array<{id:string;name:string;artist:string;wallId:string;wallSide:'front'|'back';widthMm:number;heightMm:number;depthMm:number;alongMm:number;centerHeightMm:number;rotationDeg?:number;frame:'black'|'natural'|'white'|'none';imageId:string;material?:PublicSurfaceMaterial;spritePanel?:number}>;
  openings:Array<{id:string;kind:'door'|'window'|'stair-access';start:Point;end:Point}>;
  zones:Array<{id:string;kind:'stairs';x:number;z:number;width:number;depth:number}>;
  dimensions?:Array<{id:string;view:'plan'|'elevation'|'3d';elevationWallId?:string;start:WorldPoint;end:WorldPoint;distanceMm:number}>;
  camera?:CameraView;
}

export const PUBLIC_SCENES_MAX=20;
export const PUBLIC_IMAGES_MAX=1000;
export const PUBLIC_SNAPSHOT_MAX_BYTES=1_000_000;
export interface PublicShareSnapshot extends PublicSceneSnapshot {
 scenes?:Array<{id:string;name:string;snapshot:PublicSceneSnapshot}>;
}

export interface PublicShareOptions {
  sceneIds?:readonly string[];
  referenceAssetId?:string;
  modelAssetIds?:ReadonlyMap<string,string>;
  includeDimensions:boolean;
  camera?:PublicShareSnapshot['camera'];
}

export function createPublicShare(project:Project,options:PublicShareOptions){
  const m=project.referenceModel?.visible?project.referenceModel:undefined;
  if(m&&!options.referenceAssetId)throw new Error('전시장 모델의 공개 자산을 먼저 준비해야 합니다.');
  const referenceModel:PublicReferenceModel|undefined=m?{modelId:options.referenceAssetId!,sizeMm:[...m.sizeMm],sourceOffsetM:[...m.sourceOffsetM],positionMm:[...m.positionMm],rotationDeg:m.rotationDeg,scale:m.scale}:undefined;
  const modelArtworks=(project.modelArtworks??[]).filter(a=>a.visible).map(a=>{const modelId=options.modelAssetIds?.get(a.id);if(!modelId)throw new Error('3D 작품의 공개 모델 자산을 먼저 준비해야 합니다.');return {id:a.id,name:a.name,artist:a.artist,year:a.year,kind:a.kind,widthMm:a.widthMm,heightMm:a.heightMm,depthMm:a.depthMm,position:{...a.position},rotation:{...a.rotation},modelId,sizeMm:[...a.model.sizeMm] as [number,number,number],sourceOffsetM:[...a.model.sourceOffsetM] as [number,number,number]};});
  if(project.planDraft&&!project.planReference?.calibrated)throw new Error('축척 보정 후 3D 공간을 공유할 수 있습니다.');
  const visibleWalls=project.walls.filter(wall=>wall.visible);
  const wallIds=new Set(visibleWalls.map(wall=>wall.id));
  const artworks=project.artworks.filter(art=>art.visible&&wallIds.has(art.wallId)&&!!art.imageUrl);
  const uploads=artworks.map((art,index)=>({imageId:String(index),sourceUrl:art.imageUrl})),textureIds=new Map<string,string>();
  const material=(m:SurfaceMaterial):PublicSurfaceMaterial=>{const parsed=parseSurfaceMaterial(m),{texture,...finish}=parsed;if(!texture)return finish;let imageId=textureIds.get(texture.imageUrl);if(!imageId){imageId=String(uploads.length);textureIds.set(texture.imageUrl,imageId);uploads.push({imageId,sourceUrl:texture.imageUrl});}return {...finish,texture:{imageId,widthMm:texture.widthMm,heightMm:texture.heightMm}};};
  const snapshot:PublicShareSnapshot={
    ...(referenceModel?{referenceModel}:{}),...(modelArtworks.length?{modelArtworks}:{}),schemaVersion:1,...(project.outdoor?{outdoor:parseOutdoor(project.outdoor)}:{}),name:project.name,venue:project.venue,...(project.lights!==undefined?{lights:project.lights.filter(l=>l.visible).map(publicLight)}:{}),...(project.lighting?{lighting:project.lighting}:{}),floorColor:project.floorColor,...(project.floorMaterial?{floorMaterial:material(project.floorMaterial)}:{}),...(project.importedFloor?{importedFloor:structuredClone(project.importedFloor)}:{}),
    walls:visibleWalls.map(wall=>({id:wall.id,name:wall.name,start:{...wall.start},end:{...wall.end},heightMm:wall.heightMm,thicknessMm:wall.thicknessMm,color:wall.color,...(wall.material?{material:material(wall.material)}:{}),...(wall.role?{role:wall.role}:{})})),
    artworks:artworks.map((art,index)=>({id:art.id,name:art.name,artist:art.artist,wallId:art.wallId,wallSide:art.wallSide??'front',widthMm:art.widthMm,heightMm:art.heightMm,depthMm:art.depthMm,alongMm:art.alongMm,centerHeightMm:art.centerHeightMm,...(art.rotationDeg===undefined?{}:{rotationDeg:art.rotationDeg}),frame:art.frame,...(art.material?{material:material(art.material)}:{}),imageId:String(index),...(artPanel(art.imageUrl)!==null?{spritePanel:artPanel(art.imageUrl)!}:{})})),
    openings:openingSegments({walls:project.walls,openings:(project.openings??[]).filter(opening=>[opening.start,opening.end].every(anchor=>!anchor.wallId||wallIds.has(anchor.wallId)))}).map(opening=>({id:opening.id,kind:opening.kind,start:{...opening.start},end:{...opening.end}})),
    zones:installationZones(project).map(zone=>({...zone})),
    ...(options.includeDimensions?{dimensions:(project.dimensions??[]).filter(dim=>(!dim.elevationWallId||wallIds.has(dim.elevationWallId))&&[dim.start,dim.end].every(anchor=>anchor.kind!=='wall'||wallIds.has(anchor.wallId))).map(dim=>{const resolved=resolveMeasurement(project,dim);return {id:dim.id,view:dim.view,...(dim.elevationWallId?{elevationWallId:dim.elevationWallId}:{}),start:resolved.start,end:resolved.end,distanceMm:resolved.distanceMm};})}:{}),
    ...(options.camera?{camera:options.camera}:{})
  };
  return {snapshot:parsePublicShare(snapshot),uploads};
}

const record=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('공유 데이터 형식이 올바르지 않습니다.');return value as Record<string,unknown>;};
const str=(value:unknown,max=200)=>{if(typeof value!=='string'||value.length>max)throw new Error('공유 텍스트가 올바르지 않습니다.');return value;};
const num=(value:unknown,min=-1e7,max=1e7)=>{if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new Error('공유 치수가 올바르지 않습니다.');return value;};
const point=(value:unknown):Point=>{const p=record(value);return {x:num(p.x),z:num(p.z)};};
const world=(value:unknown):WorldPoint=>{const p=record(value);return {x:num(p.x),y:num(p.y),z:num(p.z)};};
const color=(value:unknown)=>{const v=str(value,32);if(!/^#[0-9a-f]{6}$/i.test(v))throw new Error('공유 색상이 올바르지 않습니다.');return v;};
const list=(value:unknown,max:number)=>{if(!Array.isArray(value)||value.length>max)throw new Error('공유 객체 수가 올바르지 않습니다.');return value as unknown[];};
const oneOf=<T extends string>(value:unknown,choices:readonly T[]):T=>{if(typeof value!=='string'||!choices.includes(value as T))throw new Error('공유 객체 종류가 올바르지 않습니다.');return value as T;};
const id=(value:unknown)=>{const v=str(value,100);if(!/^[a-zA-Z0-9_.:-]+$/.test(v))throw new Error('공유 객체 ID가 올바르지 않습니다.');return v;};

function publicLayouts(snapshot:PublicShareSnapshot):PublicSceneSnapshot[]{return [snapshot,...(snapshot.scenes??[]).map(scene=>scene.snapshot)];}
export function publicModelIds(snapshot:PublicShareSnapshot){return [...new Set(publicLayouts(snapshot).flatMap(s=>[...(s.modelArtworks?.map(a=>a.modelId)??[]),...(s.referenceModel?[s.referenceModel.modelId]:[])]))];}
export function publicImageIds(snapshot:PublicShareSnapshot){return [...new Set(publicLayouts(snapshot).flatMap(s=>[...s.artworks.map(a=>a.imageId),s.floorMaterial?.texture?.imageId,...s.walls.map(w=>w.material?.texture?.imageId)]).filter((id):id is string=>id!==undefined))];}
function publicMaterial(input:unknown):PublicSurfaceMaterial{
 const raw=record(input),{texture:_,...scalar}=parseSurfaceMaterial({...raw,texture:undefined});
 if(raw.texture===undefined)return scalar;
 const texture=record(raw.texture),imageId=str(texture.imageId,4);if(!/^(0|[1-9][0-9]{0,3})$/.test(imageId))throw new Error('공유 텍스처 ID가 올바르지 않습니다.');
 return {...scalar,texture:{imageId,...textureSize(texture)}};
}
/** Rebuilds the public allowlist on the server as well as in the editor. */
function parsePublicScene(input:unknown):PublicSceneSnapshot{
  const raw=record(input);
  if(raw.scenes!==undefined)throw new Error('Scene 안에 다른 Scene을 포함할 수 없습니다.');
  if(raw.schemaVersion!==1)throw new Error('지원하지 않는 공유 형식입니다.');
  const walls=list(raw.walls,200).map(value=>{const w=record(value);return {id:id(w.id),name:str(w.name),start:point(w.start),end:point(w.end),heightMm:num(w.heightMm,1),thicknessMm:num(w.thicknessMm,1),color:color(w.color),...(w.material===undefined?{}:{material:publicMaterial(w.material)}),...(w.role===undefined?{}:{role:oneOf(w.role,['boundary','partition'] as const)})};});
  const wallIds=new Set(walls.map(w=>w.id));
  if(wallIds.size!==walls.length)throw new Error('공유 벽 목록이 올바르지 않습니다.');
  const artworks=list(raw.artworks,500).map(value=>{const a=record(value);if(a.material!==undefined&&publicMaterial(a.material).texture)throw new Error('공유 작품 표면은 별도 반복 텍스처를 지원하지 않습니다.');const wallId=id(a.wallId);if(!wallIds.has(wallId))throw new Error('공유 작품의 벽 연결이 올바르지 않습니다.');const imageId=str(a.imageId,4);if(!/^(0|[1-9][0-9]{0,3})$/.test(imageId))throw new Error('공유 이미지 ID가 올바르지 않습니다.');const spritePanel=a.spritePanel===undefined?undefined:num(a.spritePanel,0,4);if(spritePanel!==undefined&&!Number.isInteger(spritePanel))throw new Error('공유 작품 이미지 위치가 올바르지 않습니다.');return {id:id(a.id),name:str(a.name),artist:str(a.artist),wallId,wallSide:oneOf(a.wallSide,['front','back'] as const),widthMm:num(a.widthMm,1),heightMm:num(a.heightMm,1),depthMm:num(a.depthMm,1),alongMm:num(a.alongMm),centerHeightMm:num(a.centerHeightMm),...(a.rotationDeg===undefined?{}:{rotationDeg:num(a.rotationDeg,-180,180)}),frame:oneOf(a.frame,['black','natural','white','none'] as const),...(a.material===undefined?{}:{material:publicMaterial(a.material)}),imageId,...(spritePanel===undefined?{}:{spritePanel})};});
  if(new Set(artworks.map(a=>a.id)).size!==artworks.length)throw new Error('공유 작품 목록이 올바르지 않습니다.');
  const modelArtworks=raw.modelArtworks===undefined?undefined:list(raw.modelArtworks,50).map(value=>{const a=record(value),tuple=(v:unknown,min:number,max:number):[number,number,number]=>{if(!Array.isArray(v)||v.length!==3)throw new Error('공유 모델 크기·기준점이 올바르지 않습니다.');return [num(v[0],min,max),num(v[1],min,max),num(v[2],min,max)];},modelId=str(a.modelId,64);if(!/^[0-9a-f]{64}$/.test(modelId))throw new Error('공유 모델 자산 ID가 올바르지 않습니다.');const r=record(a.rotation);return {id:id(a.id),name:str(a.name),artist:str(a.artist),year:str(a.year),kind:oneOf(a.kind,['sculpture','installation','object','custom'] as const),widthMm:num(a.widthMm,1,50000),heightMm:num(a.heightMm,1,50000),depthMm:num(a.depthMm,1,50000),position:world(a.position),rotation:{x:num(r.x,-180,180),y:num(r.y,-180,180),z:num(r.z,-180,180)},sizeMm:tuple(a.sizeMm,.001,1e7),sourceOffsetM:tuple(a.sourceOffsetM,-1e5,1e5),modelId};});
  const referenceModel=raw.referenceModel===undefined?undefined:(()=>{const m=record(raw.referenceModel),tuple=(v:unknown,min:number,max:number):[number,number,number]=>{if(!Array.isArray(v)||v.length!==3)throw new Error('공유 전시장 모델 좌표가 올바르지 않습니다.');return [num(v[0],min,max),num(v[1],min,max),num(v[2],min,max)];},modelId=str(m.modelId,64);if(!/^[0-9a-f]{64}$/.test(modelId))throw new Error('공유 전시장 모델 자산 ID가 올바르지 않습니다.');const sizeMm=tuple(m.sizeMm,0,1e7);if(Math.max(...sizeMm)<=0)throw new Error('공유 전시장 모델 크기가 올바르지 않습니다.');return {modelId,sizeMm,sourceOffsetM:tuple(m.sourceOffsetM,-1e7,1e7),positionMm:tuple(m.positionMm,-1e7,1e7),rotationDeg:num(m.rotationDeg,-180,180),scale:num(m.scale,.01,100)};})();
  if(!walls.length&&!referenceModel&&!modelArtworks?.length)throw new Error('공유할 공간 또는 3D 작품이 없습니다.');
  const entityIds=[...wallIds,...artworks.map(a=>a.id),...(modelArtworks??[]).map(a=>a.id)];if(new Set(entityIds).size!==entityIds.length)throw new Error('공유 객체 ID가 중복됐습니다.');
  const openings=list(raw.openings,100).map(value=>{const o=record(value);return {id:id(o.id),kind:oneOf(o.kind,['door','window','stair-access'] as const),start:point(o.start),end:point(o.end)};});
  const zones=list(raw.zones,50).map(value=>{const z=record(value);return {id:id(z.id),kind:oneOf(z.kind,['stairs'] as const),x:num(z.x),z:num(z.z),width:num(z.width,1),depth:num(z.depth,1)};});
  const dimensions=raw.dimensions===undefined?undefined:list(raw.dimensions,500).map(value=>{const d=record(value);const elevationWallId=d.elevationWallId===undefined?undefined:id(d.elevationWallId);if(elevationWallId&&!wallIds.has(elevationWallId))throw new Error('공유 치수선의 벽 연결이 올바르지 않습니다.');return {id:id(d.id),view:oneOf(d.view,['plan','elevation','3d'] as const),...(elevationWallId?{elevationWallId}:{}),start:world(d.start),end:world(d.end),distanceMm:num(d.distanceMm,0)};});
  const importedFloor=raw.importedFloor===undefined?undefined:list(raw.importedFloor,40).map(loop=>list(loop,1000).map(point));
  if(importedFloor)validateImportedFloor(importedFloor);
  const camera=raw.camera===undefined?undefined:(()=>{const c=record(raw.camera);const vec=(value:unknown):[number,number,number]=>{if(!Array.isArray(value)||value.length!==3)throw new Error('공유 카메라가 올바르지 않습니다.');return [num(value[0],-1e5,1e5),num(value[1],-1e5,1e5),num(value[2],-1e5,1e5)];};if(c.projection!==undefined&&!['orthographic','perspective'].includes(String(c.projection)))throw new Error('공유 투영 방식이 올바르지 않습니다.');return {position:vec(c.position),target:vec(c.target),zoom:num(c.zoom,0.001,10000),...(c.projection==='perspective'?{projection:'perspective' as const,fov:num(c.fov??50,20,100)}:{})};})();
  const lights=raw.lights===undefined?undefined:parseLights(list(raw.lights,20).map(value=>({...record(value),locked:false,note:'',noteDetails:undefined})),entityIds).filter(l=>l.visible).map(publicLight);
  const lighting=raw.lighting===undefined?undefined:parseLighting(raw.lighting);
  return {...(referenceModel?{referenceModel}:{}),...(modelArtworks?{modelArtworks}:{}),...(raw.outdoor===undefined?{}:{outdoor:parseOutdoor(raw.outdoor)}),...(lights?{lights}:{}),...(lighting?{lighting}:{}),schemaVersion:1,name:str(raw.name),venue:str(raw.venue),floorColor:color(raw.floorColor),...(raw.floorMaterial===undefined?{}:{floorMaterial:publicMaterial(raw.floorMaterial)}),walls,artworks,openings,zones,...(importedFloor?{importedFloor}:{}),...(dimensions?{dimensions}:{}),...(camera?{camera}:{})};
}

/** A single immutable publication may contain explicitly selected, non-nested Scenes. */
export function parsePublicShare(input:unknown):PublicShareSnapshot{
 const raw=record(input),snapshot:PublicShareSnapshot=parsePublicScene({...raw,scenes:undefined});
 if(raw.scenes!==undefined){
  const scenes=list(raw.scenes,PUBLIC_SCENES_MAX).map(value=>{const s=record(value);return {id:id(s.id),name:str(s.name),snapshot:parsePublicScene(s.snapshot)};});
  if(new Set(scenes.map(s=>s.id)).size!==scenes.length)throw new Error('공유 Scene ID가 중복됐습니다.');
  if(scenes.length)snapshot.scenes=scenes;
 }
 if(publicImageIds(snapshot).length>PUBLIC_IMAGES_MAX)throw new Error('공유 이미지 자산은 총 1,000개 이하여야 합니다.');
 if(publicModelIds(snapshot).length>51)throw new Error('공유 모델 자산은 총 51개 이하여야 합니다.');
 if(new TextEncoder().encode(JSON.stringify(snapshot)).byteLength>PUBLIC_SNAPSHOT_MAX_BYTES)throw new Error('공유 데이터가 1MB를 초과합니다. Scene을 줄여 주세요.');
 return snapshot;
}
