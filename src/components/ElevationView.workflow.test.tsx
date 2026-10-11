// @vitest-environment jsdom
import {act,StrictMode} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {ElevationView} from './ElevationView';
import {useEditor} from '../state/editor';
import {createDemoProject} from '../domain/model';
import type {Project} from '../domain/types';

let root:Root,container:HTMLDivElement,p:Project;
const svg=()=>container.querySelector('svg')!;
async function pointer(el:Element,type:string,x:number,y:number,options:{pointerId?:number;button?:number;altKey?:boolean}={}){const event=new MouseEvent(type,{bubbles:true,button:options.button??0,clientX:x,clientY:y,altKey:options.altKey});Object.defineProperty(event,'pointerId',{value:options.pointerId??7});await act(async()=>el.dispatchEvent(event));}
const artwork=()=>container.querySelector('.draggable-art')!;
async function rotate(){await pointer(artwork(),'pointerdown',1400,1700);await pointer(svg(),'pointerup',1400,1700);const handle=container.querySelector('.artwork-rotation-handle')!;expect(handle).toBeTruthy();await pointer(handle,'pointerdown',1400,1150);await pointer(svg(),'pointermove',2250,1700);}
async function click(label:string){const b=[...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===label)!;expect(b).toBeTruthy();await act(async()=>b.click());}
beforeEach(async()=>{
 (globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
 Object.defineProperty(SVGElement.prototype,'getScreenCTM',{configurable:true,value:()=>({a:1,inverse:()=>({a:1,b:0,c:0,d:1,e:0,f:0})})});Object.defineProperty(SVGElement.prototype,'setPointerCapture',{configurable:true,value:()=>{}});
 vi.stubGlobal('DOMPoint',class{constructor(public x:number,public y:number){}matrixTransform(){return {x:this.x,y:this.y};}});
 p={...createDemoProject(),id:'elevation-pointer-project',scenes:[]};p.artworks=p.artworks.slice(0,2).map(a=>({...a,widthMm:400,heightMm:600,frame:'none',presentationType:'photo-print',centerHeightMm:1500}));useEditor.getState().loadProject(p);useEditor.getState().setView('elevation');useEditor.getState().setTool('select');
 container=document.createElement('div');document.body.append(container);root=createRoot(container);await act(async()=>root.render(<StrictMode><ElevationView/></StrictMode>));
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});

it('drags with a height snap guide, bypasses with Alt, commits once and undoes/redoes',async()=>{
 const before=useEditor.getState().project;await pointer(artwork(),'pointerdown',1400,1700);await pointer(svg(),'pointermove',1610,1706);expect(useEditor.getState().project).toBe(before);expect(useEditor.getState().previewProject?.artworks[0]).toMatchObject({alongMm:1610,centerHeightMm:1500});expect(container.querySelector('[aria-label="작품 스냅 안내선"]')).toBeTruthy();await pointer(svg(),'pointermove',1610,1706,{altKey:true});expect(useEditor.getState().previewProject?.artworks[0].centerHeightMm).toBe(1494);expect(container.querySelector('[aria-label="작품 스냅 안내선"]')).toBeNull();await pointer(svg(),'pointerup',1610,1706,{altKey:true});expect(useEditor.getState().project.artworks[0]).toMatchObject({alongMm:1610,centerHeightMm:1494});expect(useEditor.getState().past).toHaveLength(1);await act(async()=>useEditor.getState().undo());expect(useEditor.getState().project).toEqual(before);await act(async()=>useEditor.getState().redo());expect(useEditor.getState().project.artworks[0].alongMm).toBe(1610);
});
it('uses the release coordinate for a rotation and records one undo point',async()=>{
 await rotate();await pointer(svg(),'pointerup',1400,2550);expect(useEditor.getState().project.artworks[0].rotationDeg).toBe(180);expect(useEditor.getState().past).toHaveLength(1);expect(useEditor.getState().rotatingArtworkId).toBeNull();await act(async()=>useEditor.getState().undo());expect(useEditor.getState().project.artworks[0].rotationDeg??0).toBe(0);
});
it.each(['project-roundtrip','selection-roundtrip','wall-roundtrip','same-project-edit','tool-change'] as const)('retires an in-progress rotation on %s',async transition=>{
 await rotate();await act(async()=>{const s=useEditor.getState();if(transition==='project-roundtrip'){s.loadProject({...p,id:'other-elevation-project'});s.loadProject(p);}else if(transition==='selection-roundtrip'){s.select({type:'artwork',id:p.artworks[1].id});s.select({type:'artwork',id:p.artworks[0].id});}else if(transition==='wall-roundtrip'){s.setActiveWall(p.walls[1].id);s.setActiveWall(p.walls[0].id);}else if(transition==='same-project-edit'){s.patchArtwork(p.artworks[0].id,{widthMm:500});}else{s.setTool('move');}});const before=useEditor.getState().project,count=useEditor.getState().past.length;await pointer(svg(),'pointerup',2250,1700);expect(useEditor.getState().project).toBe(before);expect(useEditor.getState().past).toHaveLength(count);expect(useEditor.getState().project.artworks[0].rotationDeg??0).toBe(0);
});
it('cancels capture loss during rotation or drag without committing a late release',async()=>{
 await rotate();const before=useEditor.getState().project;await pointer(svg(),'lostpointercapture',2250,1700);await pointer(svg(),'pointerup',2250,1700);expect(useEditor.getState().project).toBe(before);await pointer(artwork(),'pointerdown',1400,1700);await pointer(svg(),'pointermove',1700,1800);expect(useEditor.getState().previewProject).toBeTruthy();await pointer(svg(),'lostpointercapture',1700,1800);expect(useEditor.getState().previewProject).toBeNull();await pointer(svg(),'pointerup',1700,1800);expect(useEditor.getState().project).toBe(before);expect(useEditor.getState().past).toHaveLength(0);
});
it('ignores a second pointer while rotating, then lets the owning pointer finish',async()=>{
 await rotate();await pointer(artwork(),'pointerdown',1400,1700,{pointerId:99});await pointer(svg(),'pointermove',1700,1800,{pointerId:99});await pointer(svg(),'lostpointercapture',2250,1700,{pointerId:99});await pointer(svg(),'pointerup',2250,1700,{pointerId:99});expect(useEditor.getState().project.artworks[0].rotationDeg??0).toBe(0);expect(useEditor.getState().rotatingArtworkId).toBe(p.artworks[0].id);await pointer(svg(),'pointerup',2250,1700);expect(useEditor.getState().project.artworks[0].rotationDeg).toBe(-90);
});
it('keeps a right click from starting artwork movement or rotation',async()=>{
 await pointer(artwork(),'pointerdown',1400,1700,{button:2});expect(useEditor.getState().artworkGesture).toBeNull();await pointer(artwork(),'pointerdown',1400,1700);await pointer(svg(),'pointerup',1400,1700);await pointer(container.querySelector('.artwork-rotation-handle')!,'pointerdown',1400,1150,{button:2});await pointer(svg(),'pointermove',2250,1700);await pointer(svg(),'pointerup',2250,1700);expect(useEditor.getState().project.artworks[0].rotationDeg??0).toBe(0);expect(useEditor.getState().past).toHaveLength(0);
});
it('cancels a drag on another wall and preserves editing on the B side',async()=>{
 await pointer(artwork(),'pointerdown',1400,1700);await pointer(svg(),'pointermove',1600,1700);await click(p.walls[1].name);expect(useEditor.getState().previewProject).toBeNull();await pointer(svg(),'pointerup',1600,1700);expect(useEditor.getState().project.artworks[0].alongMm).toBe(1400);await act(async()=>useEditor.getState().patchArtwork(p.artworks[0].id,{wallSide:'back'}));await click(p.walls[0].name);const x=8000-1400;await pointer(artwork(),'pointerdown',x,1700);await pointer(svg(),'pointermove',x-200,1700);await pointer(svg(),'pointerup',x-200,1700);expect(useEditor.getState().project.artworks[0]).toMatchObject({wallSide:'back',alongMm:1600,centerHeightMm:1500});
});

it('cancels Escape and unmount without keeping an owned preview or rotation busy state',async()=>{
 await rotate();await act(async()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));await pointer(svg(),'pointerup',2250,1700);expect(useEditor.getState().past).toHaveLength(0);expect(useEditor.getState().rotatingArtworkId).toBeNull();await pointer(artwork(),'pointerdown',1400,1700);await pointer(svg(),'pointermove',1700,1800);expect(useEditor.getState().previewProject).toBeTruthy();await act(async()=>root.unmount());expect(useEditor.getState().artworkGesture).toBeNull();expect(useEditor.getState().previewProject).toBeNull();expect(useEditor.getState().past).toHaveLength(0);
});
it('pans with the owning pointer and resets the viewport on a batched project roundtrip',async()=>{
 const before=useEditor.getState().project;await act(async()=>useEditor.getState().setTool('pan'));const box=svg().getAttribute('viewBox')!;await pointer(svg(),'pointerdown',100,100);await pointer(svg(),'pointermove',220,180,{pointerId:99});expect(svg().getAttribute('viewBox')).toBe(box);await pointer(svg(),'pointermove',220,180);const values=box.split(' ').map(Number);expect(svg().getAttribute('viewBox')!.split(' ').map(Number)).toEqual([values[0]-120,values[1]-80,values[2],values[3]]);expect(useEditor.getState().project).toBe(before);await act(async()=>{useEditor.getState().loadProject({...p,id:'other-pan-project'});useEditor.getState().loadProject(p);});expect(svg().getAttribute('viewBox')).toBe(box);await pointer(svg(),'pointerup',220,180);expect(useEditor.getState().past).toHaveLength(0);
});
it('does not cancel a newer external artwork gesture when the old elevation pointer is retired',async()=>{
 await pointer(artwork(),'pointerdown',1400,1700);await pointer(svg(),'pointermove',1700,1800);await act(async()=>useEditor.getState().beginArtworkDrag(p.artworks[1].id,{alongMm:3100,centerHeightMm:1500}));const newer=useEditor.getState().artworkGesture;expect(newer?.id).toBe(p.artworks[1].id);await pointer(svg(),'pointerup',1700,1800);expect(useEditor.getState().artworkGesture).toBe(newer);await act(async()=>root.unmount());expect(useEditor.getState().artworkGesture).toBe(newer);useEditor.getState().finishArtworkDrag(true);
});
