import {StrictMode} from 'react';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act,create} from '@react-three/test-renderer';
import {Group,Ray,Texture,Vector3,type Mesh,type Scene} from 'three';
import {GalleryWall} from './Gallery3D';
import {useEditor} from '../state/editor';
import {sceneProject} from '../domain/sceneProject';
import {floorWithOpenings} from '../domain/openings';
import {exportProjectPackage,importProjectPackage} from '../lib/projectPackage';
import {createStandardView} from './cameraView3d';
import type {Project,Wall} from '../domain/types';

// Actual reconciler, Three geometry, wall/attached Painting handlers and store.
// Ray/capture transport and annotation portals are adapters, not browser/GPU evidence.
vi.mock('@react-three/drei',()=>({Html:()=>null,Line:()=>null,OrbitControls:()=>null,PivotControls:()=>null}));
vi.mock('./useArtworkTexture',()=>({useArtworkTexture:()=>({ready:true,texture:new Texture(),appliedSize:128})}));
let renderer:Awaited<ReturnType<typeof create>>,p:Project;
const groups=new Map<string,Group>();
const target={setPointerCapture:vi.fn(),releasePointerCapture:vi.fn()};
function Contents(){const state=useEditor(),shown=state.previewProject??state.project;return <>{shown.walls.map(w=><GalleryWall key={w.id} wall={w} allWalls={shown.walls} artworks={shown.artworks.filter(a=>a.wallId===w.id)} groups={groups}/>)}</>;}
const wall=()=>renderer.scene.findByProps({name:'capture-wall-'+p.walls[0].id});
const handle=()=>renderer.scene.findAll(n=>n.instance.type==='Mesh'&&(n.instance as Mesh).geometry?.type==='SphereGeometry')[0];
function center(w:Wall){return {x:(w.start.x+w.end.x)/2,z:(w.start.z+w.end.z)/2};}
async function fire(node:ReturnType<typeof wall>,event:string,x:number,z:number,extra:Record<string,unknown>={}){await renderer.fireEvent(node,event,{button:0,pointerId:7,altKey:true,target,ray:new Ray(new Vector3(x/1000,10,z/1000),new Vector3(0,-1,0)),point:new Vector3(),stopPropagation:vi.fn(),...extra});}
async function start(){const c=center(p.walls[0]);await fire(wall(),'pointerDown',c.x,c.z);await fire(wall(),'pointerMove',c.x+200,c.z+300);}
function wallCorners(w:Wall){const len=Math.hypot(w.end.x-w.start.x,w.end.z-w.start.z),nx=-(w.end.z-w.start.z)/len,nz=(w.end.x-w.start.x)/len;return [w.start,w.end].flatMap(point=>[-1,1].flatMap(sign=>[0,w.heightMm].map(y=>new Vector3((point.x+nx*sign*w.thicknessMm/2)/1000,y/1000,(point.z+nz*sign*w.thicknessMm/2)/1000))));}
function cornerError(w:Wall){const mesh=(renderer.scene.instance as Scene).getObjectByName('capture-wall-'+w.id) as Mesh,positions=mesh.geometry.getAttribute('position'),expected=wallCorners(w);return Math.max(...Array.from({length:positions.count},(_,i)=>{const point=mesh.localToWorld(new Vector3().fromBufferAttribute(positions,i));return Math.min(...expected.map(v=>v.distanceTo(point)))*1000;}));}
function attachedError(project:Project){const a=project.artworks[0],w=project.walls.find(w=>w.id===a.wallId)!,len=Math.hypot(w.end.x-w.start.x,w.end.z-w.start.z),dx=(w.end.x-w.start.x)/len,dz=(w.end.z-w.start.z)/len,side=a.wallSide==='back'?-1:1,offset=(w.thicknessMm+a.depthMm)/2+5,expected=new Vector3((w.start.x+dx*a.alongMm-dz*side*offset)/1000,a.centerHeightMm/1000,(w.start.z+dz*a.alongMm+dx*side*offset)/1000),node=(renderer.scene.instance as Scene).getObjectByName('artwork-'+a.id)!;return node.getWorldPosition(new Vector3()).distanceTo(expected)*1000;}
beforeEach(async()=>{
 (globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;vi.stubGlobal('window',new EventTarget());target.setPointerCapture.mockClear();target.releasePointerCapture.mockClear();groups.clear();
 const backup=await importProjectPackage(new Uint8Array(await readFile('docs/validation/converted-pointer-2026-10-11/project.gonggan.zip')).buffer);p={...sceneProject(backup,backup.scenes[0]),id:'wall-3d-pointer-workflow',scenes:[]};useEditor.getState().loadProject(p,true);useEditor.getState().setView('3d');useEditor.getState().setTool('select');useEditor.getState().setLinkedCorners(true);useEditor.getState().select({type:'wall',id:p.walls[0].id});p=useEditor.getState().project;renderer=await create(<StrictMode><Contents/></StrictMode>);
});
afterEach(async()=>{await renderer.unmount();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('uses the release ray, carries linked corners and actual artwork geometry, and undoes once',async()=>{
 await start();const c=center(p.walls[0]);await fire(wall(),'pointerUp',c.x+500,c.z+700);const next=useEditor.getState().project;expect(next.walls[0].start.x).toBeCloseTo(p.walls[0].start.x+500);expect(next.walls[0].end.z).toBeCloseTo(p.walls[0].end.z+700);expect(next.walls[1].start).toEqual(next.walls[0].end);expect(next.walls[2].end).toEqual(next.walls[0].start);expect(next.artworks).toEqual(p.artworks);expect(cornerError(next.walls[0])).toBeLessThan(.01);expect(attachedError(next)).toBeLessThan(.01);expect(useEditor.getState().past).toHaveLength(1);expect(target.releasePointerCapture).toHaveBeenCalledWith(7);await act(async()=>useEditor.getState().undo());expect(useEditor.getState().project).toEqual(p);await act(async()=>useEditor.getState().redo());expect(useEditor.getState().project).toEqual(next);
});
it('uses the final rotation ray without requiring a move event',async()=>{
 const c=center(p.walls[0]);await fire(handle(),'pointerDown',c.x,c.z+500);await fire(handle(),'pointerUp',c.x+500,c.z);const next=useEditor.getState().project,r=Math.atan2(Math.round(c.z/10)*10-c.z,Math.round((c.x+500)/10)*10-c.x)-Math.atan2(Math.round((c.z+500)/10)*10-c.z,Math.round(c.x/10)*10-c.x),dx=p.walls[0].start.x-c.x,dz=p.walls[0].start.z-c.z;expect(next.walls[0].start.x).toBeCloseTo(c.x+dx*Math.cos(r)-dz*Math.sin(r));expect(next.walls[0].start.z).toBeCloseTo(c.z+dx*Math.sin(r)+dz*Math.cos(r));expect(cornerError(next.walls[0])).toBeLessThan(.01);expect(attachedError(next)).toBeLessThan(.01);expect(useEditor.getState().past).toHaveLength(1);
});
it('ignores another pointer move, capture loss and release',async()=>{
 await start();const preview=useEditor.getState().previewProject,c=center(p.walls[0]);for(const event of ['pointerMove','lostPointerCapture','pointerUp'])await fire(wall(),event,c.x+900,c.z+800,{pointerId:99});expect(useEditor.getState().previewProject).toBe(preview);expect(useEditor.getState().past).toHaveLength(0);await fire(wall(),'pointerUp',c.x+500,c.z+700);expect(useEditor.getState().past).toHaveLength(1);
});
it.each(['project','selection','wall','view','tool','edit'] as const)('retires an owned pointer across a batched %s change',async kind=>{
 await start();await act(async()=>{const s=useEditor.getState();if(kind==='project'){s.loadProject({...p,id:'other'});s.loadProject(p);}else if(kind==='selection'){s.select({type:'wall',id:p.walls[1].id});s.select({type:'wall',id:p.walls[0].id});}else if(kind==='wall'){s.setActiveWall(p.walls[1].id);s.setActiveWall(p.walls[0].id);}else if(kind==='view'){s.setView('plan');s.setView('3d');}else if(kind==='tool'){s.setTool('pan');s.setTool('select');}else{s.patchWall(p.walls[1].id,{heightMm:3200});}});const before=useEditor.getState().project,count=useEditor.getState().past.length,c=center(p.walls[0]);await fire(wall(),'pointerUp',c.x+500,c.z+700);expect(useEditor.getState().project).toBe(before);expect(useEditor.getState().past).toHaveLength(count);expect(useEditor.getState().wallGesture).toBeNull();
});
it.each(['escape','unmount','lostPointerCapture'] as const)('cancels the owned preview on %s',async kind=>{
 await start();if(kind==='escape')await act(async()=>window.dispatchEvent(Object.assign(new Event('keydown'),{key:'Escape'})));else if(kind==='unmount')await renderer.unmount();else await fire(wall(),'lostPointerCapture',0,0);expect(useEditor.getState().project).toBe(p);expect(useEditor.getState().wallGesture).toBeNull();expect(useEditor.getState().previewProject).toBeNull();expect(useEditor.getState().past).toHaveLength(0);expect(target.releasePointerCapture).toHaveBeenCalledWith(7);
});
it('preserves a newer external transform of the same wall',async()=>{
 await start();await act(async()=>useEditor.getState().beginWallTransform(p.walls[0].id,'move',{x:0,z:0}));const newer=useEditor.getState().wallGesture;await fire(wall(),'pointerUp',0,0);expect(useEditor.getState().wallGesture).toBe(newer);await renderer.unmount();expect(useEditor.getState().wallGesture).toBe(newer);useEditor.getState().finishWallTransform(true);
});
it('does not finish an external gesture it never captured',async()=>{
 await act(async()=>useEditor.getState().beginWallTransform(p.walls[0].id,'move',{x:0,z:0}));const newer=useEditor.getState().wallGesture;await fire(wall(),'pointerUp',0,0);expect(useEditor.getState().wallGesture).toBe(newer);
});
it('rejects an old start callback after a project replacement',async()=>{
 const callback=wall().props.onPointerDown;await act(async()=>useEditor.getState().loadProject({...p,id:'other'}));await act(async()=>callback({button:0,pointerId:7,target,ray:new Ray(new Vector3(0,10,0),new Vector3(0,-1,0)),stopPropagation:vi.fn()}));expect(useEditor.getState().wallGesture).toBeNull();expect(target.setPointerCapture).not.toHaveBeenCalled();
});
it('does not start from right-click or a locked wall',async()=>{
 const c=center(p.walls[0]);await fire(wall(),'pointerDown',c.x,c.z,{button:2});expect(useEditor.getState().wallGesture).toBeNull();await act(async()=>useEditor.getState().patchWall(p.walls[0].id,{locked:true}));await fire(wall(),'pointerDown',c.x,c.z);expect(useEditor.getState().wallGesture).toBeNull();
});
it('carries actual wall edits and imported floor precedence through two Scenes and exact backup',async()=>{
 const originalFloor=JSON.stringify(p.importedFloor),originalArea=floorWithOpenings(p).areaMm2;await start();expect(useEditor.getState().saveScene('아직 이동 중')).toBe(false);const c=center(p.walls[0]);await fire(wall(),'pointerUp',c.x+500,c.z+700);await act(async()=>{expect(useEditor.getState().saveScene('벽 이동',createStandardView(useEditor.getState().project,'bird',{width:1200,height:800}))).toBe(true);});const moved=useEditor.getState().project,afterMoveError=cornerError(moved.walls[0]),afterMoveArtworkError=attachedError(moved);p=moved;
 const c2=center(p.walls[0]);await fire(handle(),'pointerDown',c2.x,c2.z+500);await fire(handle(),'pointerUp',c2.x+500,c2.z);await act(async()=>{expect(useEditor.getState().saveScene('벽 회전',createStandardView(useEditor.getState().project,'front',{width:1200,height:800}))).toBe(true);});const final=useEditor.getState().project,rotated=sceneProject(final,final.scenes[1]);expect(JSON.stringify(final.importedFloor)).toBe(originalFloor);expect(floorWithOpenings(final).areaMm2).toBe(originalArea);expect(sceneProject(final,final.scenes[0]).walls).toEqual(moved.walls);expect(rotated.walls).toEqual(final.walls);const rotatedError=cornerError(final.walls[0]),rotatedArtworkError=attachedError(final);expect(rotatedError).toBeLessThan(.01);expect(rotatedArtworkError).toBeLessThan(.01);
 const wrong={...final.walls[0],start:{...final.walls[0].start,x:final.walls[0].start.x+100},end:{...final.walls[0].end,x:final.walls[0].end.x+100}},negativeError=cornerError(wrong);expect(negativeError).toBeGreaterThan(90);
 const backup=await exportProjectPackage(final,async()=>{throw new Error('No external asset');}),restored=await importProjectPackage(await backup.arrayBuffer());expect(JSON.stringify(restored)).toBe(JSON.stringify(final));await act(async()=>useEditor.getState().loadProject(restored));expect(cornerError(restored.walls[0])).toBeLessThan(.01);expect(attachedError(restored)).toBeLessThan(.01);
 if(process.env.GONGGAN_WALL_POINTER_PROOF==='1'){const dir='docs/validation/wall-pointer-2026-10-11';await mkdir(dir,{recursive:true});await writeFile(dir+'/project.gonggan.zip',new Uint8Array(await backup.arrayBuffer()));await writeFile(dir+'/project.json',JSON.stringify(final,null,2)+'\n');await writeFile(dir+'/workflow.json',JSON.stringify({date:'2026-10-11',actualR3fWallGeometry:true,sourceBackup:'docs/validation/converted-pointer-2026-10-11/project.gonggan.zip',wallCount:final.walls.length,artworkCount:final.artworks.length,sceneNames:final.scenes.map(s=>s.name),afterMoveErrorMm:afterMoveError,afterMoveArtworkErrorMm:afterMoveArtworkError,afterRotationErrorMm:rotatedError,afterRotationArtworkErrorMm:rotatedArtworkError,wrongExpectedTranslationMm:100,wrongExpectedGeometryErrorMm:negativeError,originalFloorAreaMm2:originalArea,importedFloorUnchanged:true,backupExact:true,limits:['Synthetic rays/capture target and Texture transport, actual R3F/Three/store/Scene/ZIP','No browser/GPU/3D capture or independent GLB receiver in this milestone','No deployment, operational auth, two-device, full 24-step or user metrics acceptance']},null,2)+'\n');}
});
