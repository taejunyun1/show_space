// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {Outliner} from './Outliner';
import {ElevationView} from './ElevationView';
import {LengthUnitContext} from './LengthUnits';
import {useEditor} from '../state/editor';
import {createDemoProject} from '../domain/model';
import {readImage} from '../lib/art';
import {readVideoArtworkFile} from '../lib/videoArtworkImport';
import {readModelArtworkFiles} from '../lib/modelArtworkImport';
import {testArtworkModel} from '../lib/modelArtworkTestFixture';
import {testVideoArtwork} from '../lib/videoArtworkTestFixture';
import type {Project} from '../domain/types';

vi.mock('../lib/art',async original=>({...await original<typeof import('../lib/art')>(),readImage:vi.fn()}));
vi.mock('../lib/videoArtworkImport',()=>({readVideoArtworkFile:vi.fn()}));
vi.mock('../lib/modelArtworkImport',()=>({readModelArtworkFiles:vi.fn()}));
// Do not open unrelated library/environment dialogs or load a GPU preview.
vi.mock('./ArtworkLibraryDialog',()=>({ArtworkLibraryDialog:()=>null}));
vi.mock('./FloorMaterialDialog',()=>({FloorMaterialDialog:()=>null}));
vi.mock('./LightingDialog',()=>({LightingDialog:()=>null}));
vi.mock('./OutdoorDialog',()=>({OutdoorDialog:()=>null}));
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=';
let root:Root,container:HTMLDivElement,p:Project;
type Pending={resolve:(value:string)=>void;reject:(error:Error)=>void};
let pending:Pending[];
function fixture(){const p=createDemoProject();p.scenes=[];p.displayUnit='cm';p.walls[0].end={x:p.walls[0].start.x+12000,z:p.walls[0].start.z};p.walls[0].heightMm=4500;p.artworks=p.artworks.slice(0,3).map((a,i)=>({...a,id:`workflow-${i}`,name:`작품 ${i+1}`,imageUrl:png,frame:'none',widthMm:400,heightMm:600}));const {wallId:_,...a}=p.artworks.pop()!;p.unplacedArtworks=[a];return p;}
async function click(label:string){const button=[...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===label||b.getAttribute('aria-label')===label)!;expect(button).toBeDefined();await act(async()=>button.click());}
async function change(element:HTMLInputElement|HTMLSelectElement,value:string){await act(async()=>{Object.getOwnPropertyDescriptor(element instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value')!.set!.call(element,value);element.dispatchEvent(new Event(element instanceof HTMLSelectElement?'change':'input',{bubbles:true}));});}
async function number(label:string,value:string){const element=container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;await act(async()=>element.focus());await change(element,value);await act(async()=>element.blur());}
async function upload(){const input=container.querySelector<HTMLInputElement>('.add-art-card input[accept="image/png,image/jpeg,image/webp"]')!;Object.defineProperty(input,'files',{value:[new File(['fixture'],'촬영 작품.jpg',{type:'image/jpeg'})],configurable:true});await act(async()=>input.dispatchEvent(new Event('change',{bubbles:true})));}
beforeEach(async()=>{
 (globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.open=true;}});
 pending=[];vi.mocked(readImage).mockImplementation(()=>new Promise((resolve,reject)=>pending.push({resolve,reject})));
 p=fixture();useEditor.getState().loadProject(p);container=document.createElement('div');document.body.append(container);root=createRoot(container);
 await act(async()=>root.render(<LengthUnitContext.Provider value="cm"><Outliner/><ElevationView/></LengthUnitContext.Provider>));
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.clearAllMocks();});

it('imports on the initially selected wall even if another wall is selected while decoding',async()=>{
 await act(async()=>useEditor.getState().setActiveWall(p.walls[1].id));await upload();await act(async()=>useEditor.getState().setActiveWall(p.walls[2].id));await act(async()=>pending[0].resolve(png));
 const added=useEditor.getState().project.artworks.at(-1)!;expect(added.name).toBe('촬영 작품');expect(added.wallId).toBe(p.walls[1].id);expect(useEditor.getState().activeWallId).toBe(p.walls[1].id);expect(useEditor.getState().past).toHaveLength(1);
});

it('drops an old import on project change and lets the new project start its own import',async()=>{
 await upload();const next={...fixture(),id:'another-project',name:'다른 전시'};await act(async()=>useEditor.getState().loadProject(next));expect([...container.querySelectorAll('button')].find(b=>b.textContent==='작품 추가')!.disabled).toBe(false);
 await upload();await act(async()=>pending[0].resolve(png));expect(useEditor.getState().project.artworks).toEqual(next.artworks);expect([...container.querySelectorAll('button')].find(b=>b.textContent==='이미지 처리 중')!.disabled).toBe(true);
 await act(async()=>pending[1].resolve(png));expect(useEditor.getState().project.artworks).toHaveLength(next.artworks.length+1);expect(useEditor.getState().past).toHaveLength(1);
});

it('drops a late import after leaving and reopening the same project',async()=>{
 await upload();await act(async()=>useEditor.getState().loadProject({...fixture(),id:'temporary-project'}));await act(async()=>useEditor.getState().loadProject(p));const before=useEditor.getState().project;await act(async()=>pending[0].resolve(png));expect(useEditor.getState().project).toBe(before);expect(useEditor.getState().past).toHaveLength(0);
});

it('does not mutate a project when its outliner unmounts during decoding',async()=>{
 await upload();const before=useEditor.getState().project;await act(async()=>root.unmount());await act(async()=>pending[0].resolve(png));expect(useEditor.getState().project).toBe(before);expect(useEditor.getState().past).toHaveLength(0);
});

it('applies ordered count, cm spacing and back-face placement from the real dialog, then undoes in one step',async()=>{
 const before=structuredClone(useEditor.getState().project);await act(async()=>useEditor.setState({selected:[]}));await click('시리즈 자동 배열');expect(container.querySelector('dialog[open]')).not.toBeNull();await click('3번 작품 앞으로');
 await number('배열할 작품 수','2');await number('시리즈 작품 간격','35');await change(container.querySelector<HTMLSelectElement>('select[aria-label="시리즈 설치 면"]')!,'back');await click('2점 배열 적용');
 const state=useEditor.getState(),ids=['workflow-0','workflow-2'];expect(state.selected.map(s=>s.id)).toEqual(ids);expect(state.past).toHaveLength(1);expect(state.view).toBe('elevation');expect(container.querySelector('dialog')).toBeNull();expect([...container.querySelectorAll('button')].find(b=>b.textContent==='B면 보기')!.getAttribute('aria-pressed')).toBe('true');
 const [a,b]=ids.map(id=>state.project.artworks.find(a=>a.id===id)!);expect(a.wallSide).toBe('back');expect(a.alongMm-b.alongMm).toBe(750);expect(a.groupId).toBeTruthy();expect(a.groupId).toBe(b.groupId);expect(state.project.unplacedArtworks).toEqual([]);expect(state.project.artworks.find(a=>a.id==='workflow-1')).toEqual(before.artworks[1]);
 const installed=structuredClone(state.project);await act(async()=>useEditor.getState().undo());expect(useEditor.getState().project).toEqual(before);await act(async()=>useEditor.getState().redo());expect(useEditor.getState().project).toEqual(installed);
});

it('keeps invalid array conditions and cancellation from changing the project or history',async()=>{
 const before=useEditor.getState().project;await act(async()=>useEditor.setState({selected:[]}));await click('시리즈 자동 배열');await number('시리즈 작품 간격','5000');expect(container.querySelector('dialog [role="alert"]')?.textContent).toContain('벽 범위');expect([...container.querySelectorAll('button')].find(b=>b.textContent==='3점 배열 적용')!.disabled).toBe(true);await click('취소');expect(useEditor.getState().project).toBe(before);expect(useEditor.getState().past).toHaveLength(0);
});

it('does not fall back to another wall when the original upload wall is deleted',async()=>{
 await act(async()=>useEditor.getState().setActiveWall(p.walls[1].id));await upload();await act(async()=>{useEditor.getState().select({type:'wall',id:p.walls[1].id});useEditor.getState().deleteSelected();});const before=useEditor.getState().project,past=useEditor.getState().past;await act(async()=>pending[0].resolve(png));expect(useEditor.getState().project).toBe(before);expect(useEditor.getState().past).toBe(past);expect(useEditor.getState().message).toContain('설치 벽');
});

it('ignores errors from an abandoned import and prevents duplicate concurrent imports',async()=>{
 await upload();await upload();expect(readImage).toHaveBeenCalledTimes(1);await act(async()=>useEditor.getState().loadProject({...fixture(),id:'new-project'}));await act(async()=>useEditor.getState().notify('새 프로젝트 작업'));await act(async()=>pending[0].reject(new Error('이전 파일 오류')));expect(useEditor.getState().message).toBe('새 프로젝트 작업');expect(useEditor.getState().past).toHaveLength(0);await upload();expect(readImage).toHaveBeenCalledTimes(2);await act(async()=>pending[1].reject(new Error('현재 파일 오류')));expect(useEditor.getState().message).toBe('현재 파일 오류');expect([...container.querySelectorAll('button')].find(b=>b.textContent==='작품 추가')!.disabled).toBe(false);
});

it('invalidates an import even when project A→B→A changes are batched into one React render',async()=>{
 await upload();await act(async()=>{useEditor.getState().loadProject({...fixture(),id:'batched-project'});useEditor.getState().loadProject(p);});const before=useEditor.getState().project;await act(async()=>pending[0].resolve(png));expect(useEditor.getState().project).toBe(before);expect(useEditor.getState().past).toHaveLength(0);
});

it.each(['video','model'] as const)('drops a late %s result without changing the new project, view or notification',async kind=>{
 let finish!:()=>void;
 if(kind==='video')vi.mocked(readVideoArtworkFile).mockImplementationOnce(()=>new Promise(resolve=>{finish=()=>resolve({kind:'image',artwork:{name:'영상 작품',artist:'',widthMm:1200,heightMm:675,depthMm:30,frame:'none',imageUrl:png,video:testVideoArtwork()}});}));
 else vi.mocked(readModelArtworkFiles).mockImplementationOnce(()=>new Promise(resolve=>{finish=()=>resolve(testArtworkModel());}));
 const input=container.querySelector<HTMLInputElement>(`input[aria-label="${kind==='video'?'영상 작품 파일':'3D 작품 파일'}"]`)!;Object.defineProperty(input,'files',{value:[new File(['fixture'],kind==='video'?'전시.mp4':'전시.glb')],configurable:true});await act(async()=>input.dispatchEvent(new Event('change',{bubbles:true})));
 const next={...fixture(),id:'new-media-project'};await act(async()=>{useEditor.getState().loadProject(next);useEditor.getState().setView('plan');useEditor.getState().notify('새 작업 진행');});const before=useEditor.getState().project;await act(async()=>finish());expect(useEditor.getState().project).toBe(before);expect(useEditor.getState().view).toBe('plan');expect(useEditor.getState().message).toBe('새 작업 진행');expect(useEditor.getState().past).toHaveLength(0);expect([...container.querySelectorAll('button')].find(b=>b.textContent==='작품 추가')!.disabled).toBe(false);
});
