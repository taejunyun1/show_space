import {Component,Suspense,useCallback,useEffect,useMemo,useRef} from 'react';
import type {ReactNode} from 'react';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import type {ThreeEvent} from '@react-three/fiber';
import {OrbitControls,Html,Line,useTexture} from '@react-three/drei';
import {Path,Shape,SRGBColorSpace} from 'three';
import type {Group} from 'three';
import {deriveFloor} from '../domain/floor';
import type {PublicShareSnapshot} from '../domain/publicShare';
import type {Wall,WorldPoint} from '../domain/types';
import {applyWallVisibility} from './wallVisibility3d';
import {measurementDistance} from './sharedMeasure';
import {fitSharedCameraZoom} from './sharedCamera';

type Selection={kind:'wall'|'artwork';id:string};
type Art=PublicShareSnapshot['artworks'][number];
type PublicWall=PublicShareSnapshot['walls'][number];
const frameColors={black:'#282827',natural:'#b9a383',white:'#f5f4ef',none:'#eee8dc'};

type MeasurePick=(event:ThreeEvent<PointerEvent>)=>void;

function Floor({snapshot,measuring,onMeasure}:{snapshot:PublicShareSnapshot;measuring:boolean;onMeasure:MeasurePick}){
  const shapes=useMemo(()=>{
    const walls:Wall[]=snapshot.walls.map(wall=>({...wall,visible:true,locked:true,note:''}));
    const virtual:Wall[]=snapshot.openings.map(opening=>({id:`opening-${opening.id}`,name:'',start:opening.start,end:opening.end,heightMm:1,thicknessMm:1,color:'#000000',role:'boundary',visible:false,locked:true,note:''}));
    return deriveFloor([...walls,...virtual]).surfaces.map(surface=>{
      const shape=new Shape();
      surface.outer.forEach((point,i)=>i===0?shape.moveTo(point.x/1000,-point.z/1000):shape.lineTo(point.x/1000,-point.z/1000));
      shape.closePath();
      for(const hole of surface.holes){const path=new Path();[...hole].reverse().forEach((point,i)=>i===0?path.moveTo(point.x/1000,-point.z/1000):path.lineTo(point.x/1000,-point.z/1000));path.closePath();shape.holes.push(path);}
      return shape;
    });
  },[snapshot]);
  return <>{shapes.map((shape,index)=><mesh key={index} rotation={[-Math.PI/2,0,0]} position={[0,-.015,0]} onPointerDown={measuring?onMeasure:undefined}><shapeGeometry args={[shape]}/><meshStandardMaterial color={snapshot.floorColor} side={2} roughness={.96}/></mesh>)}</>;
}

function ArtworkImage({url,art,width,height,depth}:{url:string;art:Art;width:number;height:number;depth:number}){
  const source=useTexture(url);
  const texture=useMemo(()=>{
    const copy=source.clone();
    copy.colorSpace=SRGBColorSpace;
    if(art.spritePanel!==undefined){copy.repeat.set(.2,1);copy.offset.set(art.spritePanel*.2,0);}
    copy.needsUpdate=true;
    return copy;
  },[source,art.spritePanel]);
  useEffect(()=>()=>texture.dispose(),[texture]);
  return <mesh position={[0,0,depth/2+.002]}><planeGeometry args={[width,height]}/><meshStandardMaterial color="#ffffff" map={texture} roughness={.9}/></mesh>;
}

function ArtworkPlaceholder({width,height,depth,failed=false}:{width:number;height:number;depth:number;failed?:boolean}){
  return <><mesh position={[0,0,depth/2+.002]}><planeGeometry args={[width,height]}/><meshStandardMaterial color="#ddd6cb" roughness={.9}/></mesh>{failed&&<Html center position={[0,0,depth/2+.015]} style={{pointerEvents:'none',whiteSpace:'nowrap'}}><span className="shared-image-error">이미지를 불러올 수 없습니다</span></Html>}</>;
}

class ArtworkLoadBoundary extends Component<{children:ReactNode;width:number;height:number;depth:number},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<ArtworkPlaceholder width={this.props.width} height={this.props.height} depth={this.props.depth} failed/>:this.props.children;}
}

