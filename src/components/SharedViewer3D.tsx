import {useReadonlyAssets,readonlyImageUrl,type ReadonlyAssets} from './ReadonlyAssets';
import {formatLength} from '../domain/lengthUnits';
import {ArtworkTextureQuality,useArtworkTextureSize} from './ArtworkTextureQuality';
import {useArtworkTexture} from './useArtworkTexture';
import {artworkPresentation} from '../domain/artworkPresentation';
import {ArtworkPresentationShell} from './ArtworkPresentationShell';
import {PublicReferenceModel3D} from './PublicReferenceModel3D';
import {PublicModelArtworks3D} from './PublicModelArtworks3D';
import {projectSpatialBounds} from '../domain/referenceModel';
import {outdoorAppearance} from '../domain/outdoor';
import {Lighting3D} from './Lighting3D';
import {WallSurfaceGeometry,FloorSurfaceGeometry} from './SurfaceGeometry';
import {SurfaceFinish} from './SurfaceFinish';
import {SurfaceEnvironment} from './SurfaceEnvironment';
import {needsSurfaceEnvironment} from '../lib/surfaceEnvironment';
import {Component,Suspense,useCallback,useEffect,useMemo,useRef} from 'react';
import type {ReactNode} from 'react';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import type {ThreeEvent} from '@react-three/fiber';
import {OrbitControls,Html,Line} from '@react-three/drei';
import {Path,Shape} from 'three';
import type {Group} from 'three';
import {floorFromLoops} from '../domain/importedFloor';
import {deriveFloor} from '../domain/floor';
import type {PublicShareSnapshot,PublicSurfaceMaterial} from '../domain/publicShare';
import type {Wall,WorldPoint} from '../domain/types';
import {applyWallVisibility} from './wallVisibility3d';
import {measurementDistance} from './sharedMeasure';
import {fitSharedCameraZoom} from './sharedCamera';

type Selection={kind:'wall'|'artwork'|'modelArtwork'|'referenceModel';id:string};
type Art=PublicShareSnapshot['artworks'][number];
type PublicWall=PublicShareSnapshot['walls'][number];

function finish(m:PublicSurfaceMaterial|undefined,shareId:string,assets:ReadonlyAssets|null){if(!m)return;const {texture:_,normal,...scalar}=m;const url=normal?readonlyImageUrl(shareId,normal.imageId,assets):undefined;return {...scalar,...(normal&&url?{normal:{imageUrl:url,widthMm:normal.widthMm,heightMm:normal.heightMm,strength:normal.strength}}:{})};}
function publicTexture(m:PublicSurfaceMaterial|undefined,shareId:string,assets:ReadonlyAssets|null){const url=m?.texture?readonlyImageUrl(shareId,m.texture.imageId,assets):undefined;return m?.texture&&url?{imageUrl:url,widthMm:m.texture.widthMm,heightMm:m.texture.heightMm}:undefined;}

type MeasurePick=(event:ThreeEvent<PointerEvent>)=>void;

function Floor({snapshot,shareId,measuring,onMeasure}:{snapshot:PublicShareSnapshot;shareId:string;measuring:boolean;onMeasure:MeasurePick}){
  const assets=useReadonlyAssets();
  const shapes=useMemo(()=>{
    const walls:Wall[]=snapshot.walls.map(wall=>({...wall,material:undefined,visible:true,locked:true,note:''}));
    const virtual:Wall[]=snapshot.openings.map(opening=>({id:`opening-${opening.id}`,name:'',start:opening.start,end:opening.end,heightMm:1,thicknessMm:1,color:'#000000',role:'boundary',visible:false,locked:true,note:''}));
    return (snapshot.importedFloor?floorFromLoops(snapshot.importedFloor):deriveFloor([...walls,...virtual])).surfaces.map(surface=>{
      const shape=new Shape();
      surface.outer.forEach((point,i)=>i===0?shape.moveTo(point.x/1000,-point.z/1000):shape.lineTo(point.x/1000,-point.z/1000));
      shape.closePath();
      for(const hole of surface.holes){const path=new Path();[...hole].reverse().forEach((point,i)=>i===0?path.moveTo(point.x/1000,-point.z/1000):path.lineTo(point.x/1000,-point.z/1000));path.closePath();shape.holes.push(path);}
      return shape;
    });
  },[snapshot]);
  return <>{shapes.map((shape,index)=><mesh receiveShadow key={index} rotation={[-Math.PI/2,0,0]} position={[0,-.015,0]} onPointerDown={measuring?onMeasure:undefined}><FloorSurfaceGeometry shape={shape} flat/><SurfaceFinish color={snapshot.floorColor} material={finish(snapshot.floorMaterial,shareId,assets)} texture={publicTexture(snapshot.floorMaterial,shareId,assets)} side={2} roughness={.96}/></mesh>)}</>;
}

