// @vitest-environment jsdom
import {act,StrictMode} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {ReviewCommentsPanel} from './ReviewCommentsPanel';
import {cloudSession,useAuth} from '../state/auth';
import {createDemoProject} from '../domain/model';
import {createPublicShare} from '../domain/publicShare';
import type {ReviewPage,ReviewThread} from '../domain/reviewComments';

vi.mock('../state/auth',async importOriginal=>({...await importOriginal<typeof import('../state/auth')>(),initializeAuth:vi.fn(async()=>{}),cloudSession:vi.fn()}));
vi.mock('./AccountDialog',()=>({AccountDialog:()=>null}));
const shareId='a'.repeat(48),publication=createPublicShare(createDemoProject(),{includeDimensions:false}).snapshot;
type Request={url:string;init:RequestInit;resolve:(response:Response)=>void};
let requests:Request[],container:HTMLDivElement,root:Root;
const user=(id:string)=>({id,email:id+'@example.test'});
const thread=(text:string,id=crypto.randomUUID()):ReviewThread=>({id,revision:1,anchor:{kind:'project',sceneId:null,label:'전시 전체',sceneName:'현재 배치'},resolved:false,createdAt:'2026-10-07T00:00:00Z',updatedAt:'2026-10-07T00:00:00Z',canManage:true,posts:[{id:crypto.randomUUID(),name:'참여자',text,createdAt:'2026-10-07T00:00:00Z',mine:true}]});
const page=(text:string,canComment=true):ReviewPage=>({enabled:true,owner:canComment,canComment,nextCursor:null,items:[thread(text)]});
async function settle(request:Request,body:unknown,status=200){await act(async()=>{request.resolve(new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}}));});}
async function account(id:string|null){await act(async()=>{useAuth.setState({status:id?'signedIn':'signedOut',user:id?user(id):null});});}
async function mount(props:Partial<Parameters<typeof ReviewCommentsPanel>[0]>={}){await act(async()=>{root.render(<StrictMode><ReviewCommentsPanel shareId={shareId} publication={publication} {...props}/></StrictMode>);});}
async function input(element:HTMLInputElement|HTMLTextAreaElement,value:string){await act(async()=>{Object.getOwnPropertyDescriptor(element instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value')!.set!.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}));});}
async function click(label:string){const button=[...container.querySelectorAll('button')].find(b=>b.textContent===label)!;expect(button).toBeDefined();await act(async()=>button.click());}
async function submit(){await act(async()=>{container.querySelector('form.review-compose')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});}
const compose=()=>container.querySelector<HTMLTextAreaElement>('form.review-compose textarea');
beforeEach(()=>{
 (globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
 requests=[];container=document.createElement('div');document.body.append(container);root=createRoot(container);
 useAuth.setState({status:'signedOut',user:null,config:null,error:''});
 vi.mocked(cloudSession).mockImplementation(async()=>{const id=useAuth.getState().user!.id;return {userId:id,token:'token-'+id};});
 // Intentionally accept a response after abort: the component must also reject stale results.
 vi.stubGlobal('fetch',vi.fn((url:string,init:RequestInit)=>new Promise<Response>(resolve=>requests.push({url,init,resolve}))));
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();vi.clearAllMocks();});

it('refreshes anonymous permissions on login and removes drafts, replies and controls on logout',async()=>{
 await mount();expect(requests).toHaveLength(2);const cancelled=requests.shift()!;expect(cancelled.init.signal?.aborted).toBe(true);await settle(cancelled,page('StrictMode 취소 응답'));expect(compose()).toBeNull();await settle(requests[0],page('익명 열람',false));expect(compose()).toBeNull();
 await account('A');expect(requests[0].init.signal?.aborted).toBe(true);expect(requests).toHaveLength(2);expect(container.textContent).not.toContain('익명 열람');
 await settle(requests[1],page('A 의견'));await input(compose()!,'A 비공개 초안');await input(container.querySelector<HTMLInputElement>('form.review-compose input')!,'A 표시 이름');await input(container.querySelector<HTMLTextAreaElement>('.review-reply textarea')!,'A 답글 초안');
 await account(null);expect(compose()).toBeNull();expect(container.textContent).not.toContain('A 의견');expect(container.querySelector('.review-reply')).toBeNull();
 await settle(requests[2],page('읽기 전용',false));expect(container.textContent).toContain('읽기 전용');expect(container.textContent).not.toContain('댓글 삭제');
 await account('B');await settle(requests[3],page('B 의견'));expect(compose()!.value).toBe('');expect(container.querySelector<HTMLInputElement>('form.review-compose input')!.value).toBe('참여자');expect(container.querySelector<HTMLTextAreaElement>('.review-reply textarea')!.value).toBe('');
});

it('ignores a late A list response after switching to B, including A permissions',async()=>{
 await account('A');await mount();const old=requests[0];await account('B');expect(old.init.signal?.aborted).toBe(true);expect(requests).toHaveLength(2);
 expect(requests[1].init.headers).toEqual({authorization:'Bearer token-B'});
 await settle(requests[1],page('B 열람 의견',false));await settle(old,page('A 계정 의견'));expect(container.textContent).toContain('B 열람 의견');expect(container.textContent).not.toContain('A 계정 의견');expect(compose()).toBeNull();
});

it('aborts A create and rejects its late success without replacing B comments or draft',async()=>{
 await account('A');await mount();await settle(requests[0],page('A 의견'));await input(compose()!,'A 제출');await submit();const write=requests[1];expect(write.init.method).toBe('POST');
 await account('B');expect(write.init.signal?.aborted).toBe(true);await settle(requests[2],page('B 의견'));await input(compose()!,'B 작성 중');
 const draft=JSON.parse(write.init.body as string);await settle(write,{...page('늦은 A 저장'),items:[thread('늦은 A 저장',draft.id)]});
 expect(container.textContent).toContain('B 의견');expect(container.textContent).not.toContain('늦은 A 저장');expect(compose()!.value).toBe('B 작성 중');expect(container.querySelector('[role="alert"]')).toBeNull();
});

it('aborts pending moderation and clears an open edit when the actor changes',async()=>{
 await account('A');await mount();const previous=page('수정할 A 의견');await settle(requests[0],previous);await click('수정');expect(container.querySelector('.review-post form')).not.toBeNull();await click('처리 완료');const mutation=requests[1];expect(mutation.init.method).toBe('PATCH');
 await account('B');expect(mutation.init.signal?.aborted).toBe(true);expect(container.querySelector('.review-post form')).toBeNull();await settle(requests[2],page('B 의견'));await settle(mutation,{...previous,items:previous.items.map(t=>({...t,resolved:true}))});expect(container.textContent).not.toContain('수정할 A 의견');expect(container.textContent).toContain('B 의견');
});

it('isolates private and public scope even when owner and resource identities coincide',async()=>{
 const id=crypto.randomUUID(),credential=async()=> 'owner-token';await mount({shareId:id,privateProject:{id,name:'비공개 전시'},credential,credentialIdentity:'owner-A'});await settle(requests[0],page('비공개 의견'));
 await mount({shareId:id,credential,credentialIdentity:'owner-A'});expect(requests[0].init.signal?.aborted).toBe(true);expect(container.textContent).not.toContain('비공개 의견');expect(compose()).toBeNull();expect(container.querySelector('[role="alert"]')?.textContent).toContain('공유 링크 주소');
});

it('preserves a same-account draft after conflict and ordinary refresh and aborts on unmount',async()=>{
 await account('A');await mount();await settle(requests[0],page('A 의견'));await input(compose()!,'재시도할 초안');await submit();await settle(requests[1],{error:'수정 충돌'},409);expect(compose()!.value).toBe('재시도할 초안');expect(container.querySelector('[role="alert"]')?.textContent).toContain('입력은 유지');
 await click('새로고침');await settle(requests[2],page('업데이트된 A 의견'));expect(compose()!.value).toBe('재시도할 초안');await click('새로고침');const request=requests[3];await act(async()=>root.unmount());expect(request.init.signal?.aborted).toBe(true);await settle(request,page('언마운트 이후'));expect(container.textContent).toBe('');
});

it('never starts an A request when its delayed session resolves after switching to B',async()=>{
 let resolveSession!:(session:{userId:string;token:string})=>void;
 vi.mocked(cloudSession).mockImplementation(()=>useAuth.getState().user?.id==='A'?new Promise(resolve=>{resolveSession=resolve;}):Promise.resolve({userId:'B',token:'token-B'}));
 await account('A');await mount();expect(requests).toHaveLength(0);await account('B');expect(requests).toHaveLength(1);await settle(requests[0],page('B 의견'));
 await act(async()=>resolveSession({userId:'A',token:'token-A'}));expect(requests).toHaveLength(1);expect(container.textContent).toContain('B 의견');expect(container.querySelector('[role="alert"]')).toBeNull();
});

it('cancels deferred owner credentials when ownership changes and rejects a late revocation',async()=>{
 const resolves:Array<(token:string)=>void>=[],credential=()=>new Promise<string>(resolve=>resolves.push(resolve));
 await mount({credential,credentialIdentity:'owner-A'});await mount({credential:async()=> 'owner-B-token',credentialIdentity:'owner-B'});expect(requests).toHaveLength(1);await settle(requests[0],page('새 소유자 의견'));
 await act(async()=>resolves.forEach(resolve=>resolve('owner-A-token')));expect(requests).toHaveLength(1);
 await click('새로고침');const old=requests[1];await mount({credential:async()=> 'owner-C-token',credentialIdentity:'owner-C'});expect(old.init.signal?.aborted).toBe(true);await settle(requests[2],page('C 의견'));await settle(old,{error:'이전 공유 회수'},410);expect(container.textContent).toContain('C 의견');expect(container.querySelector('[role="alert"]')).toBeNull();
});