function PublicArtwork({art,wall,shareId,selected,onSelect,measuring,onMeasure}:{art:Art;wall:PublicWall;shareId:string;selected:boolean;onSelect:(selection:Selection)=>void;measuring:boolean;onMeasure:MeasurePick}){
  const dx=wall.end.x-wall.start.x,dz=wall.end.z-wall.start.z,length=Math.hypot(dx,dz)||1;
  const side=art.wallSide==='back'?-1:1,nx=-dz/length*side,nz=dx/length*side;
  const offset=wall.thicknessMm/2+art.depthMm/2+5;
  const x=(wall.start.x+dx/length*art.alongMm+nx*offset)/1000,z=(wall.start.z+dz/length*art.alongMm+nz*offset)/1000;
  const width=art.widthMm/1000,height=art.heightMm/1000,depth=art.depthMm/1000;
  return <group position={[x,art.centerHeightMm/1000,z]} rotation={[0,Math.atan2(nx,nz),0]} onPointerDown={measuring?onMeasure:undefined} onClick={event=>{event.stopPropagation();if(!measuring)onSelect({kind:'artwork',id:art.id});}}>
    <mesh><boxGeometry args={[width+(art.frame==='none'?0:.045),height+(art.frame==='none'?0:.045),depth]}/><meshStandardMaterial color={selected?'#365cf5':frameColors[art.frame]} roughness={.8}/></mesh>
    <ArtworkLoadBoundary key={`${shareId}:${art.imageId}`} width={width} height={height} depth={depth}><Suspense fallback={<ArtworkPlaceholder width={width} height={height} depth={depth}/>}><ArtworkImage url={`/api/public/${shareId}/images/${art.imageId}`} art={art} width={width} height={height} depth={depth}/></Suspense></ArtworkLoadBoundary>
  </group>;
}

function PublicWallMesh({wall,artworks,shareId,selectedId,onSelect,groups,measuring,onMeasure}:{wall:PublicWall;artworks:Art[];shareId:string;selectedId:string|null;onSelect:(selection:Selection)=>void;groups:Map<string,Group>;measuring:boolean;onMeasure:MeasurePick}){
  const register=useCallback((group:Group|null)=>{if(group)groups.set(wall.id,group);else groups.delete(wall.id);},[groups,wall.id]);
  const dx=wall.end.x-wall.start.x,dz=wall.end.z-wall.start.z,length=Math.hypot(dx,dz);
  if(!length)return null;
  return <group ref={register}><mesh position={[(wall.start.x+wall.end.x)/2000,wall.heightMm/2000,(wall.start.z+wall.end.z)/2000]} rotation={[0,-Math.atan2(dz,dx),0]} onPointerDown={measuring?onMeasure:undefined} onClick={event=>{event.stopPropagation();if(!measuring)onSelect({kind:'wall',id:wall.id});}}><boxGeometry args={[length/1000,wall.heightMm/1000,wall.thicknessMm/1000]}/><meshStandardMaterial color={selectedId===wall.id?'#cfdbff':wall.color} roughness={.92}/></mesh>{artworks.map(art=><PublicArtwork key={art.id} art={art} wall={wall} shareId={shareId} selected={selectedId===art.id} onSelect={onSelect} measuring={measuring} onMeasure={onMeasure}/>)}</group>;
}

function CutawayVisibility({walls,groups,cutaway}:{walls:readonly Wall[];groups:ReadonlyMap<string,Group>;cutaway:boolean}){
  const {camera,invalidate}=useThree();
  useEffect(()=>{applyWallVisibility(walls,groups,camera.position,cutaway);invalidate();},[walls,groups,cutaway,camera,invalidate]);
  useFrame(({camera})=>applyWallVisibility(walls,groups,camera.position,cutaway));
  return null;
}

function CameraSetup({frame,reset,walls}:{frame:{position:[number,number,number];target:[number,number,number];zoom:number};reset:number;walls:PublicShareSnapshot['walls']}){
  const {camera,invalidate,size}=useThree();
  useEffect(()=>{
    camera.position.set(...frame.position);
    camera.lookAt(...frame.target);
    if('zoom' in camera)camera.zoom=fitSharedCameraZoom(frame.zoom,size,walls);
    camera.updateProjectionMatrix();invalidate();
  },[camera,frame,reset,invalidate,size.width,size.height,walls]);
  return null;
}

