// @vitest-environment jsdom
import {act,StrictMode} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {Inspector} from './Inspector';
import {LengthUnitContext} from './LengthUnits';
import {useEditor} from '../state/editor';
import {projectorTestFixture} from '../lib/projectorTestFixture';
import {readProjectorImage} from '../lib/projectorImageImport';
import type {Project} from '../domain/types';
vi.mock('../lib/projectorImageImport',()=>({readProjectorImage:vi.fn()}));
let root:Root,container:HTMLDivElement,p:Project;
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
function deferred(){let resolve!:(value:Awaited<ReturnType<typeof readProjectorImage>>)=>void,reject!:(error:Error)=>void;const promise=new Promise<Awaited<ReturnType<typeof readProjectorImage>>>((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};}
const light=()=>useEditor.getState().project.lights![0];
async function click(label:string){const b=[...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.trim()===label||b.getAttribute('aria-label')===label)!;expect(b).toBeTruthy();expect(b.disabled).toBe(false);await act(async()=>b.click());}
async function number(label:string,value:string){const el=container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;expect(el).toBeTruthy();await act(async()=>{el.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));});await act(async()=>el.blur());}
async function upload(){const el=container.querySelector<HTMLInputElement>('input[aria-label="프로젝터 투사 이미지 파일"]')!;Object.defineProperty(el,'files',{configurable:true,value:[new File(['controlled-decoder'],'poster.png',{type:'image/png'})]});await act(async()=>el.dispatchEvent(new Event('change',{bubbles:true})));}
beforeEach(async()=>{vi.resetAllMocks();(globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;p=projectorTestFixture();p.id='projector-inspector-workflow';p.scenes=[];useEditor.getState().loadProject(p,true);useEditor.getState().select({type:'light',id:p.lights![0].id});container=document.createElement('div');document.body.append(container);root=createRoot(container);await act(async()=>root.render(<StrictMode><LengthUnitContext.Provider value="mm"><Inspector/></LengthUnitContext.Provider></StrictMode>));});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.restoreAllMocks();});

it('preserves the latest lens, aspect, brightness and light pose when an earlier image upload completes',async()=>{
 const job=deferred();vi.mocked(readProjectorImage).mockReturnValueOnce(job.promise);await upload();await number('렌즈 투사비','2');await number('가로·세로 비율','1');await number('프로젝터 밝기','2400');await number('조명 X','3500');await number('조준 Y','1200');const latest=structuredClone(light()),past=useEditor.getState().past.length;await act(async()=>job.resolve({imageUrl:image,optimized:false}));expect(light()).toEqual({...latest,projection:{...latest.projection!,imageUrl:image}});expect(useEditor.getState().past).toHaveLength(past+1);expect(container.querySelector('[role="alert"]')).toBeNull();expect(container.textContent).toContain('원본 이미지 파일을 보존');await act(async()=>useEditor.getState().undo());expect(light()).toEqual(latest);await act(async()=>useEditor.getState().redo());expect(light().projection!.imageUrl).toBe(image);
});

it.each(['scene','undo','redo'] as const)('retires the upload immediately on %s and keeps its late result out of a new upload',async kind=>{
 await act(async()=>{useEditor.getState().saveScene('original');useEditor.getState().patchLight(light().id,{projection:{...light().projection!,throwRatio:2}});if(kind==='redo')useEditor.getState().undo();});const old=deferred(),next=deferred();vi.mocked(readProjectorImage).mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);await upload();const signal=vi.mocked(readProjectorImage).mock.calls.at(-1)![1]!;
 await act(async()=>{if(kind==='scene')useEditor.getState().restoreScene(useEditor.getState().project.scenes[0].id);else useEditor.getState()[kind]();});expect(signal.aborted).toBe(true);expect(container.textContent).not.toContain('이미지 준비 중');await click('투사 이미지 불러오기');await upload();const current=useEditor.getState().project;await act(async()=>old.resolve({imageUrl:image,optimized:false}));expect(useEditor.getState().project).toBe(current);expect(container.textContent).toContain('이미지 준비 중');await act(async()=>next.resolve({imageUrl:image,optimized:false}));expect(light().projection!.imageUrl).toBe(image);expect(container.querySelector('[role="alert"]')).toBeNull();
});

it.each(['selection','project','lock','delete'] as const)('discards delayed failures after a batched %s roundtrip',async kind=>{
 const old=deferred();vi.mocked(readProjectorImage).mockReturnValueOnce(old.promise);await upload();const id=light().id;await act(async()=>{const s=useEditor.getState();if(kind==='selection'){s.select({type:'wall',id:p.walls[0].id});s.select({type:'light',id});}else if(kind==='project'){s.loadProject({...p,id:'other'});s.loadProject(p);s.select({type:'light',id});}else if(kind==='lock'){s.patchLight(id,{locked:true});s.patchLight(id,{locked:false});}else{s.deleteSelected();s.undo();s.select({type:'light',id});}});const current=useEditor.getState().project;await act(async()=>old.reject(new Error('OLD PROJECTOR ERROR')));expect(useEditor.getState().project).toBe(current);expect(container.textContent).not.toContain('OLD PROJECTOR ERROR');expect(container.textContent).not.toContain('이미지 준비 중');expect(container.querySelector('[role="alert"]')).toBeNull();
});

it('keeps a current decode failure visible and permits a successful retry',async()=>{
 const first=deferred();vi.mocked(readProjectorImage).mockReturnValueOnce(first.promise).mockResolvedValueOnce({imageUrl:image,optimized:true});await upload();const before=useEditor.getState().project;await act(async()=>first.reject(new Error('이미지를 읽지 못했습니다.')));expect(useEditor.getState().project).toBe(before);expect(container.querySelector('[role="alert"]')?.textContent).toBe('이미지를 읽지 못했습니다.');await upload();expect(light().projection!.imageUrl).toBe(image);expect(container.textContent).toContain('저장 용량을 줄였습니다');expect(container.querySelector('[role="alert"]')).toBeNull();
});

it.each(['resolve','reject'] as const)('does not overwrite a replaced source or show its late %s error',async outcome=>{
 const old=deferred();vi.mocked(readProjectorImage).mockReturnValueOnce(old.promise);await upload();await act(async()=>useEditor.getState().patchLight(light().id,{projection:{...light().projection!,imageUrl:image}}));const current=useEditor.getState().project;await act(async()=>{if(outcome==='resolve')old.resolve({imageUrl:p.lights![0].projection!.imageUrl,optimized:false});else old.reject(new Error('OLD SOURCE ERROR'));});expect(useEditor.getState().project).toBe(current);expect(container.textContent).not.toContain('OLD SOURCE ERROR');expect(container.textContent).not.toContain('이미지 준비 중');expect(container.querySelector('[role="alert"]')).toBeNull();
});
