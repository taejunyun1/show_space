import {SurfaceEnvironment} from './SurfaceEnvironment';
import {needsSurfaceEnvironment} from '../lib/surfaceEnvironment';
import {SurfaceFinish} from './SurfaceFinish';
import {ReferenceModel3D} from './ReferenceModel3D';
import {projectSpatialBounds} from '../domain/referenceModel';
import {installationZones} from '../domain/installationZones';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, events, flushSync, useFrame, useThree } from '@react-three/fiber';
import type {ThreeEvent} from '@react-three/fiber';
import { OrbitControls, Html, Line, useTexture } from '@react-three/drei';
import { Path, Shape, SRGBColorSpace, Plane, Vector2, Vector3, MOUSE } from 'three';
import type {Group, Object3D} from 'three';
import type { Artwork, CameraView, Project, Wall } from '../domain/types';
import { artworkPosition, artworkWarnings, canRestoreDemoBoundary, wallLength } from '../domain/model';
import {floorWithOpenings,openingSegments} from '../domain/openings';
import { useEditor } from '../state/editor';
import {snapMeasurementCorner} from './measurementSnap3d';
import {fixedAnchor,resolveMeasurement,wallAnchor} from '../domain/measurements';
import {capturePixelSize,type CaptureOptions} from '../lib/captureSvg';
import { artPanel } from '../lib/art';
import { applyWallVisibility, isObjectVisible } from './wallVisibility3d';
import { createCameraViewGetter, createEyeLevelView } from './cameraView3d';
import {projectArtworkRay,projectArtworkWallRay} from '../domain/artworkDrag3d';
import {artworkRotationPoint,draggedArtworkAngle} from '../domain/artworkRotation';
import type { CameraView3D } from './cameraView3d';
export type { CameraView3D } from './cameraView3d';
const frameColors = { black: '#282827', natural: '#b9a383', white: '#f5f4ef', none: '#eee8dc' };
function modelPoint(point:Vector3){return {x:Math.round(point.x*1000),y:Math.round(point.y*1000),z:Math.round(point.z*1000)};}
function useMeasurementSnap(){
 const {camera,size}=useThree();
 const [hint,setHint]=useState<Vector3|null>(null);
 const active=useEditor(s=>s.activeTool==='measure'&&!s.captureClean);
 const snap=(event:ThreeEvent<PointerEvent|MouseEvent>)=>event.altKey?null:snapMeasurementCorner(event.object,event.point,event.face?.normal,camera,size);
 return {point:(event:ThreeEvent<PointerEvent|MouseEvent>)=>snap(event)??event.point,
 hover:(event:ThreeEvent<PointerEvent>)=>{if(active){event.stopPropagation();setHint(snap(event));}},
 clear:()=>setHint(null),
 marker:active&&hint?<Html position={hint.toArray()} center style={{pointerEvents:'none',whiteSpace:'nowrap'}}><span className="dimension-label" style={{color:'#16816b'}}>⊙ 모서리</span></Html>:null};
}
function Painting({ artwork, wall, groups }: { artwork: Artwork; wall: Wall; groups:Map<string,Group> }) {
  const project=useEditor(s=>s.project);
  const measurementSnap=useMeasurementSnap();
  const activeTool=useEditor(s=>s.activeTool);
  const installationConflict=artworkWarnings(artwork,wall,project).some(w=>w.includes('계단'));
  const source = useTexture(artwork.imageUrl);
  const texture = useMemo(() => {
    const t = source.clone(); t.colorSpace = SRGBColorSpace;
    const panel = artPanel(artwork.imageUrl);
    if (panel !== null) { t.repeat.set(0.2, 1); t.offset.set(panel * 0.2, 0); }
    t.needsUpdate = true; return t;
  }, [source, artwork.imageUrl]);
  useEffect(() => () => texture.dispose(), [texture]);
  const selected = useEditor(s => s.selected.some(x => x.id === artwork.id));
  const singleSelection=useEditor(s=>s.selected.length===1);
  const dragging=useEditor(s=>s.artworkGesture?.id===artwork.id);
  const captureClean=useEditor(s=>s.captureClean);
  const rotationGesture=useRef<{start:{x:number;y:number};initial:number;angle:number}|null>(null);
  const [previewAngle,setPreviewAngle]=useState<number|null>(null);
  useEffect(()=>{
    const cancel=(event:KeyboardEvent)=>{if(event.key==='Escape'){rotationGesture.current=null;setPreviewAngle(null);if(useEditor.getState().rotatingArtworkId===artwork.id)useEditor.getState().setArtworkRotationActive(null);}};
    window.addEventListener('keydown',cancel);
    return ()=>window.removeEventListener('keydown',cancel);
  },[artwork.id]);
  useEffect(()=>{
    if(!selected||artwork.locked||activeTool!=='select'){
      rotationGesture.current=null;
      setPreviewAngle(null);
      if(useEditor.getState().rotatingArtworkId===artwork.id)useEditor.getState().setArtworkRotationActive(null);
    }
  },[selected,artwork.locked,activeTool]);
  const { x, y, z, rotationY } = artworkPosition(artwork, wall);
  const w = artwork.widthMm / 1000, h = artwork.heightMm / 1000, d = artwork.depthMm / 1000;
  function facePoint(event:ThreeEvent<PointerEvent>){
    return projectArtworkRay(wall,artwork,{origin:{x:event.ray.origin.x*1000,y:event.ray.origin.y*1000,z:event.ray.origin.z*1000},direction:{x:event.ray.direction.x,y:event.ray.direction.y,z:event.ray.direction.z}});
  }
  function rotationPoint(event:ThreeEvent<PointerEvent>){
    return artworkRotationPoint(wall,artwork,{origin:{x:event.ray.origin.x*1000,y:event.ray.origin.y*1000,z:event.ray.origin.z*1000},direction:{x:event.ray.direction.x,y:event.ray.direction.y,z:event.ray.direction.z}});
  }
  function beginRotation(event:ThreeEvent<PointerEvent>){
    if(event.button!==0||artwork.locked||activeTool!=='select')return;
    event.stopPropagation();
    const start=rotationPoint(event);if(!start)return;
    (event.target as Element).setPointerCapture(event.pointerId);
    const initial=artwork.rotationDeg??0;
    rotationGesture.current={start,initial,angle:initial};
    setPreviewAngle(initial);
    useEditor.getState().setArtworkRotationActive(artwork.id);
  }
  function moveRotation(event:ThreeEvent<PointerEvent>){
    const gesture=rotationGesture.current;if(!gesture)return;
    event.stopPropagation();
    const current=rotationPoint(event);if(!current)return;
    const angle=draggedArtworkAngle(gesture.initial,{x:0,y:0},gesture.start,current);
    gesture.angle=angle;
    setPreviewAngle(angle);
  }
  function finishRotation(event:ThreeEvent<PointerEvent>,cancel=false){
    const gesture=rotationGesture.current;if(!gesture)return;
    event.stopPropagation();
    (event.target as Element).releasePointerCapture(event.pointerId);
    rotationGesture.current=null;
    setPreviewAngle(null);
    useEditor.getState().setArtworkRotationActive(null);
    if(!cancel&&gesture.angle!==gesture.initial)useEditor.getState().patchArtwork(artwork.id,{rotationDeg:gesture.angle});
  }
  function begin(event:ThreeEvent<PointerEvent>){
    if(event.button!==0||activeTool==='pan')return;
    event.stopPropagation();
    if(event.shiftKey||artwork.locked||activeTool==='measure'||activeTool==='rotate'||activeTool==='draw')return;
    const hit=facePoint(event);if(!hit)return;
    (event.target as Element).setPointerCapture(event.pointerId);
    useEditor.getState().beginArtworkDrag(artwork.id,hit);
  }
  function moving(event:ThreeEvent<PointerEvent>){
    if(useEditor.getState().artworkGesture?.id!==artwork.id)return;
    event.stopPropagation();
    const walls=useEditor.getState().project.walls.filter(candidate=>candidate.visible&&groups.get(candidate.id)?.visible!==false);
    const hit=projectArtworkWallRay(walls,artwork,{origin:{x:event.ray.origin.x*1000,y:event.ray.origin.y*1000,z:event.ray.origin.z*1000},direction:{x:event.ray.direction.x,y:event.ray.direction.y,z:event.ray.direction.z}});
    if(hit)useEditor.getState().updateArtworkDrag(hit);
  }
  function finish(event:ThreeEvent<PointerEvent>,cancel=false){
    if(useEditor.getState().artworkGesture?.id!==artwork.id)return;
    event.stopPropagation();(event.target as Element).releasePointerCapture(event.pointerId);
    useEditor.getState().finishArtworkDrag(cancel);
  }
  return <>{measurementSnap.marker}<group name={`artwork-${artwork.id}`} position={[x / 1000, y / 1000, z / 1000]} rotation={[0, rotationY, (previewAngle??artwork.rotationDeg??0)*Math.PI/180]} onPointerDown={begin} onPointerMove={e=>{measurementSnap.hover(e);moving(e);}} onPointerUp={e=>finish(e)} onPointerCancel={e=>finish(e,true)} onClick={e => { if(activeTool==='pan')return; e.stopPropagation(); if(activeTool==='measure'){useEditor.getState().pickMeasurement(wallAnchor(project,wall.id,modelPoint(measurementSnap.point(e))),'3d');return;} if(e.delta<4)useEditor.getState().select({ type: 'artwork', id: artwork.id }, e.shiftKey); }} onPointerOver={e => { if(activeTool==='pan')return; e.stopPropagation(); document.body.style.cursor = artwork.locked?'pointer':'grab'; }} onPointerOut={() => { measurementSnap.clear();if(!dragging)document.body.style.cursor = 'auto'; }}><mesh castShadow receiveShadow><boxGeometry args={[w + (artwork.frame === 'none' ? 0 : 0.045), h + (artwork.frame === 'none' ? 0 : 0.045), d]} /><meshStandardMaterial color={frameColors[artwork.frame]} roughness={0.75} /></mesh><mesh position={[0, 0, d / 2 + 0.002]}><planeGeometry args={[w, h]} /><SurfaceFinish color="#ffffff" material={artwork.material} map={texture} roughness={.9}/></mesh>{installationConflict&&<Html position={[0,h/2+.15,0]} center style={{pointerEvents:'none',whiteSpace:'nowrap'}}><span className="dimension-label" style={{color:'#a22'}}>계단·추정 범위와 겹침</span></Html>}{selected && !captureClean && <Line points={[[-w / 2 - 0.055, -h / 2 - 0.055, d / 2 + 0.008], [w / 2 + 0.055, -h / 2 - 0.055, d / 2 + 0.008], [w / 2 + 0.055, h / 2 + 0.055, d / 2 + 0.008], [-w / 2 - 0.055, h / 2 + 0.055, d / 2 + 0.008], [-w / 2 - 0.055, -h / 2 - 0.055, d / 2 + 0.008]]} color="#365cf5" lineWidth={2} />}{selected&&singleSelection&&!artwork.locked&&activeTool==='select'&&!captureClean&&<group><Line points={[[0,h/2+.045,d/2+.05],[0,h/2+.24,d/2+.05]]} color="#365cf5" lineWidth={3}/><mesh position={[0,h/2+.24,d/2+.05]} onPointerDown={beginRotation} onPointerMove={moveRotation} onPointerUp={e=>finishRotation(e)} onPointerCancel={e=>finishRotation(e,true)} onClick={e=>e.stopPropagation()} onPointerOver={e=>{e.stopPropagation();document.body.style.cursor='grab';}} onPointerOut={()=>{document.body.style.cursor='auto';}}><sphereGeometry args={[.115,16,12]}/><meshBasicMaterial color="#365cf5" depthTest={false}/></mesh></group>}</group></>;
}
const ground=new Plane(new Vector3(0,1,0),0);
function groundPoint(e:ThreeEvent<PointerEvent>){const hit=e.ray.intersectPlane(ground,new Vector3());return hit?{x:Math.round(hit.x*100)*10,z:Math.round(hit.z*100)*10}:null;}
function GalleryWall({ wall, artworks, groups, allWalls }: { wall: Wall; artworks: Artwork[]; groups:Map<string,Group>; allWalls:Wall[] }) {
  const measurementSnap=useMeasurementSnap();
  const register=useCallback((group:Group|null)=>{if(group)groups.set(wall.id,group);else groups.delete(wall.id);},[groups,wall.id]);
  const selected = useEditor(s => s.selected.some(x => x.id === wall.id));
  const captureClean=useEditor(s=>s.captureClean);
  const activeTool=useEditor(s=>s.activeTool);
  const length = wallLength(wall);
  const midX = (wall.start.x + wall.end.x) / 2000, midZ = (wall.start.z + wall.end.z) / 2000;
  const dx = wall.end.x - wall.start.x, dz = wall.end.z - wall.start.z;
  function begin(e:ThreeEvent<PointerEvent>,mode:'move'|'rotate'){
    if(e.button!==0||activeTool==='pan'||useEditor.getState().artworkGesture)return;e.stopPropagation();
    if(activeTool==='measure'){useEditor.getState().pickMeasurement(wallAnchor(useEditor.getState().project,wall.id,modelPoint(measurementSnap.point(e))),'3d');return;}
    if(e.shiftKey){useEditor.getState().select({type:'wall',id:wall.id},true);return;}
    if(wall.locked){useEditor.getState().select({type:'wall',id:wall.id});return;}
    const p=groundPoint(e);if(!p)return;
    (e.target as Element).setPointerCapture(e.pointerId);
    useEditor.getState().beginWallTransform(wall.id,mode,p);
  }
  function moving(e:ThreeEvent<PointerEvent>){
    if(useEditor.getState().wallGesture?.id!==wall.id)return;
    e.stopPropagation();const p=groundPoint(e);if(p)useEditor.getState().updateWallTransform(p,true);
  }
  function finish(e:ThreeEvent<PointerEvent>,cancel=false){
    if(useEditor.getState().wallGesture?.id!==wall.id)return;
    e.stopPropagation();useEditor.getState().finishWallTransform(cancel);
  }
  return <group ref={register}>{measurementSnap.marker}<mesh onPointerOut={measurementSnap.clear} position={[midX, wall.heightMm / 2000, midZ]} rotation={[0, -Math.atan2(dz, dx), 0]} castShadow receiveShadow onPointerDown={e=>begin(e,activeTool==='rotate'?'rotate':'move')} onPointerMove={e=>{measurementSnap.hover(e);moving(e);}} onPointerUp={e=>finish(e)} onPointerCancel={e=>finish(e,true)}><boxGeometry args={[length / 1000, wall.heightMm / 1000, wall.thicknessMm / 1000]} /><SurfaceFinish color={selected && !captureClean ? '#e6edff' : wall.color} material={wall.material} roughness={.92}/></mesh>{selected&&!captureClean&&!wall.locked&&activeTool!=='measure'&&activeTool!=='pan'&&<mesh position={[midX-dz/length*.45,wall.heightMm/2000,midZ+dx/length*.45]} onPointerDown={e=>begin(e,'rotate')} onPointerMove={moving} onPointerUp={e=>finish(e)} onPointerCancel={e=>finish(e,true)}><sphereGeometry args={[.12,12,12]}/><meshBasicMaterial color="#365cf5" depthTest={false}/></mesh>}{artworks.filter(a => a.visible && a.imageUrl).map(a => <Suspense key={a.id} fallback={null}><Painting artwork={a} wall={allWalls.find(candidate=>candidate.id===a.wallId)??wall} groups={groups}/></Suspense>)}</group>;
}
function CutawayVisibility({walls,groups,cutaway}:{walls:readonly Wall[];groups:ReadonlyMap<string,Group>;cutaway:boolean}){
  useFrame(({camera})=>applyWallVisibility(walls,groups,camera.position,cutaway));
  return null;
}
function captureCanvas(canvas:HTMLCanvasElement):Promise<Blob>{return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('3D PNG를 만들지 못했습니다.')),'image/png'));}
function waitForArtworks(scene:Object3D,project:Project):Promise<void>{
 const wallIds=new Set(project.walls.map(wall=>wall.id));
 const names=project.artworks.filter(art=>art.visible&&art.imageUrl&&wallIds.has(art.wallId)).map(art=>`artwork-${art.id}`);
 return new Promise((resolve,reject)=>{
  const deadline=Date.now()+10000;
  function check(){
   if(names.every(name=>scene.getObjectByName(name))){resolve();return;}
   if(Date.now()>deadline){reject(new Error('일부 작품 이미지가 아직 준비되지 않았습니다. 다시 시도해 주세요.'));return;}
   setTimeout(check,60);
  }
  check();
 });
}
function drawHtmlLabels(context:CanvasRenderingContext2D,source:HTMLCanvasElement,pixelScale:number){
 const canvasBox=source.getBoundingClientRect();
 context.save();context.scale(pixelScale,pixelScale);context.font='11px "Noto Sans KR", sans-serif';context.textBaseline='middle';
 for(const label of document.querySelectorAll<HTMLElement>('.viewport-stage .dimension-label')){
  const box=label.getBoundingClientRect(),x=box.left-canvasBox.left,y=box.top-canvasBox.top;
  if(x+box.width<0||y+box.height<0||x>canvasBox.width||y>canvasBox.height)continue;
  const message=label.textContent?.trim();if(!message)continue;
  const width=context.measureText(message).width;
  context.fillStyle='#ffffffeb';context.fillRect(x-4,y-2,width+8,18);
  context.fillStyle='#37475e';context.fillText(message,x,y+7);
 }
 context.restore();
}
function CameraSetup({ reset, hydrated, projectId, onReady, onCameraReady, onCameraApplied, cameraRequest, centerX, centerZ, span, maxHeight, centerY, modelKey }: { centerY:number;modelKey:string;reset: number; hydrated:boolean; projectId:string; onReady: (capture: (options:CaptureOptions) => Promise<Blob>) => void; onCameraReady?: (getView:(()=>CameraView3D)|null)=>void; onCameraApplied?:(token:number)=>void; cameraRequest?:{token:number;projectId:string;view:CameraView}|null; centerX:number; centerZ:number; span:number; maxHeight:number }) {
  const { camera, gl, scene, size, invalidate, get } = useThree();
  useEffect(() => {
    if('isPerspectiveCamera' in camera&&camera.isPerspectiveCamera)return;
    camera.position.set(centerX-span, centerY+maxHeight+span, centerZ+span); camera.lookAt(centerX, centerY, centerZ);
    camera.far=Math.max(200,span*10+maxHeight*4);
    if ('zoom' in camera) camera.zoom = Math.min(size.width / (span*1.2+2), size.height / (span+maxHeight+2));
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, size.width, size.height, reset, hydrated, projectId, modelKey, invalidate]);
  useEffect(()=>{
    if(!cameraRequest||cameraRequest.projectId!==projectId)return;
    let cancelled=false,attempts=0,frame=0;
    const apply=()=>{
      if(cancelled)return;
      const controls=get().controls;
      if(!controls||!('target' in controls)||!(controls.target instanceof Vector3)){
        if(attempts++<8)frame=requestAnimationFrame(apply);
        return;
      }
      camera.position.fromArray(cameraRequest.view.position);
      controls.target.fromArray(cameraRequest.view.target);
      if('zoom' in camera)camera.zoom=cameraRequest.view.zoom;
      if('fov' in camera)camera.fov=cameraRequest.view.fov??50;
      camera.updateProjectionMatrix();
      if('update' in controls&&typeof controls.update==='function')controls.update();
      invalidate();
      onCameraApplied?.(cameraRequest.token);
    };
    frame=requestAnimationFrame(apply);
    return ()=>{cancelled=true;cancelAnimationFrame(frame);};
  },[camera,cameraRequest,get,invalidate,onCameraApplied,projectId]);
  useEffect(()=>{
    if(!onCameraReady)return;
    onCameraReady(createCameraViewGetter(camera,()=>{
      const controls=get().controls;
      return controls&&'target' in controls&&controls.target instanceof Vector3
        ? controls.target : new Vector3(centerX,centerY,centerZ);
    }));
    return ()=>onCameraReady(null);
  },[camera,get,onCameraReady,centerX,centerZ,centerY]);
  useEffect(() => onReady(async (options) => {
    const editor=useEditor.getState(),oldPixelRatio=gl.getPixelRatio(),cssSize=gl.getSize(new Vector2());
    const target=capturePixelSize(cssSize.x,cssSize.y,options.longEdge);
    const max=Math.min(gl.getContext().getParameter(gl.getContext().MAX_RENDERBUFFER_SIZE) as number,gl.getContext().getParameter(gl.getContext().MAX_TEXTURE_SIZE) as number);
    if(target.width>max||target.height>max)throw new Error('이 브라우저에서는 선택한 고해상도를 지원하지 않습니다. 낮은 해상도로 저장해 주세요.');
    const grid=scene.getObjectByName('capture-grid'),gridWasVisible=grid?.visible;
    try{
      await waitForArtworks(scene,editor.previewProject??editor.project);
      await document.fonts.ready;
      flushSync(()=>editor.setCaptureMode(true,options.includeDimensions));
      await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
      if(grid)grid.visible=options.includeGrid;
      gl.setPixelRatio(target.width/cssSize.x);gl.render(scene,camera);
      const canvas=document.createElement('canvas');canvas.width=gl.domElement.width;canvas.height=gl.domElement.height;
      const context=canvas.getContext('2d');if(!context)throw new Error('3D 캡처 캔버스를 만들 수 없습니다.');
      context.drawImage(gl.domElement,0,0,canvas.width,canvas.height);
      if(options.includeDimensions)drawHtmlLabels(context,gl.domElement,canvas.width/cssSize.x);
      return await captureCanvas(canvas);
    }finally{if(grid&&gridWasVisible!==undefined)grid.visible=gridWasVisible;gl.setPixelRatio(oldPixelRatio);editor.setCaptureMode(false);gl.render(scene,camera);}
  }), [gl, scene, camera, onReady]);
  return null;
}
function Dimension({ from, to, label }: { from: [number, number, number]; to: [number, number, number]; label: string }) {
  const mid: [number, number, number] = [(from[0] + to[0]) / 2, 0.035, (from[2] + to[2]) / 2];
  const across = Math.abs(from[0] - to[0]) > Math.abs(from[2] - to[2]);
  return <group><Line points={[from, to]} color="#748193" lineWidth={1} />{[from, to].map((p, i) => <Line key={i} points={across ? [[p[0], p[1], p[2] - 0.10], [p[0], p[1], p[2] + 0.10]] : [[p[0] - 0.10, p[1], p[2]], [p[0] + 0.10, p[1], p[2]]]} color="#748193" lineWidth={1} />)}<Html position={mid} center style={{ pointerEvents: 'none' }}><span className="dimension-label">{label}</span></Html></group>;
}
function MeasuredDimensions3D(){
 const {project,measurementDraft,showDimensions,captureClean,captureDimensions}=useEditor();
 const visible=showDimensions&&(!captureClean||captureDimensions);
 const items=visible?(project.dimensions??[]).filter(item=>item.view==='3d'):[];
 const all=items.map(item=>({id:item.id,offsetMm:item.offsetMm,...resolveMeasurement(project,item)}));
 if(!captureClean&&measurementDraft?.view==='3d'&&measurementDraft.end)all.push({id:'draft',offsetMm:0,...resolveMeasurement(project,{id:'draft',view:'3d',start:measurementDraft.start,end:measurementDraft.end,offsetMm:0})});
 return <>{all.map(item=>{const from:[number,number,number]=[item.start.x/1000,item.start.y/1000,item.start.z/1000],to:[number,number,number]=[item.end.x/1000,item.end.y/1000,item.end.z/1000];return <group key={item.id}><Line points={[from,to]} color={item.detached?'#b54437':item.id==='draft'?'#16816b':'#365cf5'} lineWidth={2}/><Html position={[(from[0]+to[0])/2,(from[1]+to[1])/2+item.offsetMm/1000,(from[2]+to[2])/2]} center style={{pointerEvents:'none',whiteSpace:'nowrap'}}><span className="dimension-label">{item.detached?'연결 끊김 · ':''}{Math.round(item.distanceMm).toLocaleString()} mm</span></Html></group>;})}{!captureClean&&measurementDraft?.view==='3d'&&!measurementDraft.end&&<mesh position={[measurementDraft.start.fallback.x/1000,measurementDraft.start.fallback.y/1000,measurementDraft.start.fallback.z/1000]}><sphereGeometry args={[.055,12,12]}/><meshBasicMaterial color="#365cf5" depthTest={false}/></mesh>}</>;
}
export function Gallery3D({ reset, onCaptureReady, onCameraReady, onCameraApplied, cameraRequest, cutaway, projection='orthographic', eyeHeight=1600 }: { projection?:'orthographic'|'perspective';eyeHeight?:number;reset: number; onCaptureReady: (capture: (options:CaptureOptions)=>Promise<Blob>) => void; onCameraReady?: (getView:(()=>CameraView3D)|null)=>void; onCameraApplied?:(token:number)=>void; cameraRequest?:{token:number;projectId:string;view:CameraView}|null; cutaway: boolean }) {
  const { project, previewProject, wallGesture, artworkGesture, rotatingArtworkId, showDimensions, hydrated, activeTool, captureClean,captureDimensions } = useEditor();
  const displayed=previewProject??project;
  const eye=createEyeLevelView(project,useEditor.getState().activeWallId,eyeHeight);
  const floor = useMemo(() => floorWithOpenings(displayed), [displayed.walls,displayed.openings]);
  const floorShapes = useMemo(() => floor.surfaces.map(({ outer: points, holes }) => {
    const shape = new Shape();
    shape.moveTo(points[0].x / 1000, points[0].z / 1000);
    points.slice(1).forEach(point => shape.lineTo(point.x / 1000, point.z / 1000));
    shape.closePath();
    shape.holes = holes.map(points => {
      const hole = new Path();
      // Hole winding opposes the counterclockwise outer boundary.
      const reversed = [...points].reverse();
      hole.moveTo(reversed[0].x / 1000, reversed[0].z / 1000);
      reversed.slice(1).forEach(point => hole.lineTo(point.x / 1000, point.z / 1000));
      hole.closePath();
      return hole;
    });
    return shape;
  }), [floor]);
  const bounds=projectSpatialBounds(displayed);
  const minX=bounds.minX/1000,maxX=bounds.maxX/1000,minZ=bounds.minZ/1000,maxZ=bounds.maxZ/1000;
  const centerX=(minX+maxX)/2,centerZ=(minZ+maxZ)/2;
  const span=Math.max(Math.hypot(maxX-minX,maxZ-minZ),2),maxHeight=(bounds.maxY-bounds.minY)/1000,centerY=bounds.minY/1000+maxHeight/3;
  const m=displayed.referenceModel,modelKey=m?JSON.stringify([m.name,m.visible,m.sizeMm,m.scale,m.rotationDeg,m.positionMm]):'';
  const cameraFrame=useRef<{key:string;target:[number,number,number]}>({key:'',target:[centerX,centerY,centerZ]});
  const wallGroups=useRef(new Map<string,Group>());
  const draggingArtworkSourceWall=artworkGesture?.base.artworks.find(item=>item.id===artworkGesture.id)?.wallId;
  const frameKey=`${reset}:${hydrated}:${project.id}:${projection}:${modelKey}`;
  if(cameraFrame.current.key!==frameKey)cameraFrame.current={key:frameKey,target:projection==='perspective'?eye.target:[centerX,centerY,centerZ]};
  function measureFloor(e:ThreeEvent<PointerEvent>){
    if(activeTool!=='measure')return;
    e.stopPropagation();const point=modelPoint(e.point);
    useEditor.getState().pickMeasurement(fixedAnchor({x:point.x,y:0,z:point.z}),'3d');
  }
  return <Canvas key={projection} events={state=>({...events(state),filter:items=>items.filter(item=>isObjectVisible(item.object))})} orthographic={projection==='orthographic'} shadows frameloop="demand" style={{cursor:activeTool==='pan'?'grab':undefined}} dpr={[1, 1.75]} gl={{ antialias: true, preserveDrawingBuffer: true }} camera={projection==='perspective'?{position:eye.position,fov:50,zoom:1,near:.02,far:Math.max(200,span*10)}:{ position: [-9, 10.5, 13], zoom: 65, near: 0.1, far: 200 }}><color attach="background" args={['#e9edf1']} /><SurfaceEnvironment enabled={needsSurfaceEnvironment(displayed)}/><ambientLight intensity={0.65} /><hemisphereLight args={['#ffffff', '#cad0d6', 0.7]} /><directionalLight position={[-3, 12, 6]} intensity={2.3} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} shadow-bias={-0.001} /><CameraSetup centerY={centerY} modelKey={modelKey} reset={reset} hydrated={hydrated} projectId={project.id} onReady={onCaptureReady} onCameraReady={onCameraReady} onCameraApplied={onCameraApplied} cameraRequest={cameraRequest} centerX={centerX} centerZ={centerZ} span={span} maxHeight={maxHeight} /><gridHelper name="capture-grid" args={[60, 60, '#cbd3db', '#dce2e8']} position={[0, -0.105, 0]} />{activeTool==='measure'&&<mesh rotation={[-Math.PI/2,0,0]} position={[centerX,-.15,centerZ]} onPointerDown={measureFloor}><planeGeometry args={[Math.max(100,span*3),Math.max(100,span*3)]}/><meshBasicMaterial transparent opacity={0} depthWrite={false}/></mesh>}{floorShapes.map((shape, index) => <mesh key={index} rotation={[Math.PI / 2, 0, 0]} receiveShadow onPointerDown={measureFloor}><extrudeGeometry args={[shape, { depth: 0.16, bevelEnabled: false, steps: 1 }]} /><SurfaceFinish color={displayed.floorColor} material={displayed.floorMaterial} roughness={.96}/></mesh>)}{floorShapes.length === 0 && <Html position={[centerX, 0.1, centerZ]} center><div className="floor-empty-state"><span>벽 끝점을 연결하면 전시장 바닥이 생성됩니다.</span>{!previewProject&&canRestoreDemoBoundary(project)&&<button type="button" onClick={()=>useEditor.getState().restoreDemoSpace()}>기본 공간 배치 복원</button>}</div></Html>}{openingSegments(displayed).map(o=><group key={o.id}><Line points={[[o.start.x/1000,.03,o.start.z/1000],[o.end.x/1000,.03,o.end.z/1000]]} color={o.kind==='door'?'#16816b':'#2785b8'} dashed dashSize={.1} gapSize={.08}/><Html position={[(o.start.x+o.end.x)/2000,.12,(o.start.z+o.end.z)/2000]} center style={{pointerEvents:'none'}}><span className="dimension-label">{o.kind==='door'?'출입구':o.kind==='stair-access'?'계단 통로':'창문'} · 개구부</span></Html></group>)}{installationZones(displayed).map(zone=><group key={zone.id}><mesh position={[(zone.x+zone.width/2)/1000,.025,(zone.z+zone.depth/2)/1000]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[zone.width/1000,zone.depth/1000]}/><meshBasicMaterial color="#e44b4b" transparent opacity={.3} depthWrite={false}/></mesh><Html position={[(zone.x+zone.width/2)/1000,.08,(zone.z+zone.depth/2)/1000]} center style={{pointerEvents:'none',whiteSpace:'nowrap'}}><span className="dimension-label" style={{color:'#a22'}}>계단·추정 · 설치 제외 검출 범위</span></Html></group>)}{displayed.walls.map(wall => <GalleryWall key={wall.id} wall={wall} artworks={displayed.artworks.filter(a => (a.id===artworkGesture?.id?draggingArtworkSourceWall:a.wallId)===wall.id)} groups={wallGroups.current} allWalls={displayed.walls} />)}<CutawayVisibility walls={displayed.walls} groups={wallGroups.current} cutaway={projection==='orthographic'&&cutaway}/>{showDimensions&&(!captureClean||captureDimensions) && <><Dimension from={[minX, 0, maxZ + 0.65]} to={[maxX, 0, maxZ + 0.65]} label={`${Math.round((maxX - minX) * 1000).toLocaleString()} mm`} /><Dimension from={[minX - 0.65, 0, minZ]} to={[minX - 0.65, 0, maxZ]} label={`${Math.round((maxZ - minZ) * 1000).toLocaleString()} mm`} /></>}{displayed.referenceModel&&<ReferenceModel3D model={displayed.referenceModel}/>}<MeasuredDimensions3D/><OrbitControls key={reset} enabled={!wallGesture&&!artworkGesture&&!rotatingArtworkId} mouseButtons={{LEFT:activeTool==='pan'?MOUSE.PAN:MOUSE.ROTATE,MIDDLE:MOUSE.DOLLY,RIGHT:MOUSE.PAN}} makeDefault target={cameraFrame.current.target} minZoom={0.1} maxZoom={240} maxPolarAngle={projection==='perspective'?Math.PI-.05:Math.PI / 2} minDistance={.1} enableDamping /></Canvas>;
}
