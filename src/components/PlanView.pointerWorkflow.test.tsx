// @vitest-environment jsdom
import {act,StrictMode} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {PlanView} from './PlanView';
import {useEditor} from '../state/editor';
import {createDemoProject} from '../domain/model';
import {newLight} from '../domain/lighting';
import {addModelArtwork} from '../domain/modelArtworks';
import {testArtworkModel} from '../lib/modelArtworkTestFixture';
import type {Project} from '../domain/types';

let root:Root,container:HTMLDivElement,p:Project;
const release=vi.fn();
const svg=()=>container.querySelector<SVGSVGElement>('.plan-svg')!;
const line=()=>svg().querySelector<SVGLineElement>('line.selectable')!;
const endpoint=()=>svg().querySelector<SVGCircleElement>('circle.drag-handle:not([aria-label])')!;
const floor=()=>svg().querySelector<SVGPathElement>('[aria-label="전시장 바닥"]')!;
async function pointer(el:Element,type:string,x:number,y:number,extra:{pointerId?:number;button?:number}={}){const event=new MouseEvent(type,{bubbles:true,button:extra.button??0,clientX:x,clientY:y,altKey:true});Object.defineProperty(event,'pointerId',{value:extra.pointerId??7});await act(async()=>el.dispatchEvent(event));}
async function start(kind:'wall'|'endpoint'='wall'){await pointer(kind==='wall'?line():endpoint(),'pointerdown',kind==='wall'?2000:0,0);await pointer(svg(),'pointermove',kind==='wall'?2200:400,400);}
beforeEach(async()=>{
 (globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
 vi.stubGlobal('DOMPoint',class{constructor(public x:number,public y:number){}matrixTransform(){return {x:this.x,y:this.y};}});Object.defineProperty(SVGElement.prototype,'getScreenCTM',{configurable:true,value:()=>({a:1,inverse:()=>({a:1,b:0,c:0,d:1,e:0,f:0})})});Object.defineProperty(SVGElement.prototype,'setPointerCapture',{configurable:true,value:()=>{}});Object.defineProperty(SVGElement.prototype,'releasePointerCapture',{configurable:true,value:release});vi.spyOn(SVGElement.prototype,'getBoundingClientRect').mockReturnValue({width:1200,height:800,x:0,y:0,top:0,left:0,right:1200,bottom:800,toJSON:()=>({})});
 const template=createDemoProject(),points=[{x:0,z:0},{x:4000,z:0},{x:4000,z:3000},{x:0,z:3000}];p={...template,id:'plan-pointer-workflow',walls:points.map((start,i)=>({...template.walls[0],id:'wall-'+i,name:'벽 '+i,start,end:points[(i+1)%4],role:'boundary'})),artworks:[{...template.artworks[0],wallId:'wall-0',frame:'none',widthMm:400,heightMm:600,alongMm:1400,centerHeightMm:1500}],scenes:[],openings:[],lights:[]};p.lights=[newLight(p,'spot')];p=addModelArtwork(p,testArtworkModel()).project;useEditor.getState().loadProject(p,true);useEditor.getState().setView('plan');useEditor.getState().setTool('select');useEditor.getState().setLinkedCorners(true);useEditor.getState().select({type:'wall',id:'wall-0'});p=useEditor.getState().project;release.mockClear();container=document.createElement('div');document.body.append(container);root=createRoot(container);await act(async()=>root.render(<StrictMode><PlanView/></StrictMode>));
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('uses the final wall release, carries attached artwork and linked corners, and undoes once',async()=>{
 await start();await pointer(svg(),'pointerup',2500,700);expect(useEditor.getState().project.walls[0]).toMatchObject({start:{x:500,z:700},end:{x:4500,z:700}});expect(useEditor.getState().project.walls[1].start).toEqual({x:4500,z:700});expect(useEditor.getState().project.artworks[0]).toEqual(p.artworks[0]);expect(useEditor.getState().past).toHaveLength(1);expect(release).toHaveBeenCalledWith(7);await act(async()=>useEditor.getState().undo());expect(useEditor.getState().project).toEqual(p);
});
it('previews a linked endpoint and floor globally, blocks Scene, then commits the release once',async()=>{
 const original=floor().getAttribute('d');await start('endpoint');expect(useEditor.getState().project).toBe(p);expect(useEditor.getState().wallGesture).not.toBeNull();expect(useEditor.getState().previewProject?.walls[3].end).toEqual({x:400,z:400});expect(floor().getAttribute('d')).not.toBe(original);expect(useEditor.getState().saveScene('아직 이동 중')).toBe(false);await pointer(svg(),'pointerup',800,600);expect(useEditor.getState().project.walls[0].start).toEqual({x:800,z:600});expect(useEditor.getState().project.walls[3].end).toEqual({x:800,z:600});expect(useEditor.getState().past).toHaveLength(1);expect(useEditor.getState().saveScene('끝점 편집 후')).toBe(true);
});
it.each(['wall','endpoint'] as const)('ignores another pointer during %s editing',async kind=>{
 await start(kind);const preview=useEditor.getState().previewProject,d=line().getAttribute('x1');await pointer(svg(),'pointermove',3500,1700,{pointerId:99});await pointer(svg(),'lostpointercapture',3500,1700,{pointerId:99});await pointer(svg(),'pointerup',3500,1700,{pointerId:99});expect(useEditor.getState().previewProject).toBe(preview);expect(line().getAttribute('x1')).toBe(d);expect(useEditor.getState().past).toHaveLength(0);await pointer(svg(),'pointerup',kind==='wall'?2500:800,600);expect(useEditor.getState().past).toHaveLength(1);
});
it.each(['project','selection','view','tool','edit','wall'] as const)('retires a wall pointer across a batched %s change',async kind=>{
 await start();await act(async()=>{const s=useEditor.getState();if(kind==='project'){s.loadProject({...p,id:'other'});s.loadProject(p);}else if(kind==='selection'){s.select({type:'wall',id:'wall-1'});s.select({type:'wall',id:'wall-0'});}else if(kind==='view'){s.setView('3d');s.setView('plan');}else if(kind==='tool'){s.setTool('pan');s.setTool('select');}else if(kind==='edit'){s.patchWall('wall-1',{heightMm:3200});}else{s.setActiveWall('wall-1');s.setActiveWall('wall-0');}});const before=useEditor.getState().project,count=useEditor.getState().past.length;await pointer(svg(),'pointerup',2500,700);expect(useEditor.getState().project).toBe(before);expect(useEditor.getState().past).toHaveLength(count);expect(useEditor.getState().wallGesture).toBeNull();
});
it.each(['escape','unmount','lostpointercapture'] as const)('cancels endpoint preview on %s without a late commit',async kind=>{
 await start('endpoint');if(kind==='escape')await act(async()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})));else if(kind==='unmount')await act(async()=>root.unmount());else await pointer(svg(),'lostpointercapture',600,700);expect(useEditor.getState().previewProject).toBeNull();expect(useEditor.getState().wallGesture).toBeNull();expect(useEditor.getState().project).toBe(p);expect(release).toHaveBeenCalledWith(7);if(kind!=='unmount')await pointer(svg(),'pointerup',800,600);expect(useEditor.getState().past).toHaveLength(0);
});
it('does not end a newer external transform of the same wall',async()=>{
 await start();await act(async()=>useEditor.getState().beginWallTransform('wall-0','move',{x:100,z:100}));const newer=useEditor.getState().wallGesture;await pointer(svg(),'pointerup',2500,700);expect(useEditor.getState().wallGesture).toBe(newer);await act(async()=>root.unmount());expect(useEditor.getState().wallGesture).toBe(newer);useEditor.getState().finishWallTransform(true);
});
it.each(['wall','light','model'] as const)('does not finish an unowned %s gesture on a canvas release',async kind=>{
 await act(async()=>{const s=useEditor.getState();if(kind==='wall')s.beginWallTransform('wall-0','move',{x:0,z:0});else if(kind==='light')s.beginLightMove(p.lights![0].id);else s.beginModelArtworkTransform(p.modelArtworks![0].id);});const before=useEditor.getState(),key=kind==='wall'?'wallGesture':kind==='light'?'lightGesture':'modelArtworkGesture';await pointer(svg(),'pointerup',2500,700);expect(useEditor.getState()[key]).toBe(before[key]);
});
it.each(['light','model'] as const)('uses the release position for a %s owned by the plan',async kind=>{
 const item=kind==='light'?p.lights![0]:p.modelArtworks![0],pos=kind==='light'?p.lights![0].position:p.modelArtworks![0].position,el=kind==='light'?svg().querySelector(`[aria-label="${item.name} 위치"]`)!:svg().querySelector(`[aria-label="${item.name} 3D 작품 평면"]`)!.parentElement!;await pointer(el,'pointerdown',pos.x,pos.z);await pointer(svg(),'pointermove',pos.x+100,pos.z+100);await pointer(svg(),'pointerup',pos.x+400,pos.z+300);const result=kind==='light'?useEditor.getState().project.lights![0].position:useEditor.getState().project.modelArtworks![0].position;expect(result.x).toBeCloseTo(pos.x+400);expect(result.z).toBeCloseTo(pos.z+300);expect(result.y).toBe(pos.y);expect(useEditor.getState().past).toHaveLength(1);
});
it('keeps right-click from starting an endpoint edit',async()=>{
 await pointer(endpoint(),'pointerdown',0,0,{button:2});await pointer(svg(),'pointermove',800,600);await pointer(svg(),'pointerup',800,600,{button:2});expect(useEditor.getState().project).toBe(p);expect(line().getAttribute('x1')).toBe('0');expect(useEditor.getState().past).toHaveLength(0);
});
it('uses the owning final pan coordinate without changing the project',async()=>{
 await act(async()=>useEditor.getState().setTool('pan'));const box=svg().getAttribute('viewBox')!.split(' ').map(Number);await pointer(svg(),'pointerdown',100,100);await pointer(svg(),'pointermove',220,180);await pointer(svg(),'pointerup',300,250);expect(svg().getAttribute('viewBox')!.split(' ').map(Number)).toEqual([box[0]-200,box[1]-150,box[2],box[3]]);expect(useEditor.getState().project).toBe(p);expect(useEditor.getState().past).toHaveLength(0);
});