function ArtworkImage({url,art,width,height,selected,shareId}:{url:string;art:Art;width:number;height:number;selected:boolean;shareId:string}){
  const assets=useReadonlyAssets();
  const textureSize=useArtworkTextureSize(art.id);
  const {texture,failed,ready,appliedSize}=useArtworkTexture(url,art.spritePanel??null,textureSize);
  if(failed)throw new Error('공유 작품 이미지 로딩 실패');
  return <mesh userData={{artworkTextureReady:ready,artworkTextureSize:textureSize,artworkTextureAppliedSize:appliedSize,artworkTextureRequest:{id:art.id,key:JSON.stringify([url,art.spritePanel??null]),width,height,selected}}} position={[0,0,artworkPresentation(art).imageZMm/1000]}><planeGeometry args={[width,height]}/><SurfaceFinish color="#ffffff" material={finish(art.material,shareId,assets)} normalExtentM={[width,height]} map={texture} roughness={.9}/></mesh>;
}

function ArtworkPlaceholder({width,height,imageZ,failed=false}:{width:number;height:number;imageZ:number;failed?:boolean}){
  return <><mesh position={[0,0,imageZ]}><planeGeometry args={[width,height]}/><meshStandardMaterial color="#ddd6cb" roughness={.9}/></mesh>{failed&&<Html center position={[0,0,imageZ+.015]} style={{pointerEvents:'none',whiteSpace:'nowrap'}}><span className="shared-image-error">이미지를 불러올 수 없습니다</span></Html>}</>;
}

class ArtworkLoadBoundary extends Component<{children:ReactNode;width:number;height:number;imageZ:number},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<ArtworkPlaceholder width={this.props.width} height={this.props.height} imageZ={this.props.imageZ} failed/>:this.props.children;}
}

function PublicArtwork({art,wall,shareId,selected,onSelect,measuring,onMeasure}:{art:Art;wall:PublicWall;shareId:string;selected:boolean;onSelect:(selection:Selection)=>void;measuring:boolean;onMeasure:MeasurePick}){
  const assets=useReadonlyAssets(),url=readonlyImageUrl(shareId,art.imageId,assets);
  const dx=wall.end.x-wall.start.x,dz=wall.end.z-wall.start.z,length=Math.hypot(dx,dz)||1;
  const side=art.wallSide==='back'?-1:1,nx=-dz/length*side,nz=dx/length*side;
  const offset=wall.thicknessMm/2+artworkPresentation(art).depthMm/2+5;
  const x=(wall.start.x+dx/length*art.alongMm+nx*offset)/1000,z=(wall.start.z+dz/length*art.alongMm+nz*offset)/1000;
  const width=art.widthMm/1000,height=art.heightMm/1000,imageZ=artworkPresentation(art).imageZMm/1000;
  return <group position={[x,art.centerHeightMm/1000,z]} rotation={[0,Math.atan2(nx,nz),(art.rotationDeg??0)*Math.PI/180]} onPointerDown={measuring?onMeasure:undefined} onClick={event=>{event.stopPropagation();if(!measuring)onSelect({kind:'artwork',id:art.id});}}>
    <ArtworkPresentationShell artwork={art}/>
    {selected&&<Line points={(()=>{const p=artworkPresentation(art),w=p.widthMm/2000+.02,h=p.heightMm/2000+.02,z=p.depthMm/2000+.005;return [[-w,-h,z],[w,-h,z],[w,h,z],[-w,h,z],[-w,-h,z]];})()} color="#365cf5" lineWidth={2}/>}
    {url?<ArtworkLoadBoundary key={url} width={width} height={height} imageZ={imageZ}><Suspense fallback={<ArtworkPlaceholder width={width} height={height} imageZ={imageZ}/>}><ArtworkImage selected={selected} shareId={shareId} url={url} art={art} width={width} height={height}/></Suspense></ArtworkLoadBoundary>:<ArtworkPlaceholder width={width} height={height} imageZ={imageZ} failed/>}
  </group>;
}