export default function SharedViewer3D({snapshot,shareId,selectedId,onSelect,reset,cutaway,measuring,measurePoints,onMeasurePoint}:{snapshot:PublicShareSnapshot;shareId:string;selectedId:string|null;onSelect:(selection:Selection|null)=>void;reset:number;cutaway:boolean;measuring:boolean;measurePoints:WorldPoint[];onMeasurePoint:(point:WorldPoint)=>void}){
  const wallGroups=useRef(new Map<string,Group>());
  const cutawayWalls=useMemo<Wall[]>(()=>snapshot.walls.map(wall=>({...wall,visible:true,locked:true,note:''})),[snapshot.walls]);
  const frame=useMemo(()=>{
    if(snapshot.camera)return snapshot.camera;
    const points=snapshot.walls.flatMap(wall=>[wall.start,wall.end]);
    const minX=Math.min(...points.map(point=>point.x))/1000,maxX=Math.max(...points.map(point=>point.x))/1000;
    const minZ=Math.min(...points.map(point=>point.z))/1000,maxZ=Math.max(...points.map(point=>point.z))/1000;
    const span=Math.max(maxX-minX,maxZ-minZ,4),height=Math.max(...snapshot.walls.map(wall=>wall.heightMm))/1000;
    const centerX=(minX+maxX)/2,centerZ=(minZ+maxZ)/2;
    return {position:[centerX-span,height+span,centerZ+span] as [number,number,number],target:[centerX,height/3,centerZ] as [number,number,number],zoom:Math.max(8,Math.min(90,650/(span+height+2)))};
  },[snapshot]);
  const mm=snapshot.dimensions;
  const active=measuring&&!!mm;
  const pick:MeasurePick=event=>{
    if(!active||event.button!==0)return;
    event.stopPropagation();
    onMeasurePoint({x:event.point.x*1000,y:event.point.y*1000,z:event.point.z*1000});
  };
  const point3d=(point:WorldPoint):[number,number,number]=>[point.x/1000,point.y/1000,point.z/1000];
  return <div className="shared-3d"><Canvas orthographic frameloop="demand" dpr={[1,1.5]} camera={{position:frame.position,zoom:frame.zoom,near:.01,far:2000}} gl={{antialias:true}} onPointerMissed={()=>{if(!active)onSelect(null);}}>
    <color attach="background" args={['#e9edf1']}/><ambientLight intensity={1.3}/><directionalLight position={[8,15,10]} intensity={1.8}/>
    <CameraSetup frame={frame} reset={reset} walls={snapshot.walls}/><Floor snapshot={snapshot} measuring={active} onMeasure={pick}/>
    {snapshot.walls.map(wall=><PublicWallMesh key={wall.id} wall={wall} artworks={snapshot.artworks.filter(art=>art.wallId===wall.id)} shareId={shareId} selectedId={selectedId} onSelect={onSelect} groups={wallGroups.current} measuring={active} onMeasure={pick}/>)}
    <CutawayVisibility walls={cutawayWalls} groups={wallGroups.current} cutaway={cutaway}/>
    {snapshot.openings.map(opening=><group key={opening.id}><Line points={[[opening.start.x/1000,.025,opening.start.z/1000],[opening.end.x/1000,.025,opening.end.z/1000]]} color={opening.kind==='window'?'#2785b8':'#16816b'} dashed dashSize={.1} gapSize={.08}/><Html center position={[(opening.start.x+opening.end.x)/2000,.12,(opening.start.z+opening.end.z)/2000]} style={{pointerEvents:'none',whiteSpace:'nowrap'}}><span className="shared-3d-dimension">{opening.kind==='door'?'출입구':opening.kind==='stair-access'?'계단 통로':'창문'}</span></Html></group>)}
    {snapshot.zones.map(zone=><mesh key={zone.id} rotation={[-Math.PI/2,0,0]} position={[(zone.x+zone.width/2)/1000,.012,(zone.z+zone.depth/2)/1000]}><planeGeometry args={[zone.width/1000,zone.depth/1000]}/><meshBasicMaterial color="#e44b4b" transparent opacity={.27} depthWrite={false}/></mesh>)}
    {mm?.filter(dim=>dim.view==='3d').map(dim=><group key={dim.id}><mesh position={[(dim.start.x+dim.end.x)/2000,(dim.start.y+dim.end.y)/2000,(dim.start.z+dim.end.z)/2000]}><sphereGeometry args={[.015,8,8]}/><meshBasicMaterial color="#365cf5"/></mesh><Html center style={{pointerEvents:'none'}}><span className="shared-3d-dimension">{Math.round(dim.distanceMm).toLocaleString()} mm</span></Html></group>)}
    {active&&measurePoints.map((point,index)=><mesh key={index} position={point3d(point)} renderOrder={10}><sphereGeometry args={[.045,12,12]}/><meshBasicMaterial color="#16816b" depthTest={false}/></mesh>)}
    {active&&measurePoints.length===2&&<><Line points={[point3d(measurePoints[0]),point3d(measurePoints[1])]} color="#16816b" lineWidth={2} depthTest={false} renderOrder={10}/><Html center position={[(measurePoints[0].x+measurePoints[1].x)/2000,(measurePoints[0].y+measurePoints[1].y)/2000+.1,(measurePoints[0].z+measurePoints[1].z)/2000]} style={{pointerEvents:'none'}}><span className="shared-3d-dimension">임시 측정 {Math.round(measurementDistance(measurePoints[0],measurePoints[1])).toLocaleString()} mm</span></Html></>}
    <OrbitControls key={reset} makeDefault target={frame.target} enabled={!active} enableDamping={false} minZoom={.03} maxZoom={300} maxPolarAngle={Math.PI/2.02}/>
  </Canvas></div>;
}
