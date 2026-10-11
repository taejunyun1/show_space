// @vitest-environment jsdom
import {act,StrictMode} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import SharedViewer from './SharedViewer';
import {createDemoProject} from '../domain/model';
import {createPublicShare,type PublicShareSnapshot} from '../domain/publicShare';
import {useEditor} from '../state/editor';
vi.mock('./SharedViewer3D',()=>({default:({snapshot}:{snapshot:PublicShareSnapshot})=><div aria-label="공개 GPU transport adapter">{snapshot.name}</div>}));
const A='a'.repeat(48),B='b'.repeat(48);
type Pending={url:string;signal:AbortSignal;resolve:(value:Response)=>void};
let root:Root,container:HTMLDivElement,requests:Pending[];
function snapshot(name:string):PublicShareSnapshot{const p=createDemoProject();p.name=name;p.artworks=[];p.scenes=[];return createPublicShare(p,{includeDimensions:true}).snapshot;}
async function render(id:string|null){await act(async()=>root.render(<StrictMode><SharedViewer shareId={id}/></StrictMode>));}
async function reply(request:Pending,data:unknown,status=200){await act(async()=>request.resolve(Response.json(data,{status})));}
async function visible(){await act(async()=>document.dispatchEvent(new Event('visibilitychange')));}
async function click(label:string){const b=[...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===label)!;expect(b).toBeTruthy();await act(async()=>b.click());}
beforeEach(()=>{(globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;requests=[];vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');vi.stubGlobal('fetch',vi.fn((url:string,init:RequestInit)=>new Promise<Response>(resolve=>requests.push({url,signal:init.signal as AbortSignal,resolve}))));container=document.createElement('div');document.body.append(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});

it('ignores an aborted StrictMode fetch that resolves after the active publication',async()=>{
 await render(A);expect(requests).toHaveLength(2);expect(requests[0].signal.aborted).toBe(true);await reply(requests[1],snapshot('유효한 전시'));await reply(requests[0],snapshot('폐기한 응답'));expect(container.querySelector('.shared-header')?.textContent).toContain('유효한 전시');expect(container.textContent).not.toContain('폐기한 응답');expect(document.title).toBe('유효한 전시 — 공간 공유');
});
it('clears the old publication immediately and rejects a late A fetch after opening B',async()=>{
 await render(A);await reply(requests[1],snapshot('A 전시'));await render(B);expect(container.textContent).not.toContain('A 전시');expect(container.querySelector('[role="status"]')).toBeTruthy();await reply(requests.at(-1)!,snapshot('B 전시'));await reply(requests[0],snapshot('오래된 A 전시'));expect(container.querySelector('.shared-header')?.textContent).toContain('B 전시');expect(container.textContent).not.toContain('오래된 A 전시');
});
it('loads a valid new link after an earlier missing link',async()=>{
 await render(A);await reply(requests[1],{error:'없는 전시'},404);expect(container.querySelector('[role="alert"]')?.textContent).toContain('없는 전시');await render(B);await reply(requests.at(-1)!,snapshot('B 전시'));expect(container.querySelector('[role="alert"]')).toBeNull();expect(container.querySelector('.shared-header')?.textContent).toContain('B 전시');
});
it('retires a delayed revocation check when the viewer has switched links',async()=>{
 await render(A);await reply(requests[1],snapshot('A 전시'));await visible();const oldCheck=requests[2];await render(B);await reply(requests.at(-1)!,snapshot('B 전시'));await reply(oldCheck,{error:'A 중단됨'},410);expect(container.querySelector('[role="alert"]')).toBeNull();expect(container.querySelector('.shared-header')?.textContent).toContain('B 전시');
});
it('removes a revoked publication and does not let an old startup response resurrect it',async()=>{
 await render(A);await reply(requests[1],snapshot('A 전시'));await visible();await reply(requests[2],{error:'공유 중단됨'},410);expect(container.querySelector('.shared-viewer')).toBeNull();await reply(requests[0],snapshot('부활한 전시'));expect(container.querySelector('.shared-viewer')).toBeNull();expect(container.querySelector('[role="alert"]')?.textContent).toContain('공유 중단됨');expect(document.title).not.toContain('부활한 전시');
});
it('does not change the title or publication after unmount',async()=>{
 await render(A);const title=document.title;await act(async()=>root.unmount());await reply(requests[1],snapshot('닫은 뒤 응답'));expect(document.title).toBe(title);expect(container.textContent).toBe('');
});
it('keeps a loaded frozen view through a transient verification failure',async()=>{
 await render(A);await reply(requests[1],snapshot('유지할 전시'));await visible();await reply(requests[2],{error:'일시적인 서버 오류'},503);expect(container.querySelector('[role="alert"]')).toBeNull();expect(container.querySelector('.shared-header')?.textContent).toContain('유지할 전시');
});
it('shows an invalid address instead of keeping a previous loaded scene',async()=>{
 await render(A);await reply(requests[1],snapshot('A 전시'));await render(null);expect(container.querySelector('.shared-viewer')).toBeNull();expect(container.querySelector('[role="alert"]')?.textContent).toContain('공유 링크 주소');
});
it('shows locked information and allows temporary measuring without changing editor data',async()=>{
 const p=createDemoProject();useEditor.getState().loadProject(p);const before=useEditor.getState().project;await render(A);await reply(requests[1],createPublicShare(p,{includeDimensions:true}).snapshot);await click('벽면');await click(p.artworks[0].name);expect(container.querySelector('.shared-info')?.textContent).toContain(p.artworks[0].name);expect(container.querySelector('input[type="number"],textarea,[contenteditable="true"],.drag-handle')).toBeNull();const drawing=container.querySelector('.shared-stage svg')!;for(const type of ['pointerdown','pointermove','pointerup'])await act(async()=>drawing.dispatchEvent(new MouseEvent(type,{bubbles:true,button:0,clientX:1500,clientY:1600})));await act(async()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true})));expect(useEditor.getState().project).toBe(before);await click('임시 줄자');expect(container.querySelector('.shared-measure-button')?.getAttribute('aria-pressed')).toBe('true');expect(useEditor.getState().project).toBe(before);
});
