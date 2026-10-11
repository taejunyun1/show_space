// @vitest-environment jsdom
import {act,StrictMode} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {createCanvas,Path2D} from '@napi-rs/canvas';
import {PlanView} from './PlanView';
import {Inspector} from './Inspector';
import {useEditor} from '../state/editor';
import {createDemoProject,parseProject} from '../domain/model';
import type {Point,Project,Wall} from '../domain/types';

let root:Root,container:HTMLDivElement;
const loop=(id:string,points:Point[]):Wall[]=>points.map((start,i)=>({...createDemoProject().walls[0],id:id+i,name:id+i,role:'boundary',start:{...start},end:{...points[(i+1)%points.length]}}));
const outer=[{x:100,z:100},{x:1100,z:100},{x:1100,z:1100},{x:100,z:1100}];
function project():Project{return {...createDemoProject(),walls:loop('outer',outer),artworks:[],scenes:[],lights:[],openings:[]};}
async function render(p=project()){
 useEditor.getState().loadProject(parseProject(p));useEditor.getState().setTool('select');useEditor.getState().setLinkedCorners(true);
 await act(async()=>root.render(<StrictMode><PlanView/><Inspector/></StrictMode>));
}
const floor=()=>container.querySelector<SVGPathElement>('path[aria-label="전시장 바닥"]');
function pixel(path:SVGPathElement,x:number,z:number){const c=createCanvas(120,120),ctx=c.getContext('2d');ctx.scale(.1,.1);ctx.fillStyle=path.getAttribute('fill')!;ctx.fill(new Path2D(path.getAttribute('d')!), 'evenodd');return ctx.getImageData(x,z,1,1).data;}
async function pointer(el:Element,type:string,x:number,y:number){await act(async()=>el.dispatchEvent(new MouseEvent(type,{bubbles:true,button:0,clientX:x,clientY:y})));}
beforeEach(()=>{
 (globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
 vi.stubGlobal('DOMPoint',class{constructor(public x:number,public y:number){}matrixTransform(){return {x:this.x,y:this.y};}});
 Object.defineProperty(SVGElement.prototype,'getScreenCTM',{configurable:true,value:()=>({a:1,inverse:()=>({a:1,b:0,c:0,d:1,e:0,f:0})})});
 Object.defineProperty(SVGElement.prototype,'setPointerCapture',{configurable:true,value:()=>{}});
 vi.spyOn(SVGElement.prototype,'getBoundingClientRect').mockReturnValue({width:800,height:600,x:0,y:0,top:0,left:0,right:800,bottom:600,toJSON:()=>({})});
 container=document.createElement('div');document.body.append(container);root=createRoot(container);
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});

it('renders the closed boundary in the floor color with real solid and outside pixels',async()=>{
 const p=project();p.floorColor='#804020';await render(p);const path=floor()!;expect(path).toBeTruthy();expect(path.getAttribute('fill-rule')).toBe('evenodd');expect(path.getAttribute('pointer-events')).toBe('none');expect([...pixel(path,20,20)]).toEqual([128,64,32,255]);expect(pixel(path,5,5)[3]).toBe(0);
});
it('keeps a courtyard transparent and ignores partitions and hidden boundary visibility',async()=>{
 const p=project();p.walls.push(...loop('court',[{x:400,z:400},{x:800,z:400},{x:800,z:800},{x:400,z:800}]));p.walls.push({...p.walls[0],id:'partition',role:'partition',start:{x:600,z:100},end:{x:600,z:400}});p.walls[0].visible=false;await render(p);const path=floor()!;expect(path).toBeTruthy();expect(pixel(path,20,20)[3]).toBe(255);expect(pixel(path,60,60)[3]).toBe(0);
});
it('does not invent a floor for unconnected or self-crossing boundaries',async()=>{
 const p=project();p.walls[0].end.x-=30;await render(p);expect(floor()).toBeNull();await render({...p,walls:loop('cross',[outer[0],outer[2],outer[1],outer[3]])});expect(floor()).toBeNull();
});
it('retains the floor when an existing boundary door closes a wall gap',async()=>{
 const p=project();p.walls[0].end={x:800,z:100};p.openings=[{id:'door',kind:'door',role:'boundary',start:{wallId:p.walls[0].id,endpoint:'end'},end:{wallId:p.walls[1].id,endpoint:'start'},note:''}];await render(p);expect(floor()).toBeTruthy();expect(pixel(floor()!,100,20)[3]).toBe(255);
});
it('previews the linked boundary move, cancels without edits, then commits once and undoes',async()=>{
 await render();const before=useEditor.getState().project,originalPath=floor()!.getAttribute('d'),svg=container.querySelector('svg')!,line=svg.querySelector('line.selectable')!;
 await pointer(line,'pointerdown',600,100);await pointer(svg,'pointermove',600,200);expect(useEditor.getState().project).toBe(before);expect(floor()!.getAttribute('d')).not.toBe(originalPath);await pointer(svg,'pointercancel',600,200);expect(floor()!.getAttribute('d')).toBe(originalPath);expect(useEditor.getState().past).toHaveLength(0);
 await pointer(line,'pointerdown',600,100);await pointer(svg,'pointermove',600,200);await pointer(svg,'pointerup',600,200);expect(useEditor.getState().past).toHaveLength(1);const movedPath=floor()!.getAttribute('d');expect(movedPath).not.toBe(originalPath);expect(useEditor.getState().project.walls[1].start.z).toBe(200);await act(async()=>useEditor.getState().undo());expect(floor()!.getAttribute('d')).toBe(originalPath);await act(async()=>useEditor.getState().redo());expect(floor()!.getAttribute('d')).toBe(movedPath);
});
it('preserves imported floor precedence while editing walls',async()=>{
 const p=project();p.importedFloor=[[{x:200,z:200},{x:900,z:200},{x:900,z:900},{x:200,z:900}]];await render(p);expect(floor()).toBeNull();const path=container.querySelector<SVGPathElement>('[aria-label="모델 바닥"]')!;expect(path).toBeTruthy();expect(pixel(path,15,15)[3]).toBe(0);expect(pixel(path,30,30)[3]).toBe(255);const original=path.getAttribute('d');await act(async()=>useEditor.getState().moveWallEndpoint(p.walls[0].id,'start',{x:300,z:100}));expect(path.getAttribute('d')).toBe(original);
});

async function selectWalls(indices:number[]){const svg=container.querySelector('svg')!;for(const [position,i] of indices.entries()){const w=useEditor.getState().project.walls[i];await act(async()=>svg.querySelectorAll('line.selectable')[i].dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,button:0,shiftKey:position>0,clientX:w.start.x,clientY:w.start.z})));await pointer(svg,'pointerup',w.start.x,w.start.z);}}
const bulk=(label:string)=>[...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.trim()===label)!;
it('assigns all four selected draft walls as boundaries once, retaining an unselected partition and undo/redo',async()=>{
 const p=project();p.walls=p.walls.map(w=>({...w,role:'partition'}));p.walls.push({...p.walls[0],id:'inner',name:'inner',start:{x:600,z:100},end:{x:600,z:800}});await render(p);expect(floor()).toBeNull();await selectWalls([0,1,2,3]);const assign=bulk('바닥 경계로 지정');expect(assign).toBeTruthy();expect(assign.disabled).toBe(false);await act(async()=>assign.click());expect(useEditor.getState().project.walls.map(w=>w.role)).toEqual(['boundary','boundary','boundary','boundary','partition']);expect(useEditor.getState().past).toHaveLength(1);expect(floor()).toBeTruthy();expect(parseProject(useEditor.getState().project)).toEqual(useEditor.getState().project);await act(async()=>useEditor.getState().undo());expect(floor()).toBeNull();await act(async()=>useEditor.getState().redo());expect(floor()).toBeTruthy();const demote=bulk('가벽으로 지정');expect(demote.disabled).toBe(false);await act(async()=>demote.click());expect(floor()).toBeNull();expect(useEditor.getState().past).toHaveLength(2);
});
it('rejects the entire bulk role change when a selected wall is locked',async()=>{
 const p=project();p.walls=p.walls.map(w=>({...w,role:'partition'}));p.walls[1].locked=true;await render(p);await selectWalls([0,1,2,3]);expect(bulk('바닥 경계로 지정')).toBeTruthy();expect(bulk('바닥 경계로 지정').disabled).toBe(true);const before=useEditor.getState().project;await act(async()=>useEditor.getState().setSelectedWallRole('boundary'));expect(useEditor.getState().project).toBe(before);expect(useEditor.getState().past).toHaveLength(0);expect(useEditor.getState().message).toContain('잠긴 벽');
});
it('does not record an unchanged role or apply a wall-only command to mixed selection',async()=>{
 const p=project();p.artworks=createDemoProject().artworks.slice(0,1).map(a=>({...a,wallId:p.walls[0].id,widthMm:100,heightMm:100,alongMm:500}));await render(p);await selectWalls([0,1]);expect(bulk('바닥 경계로 지정')).toBeTruthy();expect(bulk('바닥 경계로 지정').disabled).toBe(true);const before=useEditor.getState().project;await act(async()=>useEditor.getState().setSelectedWallRole('boundary'));expect(useEditor.getState().project).toBe(before);expect(useEditor.getState().past).toHaveLength(0);await act(async()=>useEditor.getState().select({type:'artwork',id:p.artworks[0].id},true));expect(bulk('가벽으로 지정')).toBeUndefined();await act(async()=>useEditor.getState().setSelectedWallRole('partition'));expect(useEditor.getState().project).toBe(before);expect(useEditor.getState().past).toHaveLength(0);expect(useEditor.getState().message).toContain('벽만');
});
