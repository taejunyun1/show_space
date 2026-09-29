import {installationZones} from './installationZones';
import {resolveMeasurement} from './measurements';
import {openingSegments} from './openings';
import {artPanel} from '../lib/art';
import type {Point,Project,WorldPoint,CameraView} from './types';

export interface PublicShareSnapshot {
  schemaVersion:1;
  name:string;
  venue:string;
  floorColor:string;
  walls:Array<{id:string;name:string;start:Point;end:Point;heightMm:number;thicknessMm:number;color:string;role?:'boundary'|'partition'}>;
  artworks:Array<{id:string;name:string;artist:string;wallId:string;wallSide:'front'|'back';widthMm:number;heightMm:number;depthMm:number;alongMm:number;centerHeightMm:number;rotationDeg?:number;frame:'black'|'natural'|'white'|'none';imageId:string;spritePanel?:number}>;
  openings:Array<{id:string;kind:'door'|'window'|'stair-access';start:Point;end:Point}>;
  zones:Array<{id:string;kind:'stairs';x:number;z:number;width:number;depth:number}>;
  dimensions?:Array<{id:string;view:'plan'|'elevation'|'3d';elevationWallId?:string;start:WorldPoint;end:WorldPoint;distanceMm:number}>;
  camera?:CameraView;
}

export interface PublicShareOptions {
  includeDimensions:boolean;
  camera?:PublicShareSnapshot['camera'];
}