function PublicWallMesh({wall,artworks,shareId,selectedId,onSelect,groups,measuring,onMeasure}:{wall:PublicWall;artworks:Art[];shareId:string;selectedId:string|null;onSelect:(selection:Selection)=>void;groups:Map<string,Group>;measuring:boolean;onMeasure:MeasurePick}){
  const assets=useReadonlyAssets();
  const register=useCallback((group:Group|null)=>{if(group)groups.set(wall.id,group);else groups.delete(wall.id);},[groups,wall.id]);
  const dx=wall.end.x-wall.start.x,dz=wall.end.z-wall.start.z,length=Math.hypot(dx,dz);
  if(!length)return null;
  return <group ref={register}><mesh castShadow receiveShadow position={[(wall.start.x+wall.end.x)/2000,wall.heightMm/2000,(wall.start.z+wall.end.z)/2000]} rotation={[0,-Math.atan2(dz,dx),0]} onPointerDown={measuring?onMeasure:undefined} onClick={event=>{event.stopPropagation();if(!measuring)onSelect({kind:'wall',id:wall.id});}}><WallSurfaceGeometry length={length/1000} height={wall.heightMm/1000} depth={wall.thicknessMm/1000}/><SurfaceFinish color={selectedId===wall.id?'#cfdbff':wall.color} material={finish(wall.material,shareId,assets)} texture={publicTexture(wall.material,shareId,assets)} roughness={.92}/></mesh>{artworks.map(art=><PublicArtwork key={art.id} art={art} wall={wall} shareId={shareId} selected={selectedId===art.id} onSelect={onSelect} measuring={measuring} onMeasure={onMeasure}/>)}</group>;
}

function CutawayVisibility({walls,groups,cutaway}:{walls:readonly Wall[];groups:ReadonlyMap<string,Group>;cutaway:boolean}){
  const {camera,invalidate}=useThree();
  useEffect(()=>{applyWallVisibility(walls,groups,camera.position,cutaway);invalidate();},[walls,groups,cutaway,camera,invalidate]);
  useFrame(({camera})=>applyWallVisibility(walls,groups,camera.position,cutaway));
  return null;
}

function CameraSetup({frame,reset,snapshot}:{frame:NonNullable<PublicShareSnapshot['camera']>;reset:number;snapshot:PublicShareSnapshot}){
  const {camera,invalidate,size}=useThree();
  useEffect(()=>{
    camera.position.set(...frame.position);
    camera.lookAt(...frame.target);
    if('zoom' in camera)camera.zoom=frame.projection==='perspective'?frame.zoom:fitSharedCameraZoom(frame.zoom,size,snapshot.walls,snapshot.modelArtworks,snapshot.referenceModel);
    if('fov' in camera)camera.fov=frame.fov??50;
    camera.updateProjectionMatrix();invalidate();
  },[camera,frame,reset,invalidate,size.width,size.height,snapshot]);
  return null;
}