export function createPublicShare(project:Project,options:PublicShareOptions){
  if(project.planDraft&&!project.planReference?.calibrated)throw new Error('축척 보정 후 3D 공간을 공유할 수 있습니다.');
  const visibleWalls=project.walls.filter(wall=>wall.visible);
  const wallIds=new Set(visibleWalls.map(wall=>wall.id));
  const artworks=project.artworks.filter(art=>art.visible&&wallIds.has(art.wallId)&&!!art.imageUrl);
  const snapshot:PublicShareSnapshot={
    schemaVersion:1,name:project.name,venue:project.venue,floorColor:project.floorColor,
    walls:visibleWalls.map(wall=>({id:wall.id,name:wall.name,start:{...wall.start},end:{...wall.end},heightMm:wall.heightMm,thicknessMm:wall.thicknessMm,color:wall.color,...(wall.role?{role:wall.role}:{})})),
    artworks:artworks.map((art,index)=>({id:art.id,name:art.name,artist:art.artist,wallId:art.wallId,wallSide:art.wallSide??'front',widthMm:art.widthMm,heightMm:art.heightMm,depthMm:art.depthMm,alongMm:art.alongMm,centerHeightMm:art.centerHeightMm,...(art.rotationDeg===undefined?{}:{rotationDeg:art.rotationDeg}),frame:art.frame,imageId:String(index),...(artPanel(art.imageUrl)!==null?{spritePanel:artPanel(art.imageUrl)!}:{})})),
    openings:openingSegments({walls:project.walls,openings:(project.openings??[]).filter(opening=>[opening.start,opening.end].every(anchor=>!anchor.wallId||wallIds.has(anchor.wallId)))}).map(opening=>({id:opening.id,kind:opening.kind,start:{...opening.start},end:{...opening.end}})),
    zones:installationZones(project).map(zone=>({...zone})),
    ...(options.includeDimensions?{dimensions:(project.dimensions??[]).filter(dim=>(!dim.elevationWallId||wallIds.has(dim.elevationWallId))&&[dim.start,dim.end].every(anchor=>anchor.kind!=='wall'||wallIds.has(anchor.wallId))).map(dim=>{const resolved=resolveMeasurement(project,dim);return {id:dim.id,view:dim.view,...(dim.elevationWallId?{elevationWallId:dim.elevationWallId}:{}),start:resolved.start,end:resolved.end,distanceMm:resolved.distanceMm};})}:{}),
    ...(options.camera?{camera:options.camera}:{})
  };
  return {snapshot:parsePublicShare(snapshot),uploads:artworks.map((art,index)=>({imageId:String(index),sourceUrl:art.imageUrl}))};
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

/** Rebuilds the public allowlist on the server as well as in the editor. */
export function parsePublicShare(input:unknown):PublicShareSnapshot{
  const raw=record(input);
  if(raw.schemaVersion!==1)throw new Error('지원하지 않는 공유 형식입니다.');
  const walls=list(raw.walls,200).map(value=>{const w=record(value);return {id:id(w.id),name:str(w.name),start:point(w.start),end:point(w.end),heightMm:num(w.heightMm,1),thicknessMm:num(w.thicknessMm,1),color:color(w.color),...(w.role===undefined?{}:{role:oneOf(w.role,['boundary','partition'] as const)})};});
  const wallIds=new Set(walls.map(w=>w.id));
  if(!walls.length||wallIds.size!==walls.length)throw new Error('공유 벽 목록이 올바르지 않습니다.');
  const artworks=list(raw.artworks,500).map(value=>{const a=record(value);const wallId=id(a.wallId);if(!wallIds.has(wallId))throw new Error('공유 작품의 벽 연결이 올바르지 않습니다.');const imageId=str(a.imageId,4);if(!/^(0|[1-9][0-9]{0,3})$/.test(imageId))throw new Error('공유 이미지 ID가 올바르지 않습니다.');const spritePanel=a.spritePanel===undefined?undefined:num(a.spritePanel,0,4);if(spritePanel!==undefined&&!Number.isInteger(spritePanel))throw new Error('공유 작품 이미지 위치가 올바르지 않습니다.');return {id:id(a.id),name:str(a.name),artist:str(a.artist),wallId,wallSide:oneOf(a.wallSide,['front','back'] as const),widthMm:num(a.widthMm,1),heightMm:num(a.heightMm,1),depthMm:num(a.depthMm,1),alongMm:num(a.alongMm),centerHeightMm:num(a.centerHeightMm),...(a.rotationDeg===undefined?{}:{rotationDeg:num(a.rotationDeg,-180,180)}),frame:oneOf(a.frame,['black','natural','white','none'] as const),imageId,...(spritePanel===undefined?{}:{spritePanel})};});
  if(new Set(artworks.map(a=>a.id)).size!==artworks.length||new Set(artworks.map(a=>a.imageId)).size!==artworks.length||artworks.some((a,i)=>a.imageId!==String(i)))throw new Error('공유 작품 목록이 올바르지 않습니다.');
  const openings=list(raw.openings,100).map(value=>{const o=record(value);return {id:id(o.id),kind:oneOf(o.kind,['door','window','stair-access'] as const),start:point(o.start),end:point(o.end)};});
  const zones=list(raw.zones,50).map(value=>{const z=record(value);return {id:id(z.id),kind:oneOf(z.kind,['stairs'] as const),x:num(z.x),z:num(z.z),width:num(z.width,1),depth:num(z.depth,1)};});
  const dimensions=raw.dimensions===undefined?undefined:list(raw.dimensions,500).map(value=>{const d=record(value);const elevationWallId=d.elevationWallId===undefined?undefined:id(d.elevationWallId);if(elevationWallId&&!wallIds.has(elevationWallId))throw new Error('공유 치수선의 벽 연결이 올바르지 않습니다.');return {id:id(d.id),view:oneOf(d.view,['plan','elevation','3d'] as const),...(elevationWallId?{elevationWallId}:{}),start:world(d.start),end:world(d.end),distanceMm:num(d.distanceMm,0)};});
  const camera=raw.camera===undefined?undefined:(()=>{const c=record(raw.camera);const vec=(value:unknown):[number,number,number]=>{if(!Array.isArray(value)||value.length!==3)throw new Error('공유 카메라가 올바르지 않습니다.');return [num(value[0],-1e5,1e5),num(value[1],-1e5,1e5),num(value[2],-1e5,1e5)];};if(c.projection!==undefined&&!['orthographic','perspective'].includes(String(c.projection)))throw new Error('공유 투영 방식이 올바르지 않습니다.');return {position:vec(c.position),target:vec(c.target),zoom:num(c.zoom,0.001,10000),...(c.projection==='perspective'?{projection:'perspective' as const,fov:num(c.fov??50,20,100)}:{})};})();
  return {schemaVersion:1,name:str(raw.name),venue:str(raw.venue),floorColor:color(raw.floorColor),walls,artworks,openings,zones,...(dimensions?{dimensions}:{}),...(camera?{camera}:{})};
}