export default function SharedViewer3D({snapshot,shareId,selectedId,referenceSelected=false,onSelect,reset,cutaway,measuring,measurePoints,onMeasurePoint}:{snapshot:PublicShareSnapshot;shareId:string;selectedId:string|null;referenceSelected?:boolean;onSelect:(selection:Selection|null)=>void;reset:number;cutaway:boolean;measuring:boolean;measurePoints:WorldPoint[];onMeasurePoint:(point:WorldPoint)=>void}){
  const wallGroups=useRef(new Map<string,Group>());
  const cutawayWalls=useMemo<Wall[]>(()=>snapshot.walls.map(wall=>({...wall,material:undefined,visible:true,locked:true,note:''})),[snapshot.walls]);
  const frame=useMemo<NonNullable<PublicShareSnapshot['camera']>>(()=>{
    if(snapshot.camera)return snapshot.camera;
    const bounds=projectSpatialBounds(snapshot),minX=bounds.minX/1000,maxX=bounds.maxX/1000,minZ=bounds.minZ/1000,maxZ=bounds.maxZ/1000;
    const span=Math.max(maxX-minX,maxZ-minZ,4),height=Math.max(0,bounds.maxY)/1000;
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
  return <div className="shared-3d"><Canvas shadows orthographic={frame.projection!=='perspective'} frameloop="demand" dpr={[1,1.5]} camera={{position:frame.position,zoom:frame.zoom,fov:frame.fov??50,near:.01,far:2000}} gl={{antialias:true}} onPointerMissed={()=>{if(!active)onSelect(null);}}>
    <SurfaceEnvironment enabled={needsSurfaceEnvironment(snapshot)} outdoor={snapshot.outdoor} intensity={outdoorAppearance(snapshot.outdoor)?.environment??snapshot.lighting?.environment}/><ArtworkTextureQuality><color attach="background" args={[outdoorAppearance(snapshot.outdoor)?.background??'#e9edf1']}/><Lighting3D source={snapshot.lighting?snapshot:{...snapshot,lighting:{ambient:1.3,hemisphere:0,fill:1.8,environment:.35}}}/>
    <CameraSetup frame={frame} reset={reset} snapshot={snapshot}/><Floor snapshot={snapshot} shareId={shareId} measuring={active} onMeasure={pick}/>
    {snapshot.walls.map(wall=><PublicWallMesh key={wall.id} wall={wall} artworks={snapshot.artworks.filter(art=>art.wallId===wall.id)} shareId={shareId} selectedId={selectedId} onSelect={onSelect} groups={wallGroups.current} measuring={active} onMeasure={pick}/>)}
    <CutawayVisibility walls={cutawayWalls} groups={wallGroups.current} cutaway={frame.projection!=='perspective'&&cutaway}/>
    {snapshot.openings.map(opening=><group key={opening.id}><Line points={[[opening.start.x/1000,.025,opening.start.z/1000],[opening.end.x/1000,.025,opening.end.z/1000]]} color={opening.kind==='window'?'#2785b8':'#16816b'} dashed dashSize={.1} gapSize={.08}/><Html center position={[(opening.start.x+opening.end.x)/2000,.12,(opening.start.z+opening.end.z)/2000]} style={{pointerEvents:'none',whiteSpace:'nowrap'}}><span className="shared-3d-dimension">{opening.kind==='door'?'출입구':opening.kind==='stair-access'?'계단 통로':'창문'}</span></Html></group>)}
    {snapshot.referenceModel&&<PublicReferenceModel3D model={snapshot.referenceModel} shareId={shareId} selected={referenceSelected} onSelect={()=>onSelect({kind:'referenceModel',id:'referenceModel'})} measuring={active} onMeasure={pick}/>}
    <PublicModelArtworks3D artworks={snapshot.modelArtworks??[]} shareId={shareId} selectedId={selectedId} onSelect={id=>onSelect({kind:'modelArtwork',id})} measuring={active} onMeasure={pick}/>
    {snapshot.zones.map(zone=><mesh key={zone.id} rotation={[-Math.PI/2,0,0]} position={[(zone.x+zone.width/2)/1000,.012,(zone.z+zone.depth/2)/1000]}><planeGeometry args={[zone.width/1000,zone.depth/1000]}/><meshBasicMaterial color="#e44b4b" transparent opacity={.27} depthWrite={false}/></mesh>)}
    {mm?.filter(dim=>dim.view==='3d').map(dim=><group key={dim.id}><mesh position={[(dim.start.x+dim.end.x)/2000,(dim.start.y+dim.end.y)/2000,(dim.start.z+dim.end.z)/2000]}><sphereGeometry args={[.015,8,8]}/><meshBasicMaterial color="#365cf5"/></mesh><Html center style={{pointerEvents:'none'}}><span className="shared-3d-dimension">{formatLength(dim.distanceMm,snapshot.displayUnit)}</span></Html></group>)}
    {active&&measurePoints.map((point,index)=><mesh key={index} position={point3d(point)} renderOrder={10}><sphereGeometry args={[.045,12,12]}/><meshBasicMaterial color="#16816b" depthTest={false}/></mesh>)}
    {active&&measurePoints.length===2&&<><Line points={[point3d(measurePoints[0]),point3d(measurePoints[1])]} color="#16816b" lineWidth={2} depthTest={false} renderOrder={10}/><Html center position={[(measurePoints[0].x+measurePoints[1].x)/2000,(measurePoints[0].y+measurePoints[1].y)/2000+.1,(measurePoints[0].z+measurePoints[1].z)/2000]} style={{pointerEvents:'none'}}><span className="shared-3d-dimension">임시 측정 {formatLength(measurementDistance(measurePoints[0],measurePoints[1]),snapshot.displayUnit)}</span></Html></>}
    <OrbitControls key={reset} makeDefault target={frame.target} enabled={!active} enableDamping={false} minZoom={.03} maxZoom={300} maxPolarAngle={frame.projection==='perspective'?Math.PI-.05:Math.PI/2.02} minDistance={.1}/>
  </ArtworkTextureQuality></Canvas></div>;
}
