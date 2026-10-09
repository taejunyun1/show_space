// @vitest-environment jsdom
import {Blob as NodeBlob} from 'node:buffer';
import {act,StrictMode} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {ShareDialog} from './ShareDialog';
import {cloudSession,useAuth} from '../state/auth';
import {useEditor} from '../state/editor';
import {createDemoProject} from '../domain/model';
import {appendSceneSnapshot} from '../domain/sceneSnapshot';
import {commentFixture} from '../worker/commentApi.fixture';
import type {Project} from '../domain/types';
import type {CameraView3D} from './cameraView3d';

vi.mock('../state/auth',async original=>({...await original<typeof import('../state/auth')>(),initializeAuth:vi.fn(async()=>{}),cloudSession:vi.fn()}));
vi.mock('./AccountDialog',()=>({AccountDialog:()=>null}));
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',id='a'.repeat(48);
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=';
const user=(id:string)=>({id,email:`${id}@example.test`});
type Request={url:string;init:RequestInit;resolve:(response:Response)=>void};
let root:Root,container:HTMLDivElement,p:Project,requests:Request[],camera:CameraView3D;
const close=vi.fn(),clipboard=vi.fn();
async function mount(){await act(async()=>root.render(<StrictMode><ShareDialog project={p} onClose={close} getCamera={()=>camera}/></StrictMode>));}
async function click(label:string){const b=[...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.trim()===label||b.getAttribute('aria-label')===label)!;expect(b).toBeDefined();await act(async()=>b.click());}
async function check(label:string){const input=[...container.querySelectorAll('label')].find(l=>l.textContent?.trim()===label)!.querySelector<HTMLInputElement>('input')!;await act(async()=>input.click());}
async function account(id:string|null){await act(async()=>useAuth.setState({status:id?'signedIn':'signedOut',user:id?user(id):null}));}
async function settle(request:Request,body:unknown,status=200){await act(async()=>request.resolve(new Response(body===null?null:JSON.stringify(body),{status,headers:{'content-type':'application/json'}})));}
function delayedSession(){let finish!:(session:{token:string;userId:string})=>void;vi.mocked(cloudSession).mockImplementationOnce(()=>new Promise(resolve=>finish=resolve));return ()=>finish({userId:A,token:'account-a'});}
const row=(name='A 전시')=>({id,name,status:'active',createdAt:'2026-10-08T00:00:00Z',includeDimensions:false});
beforeEach(()=>{
 // Worker Request/Response bodies use the native streaming Blob, which jsdom
 // does not implement. Keep this transport adapter inside the test runtime.
 vi.stubGlobal('Blob',NodeBlob);
 (globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.open=true;}});
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:clipboard}});clipboard.mockResolvedValue(undefined);vi.spyOn(window,'confirm').mockReturnValue(true);
 useAuth.setState({status:'signedIn',user:user(A),config:null,error:''});vi.mocked(cloudSession).mockImplementation(async()=>({userId:useAuth.getState().user!.id,token:useAuth.getState().user!.id===A?'account-a':'account-b'}));
 p=createDemoProject();p.id='share-ui-project';p.note='PRIVATE_PROJECT';p.walls[0].note='PRIVATE_WALL';p.artworks=p.artworks.slice(0,1).map(a=>({...a,imageUrl:png,note:'PRIVATE_ART',description:'공개 설명'}));p.scenes=[];p=appendSceneSnapshot(p,p,'공개할 Scene');p=appendSceneSnapshot(p,p,'선택하지 않은 Scene');useEditor.getState().loadProject(p);
 camera={position:[1,2,3],target:[0,1,0],zoom:40,projection:'orthographic'};requests=[];
 // Mutation requests intentionally complete after cancellation; the client must
 // wait for their terminal response, then retire a known draft safely.
 vi.stubGlobal('fetch',vi.fn((url:string,init:RequestInit={})=>url.startsWith('data:')?Promise.resolve(new Response(Uint8Array.from(atob(png.split(',')[1]),c=>c.charCodeAt(0)),{headers:{'content-type':'image/png'}})):new Promise<Response>(resolve=>requests.push({url,init,resolve}))));
 container=document.createElement('div');document.body.append(container);root=createRoot(container);
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.restoreAllMocks();vi.clearAllMocks();vi.unstubAllGlobals();});

it('does not start publication after a delayed A session returns to account B',async()=>{
 const finish=delayedSession();await mount();await click('링크 만들기');await account(B);await act(async()=>finish());expect(requests).toHaveLength(0);expect(clipboard).not.toHaveBeenCalled();await click('링크 만들기');expect(requests).toHaveLength(1);expect(requests[0].init.headers).toEqual({authorization:'Bearer account-b'});
});

it('does not start publication after unmount during credential lookup',async()=>{
 const finish=delayedSession();await mount();await click('링크 만들기');await act(async()=>root.unmount());await act(async()=>finish());expect(requests).toHaveLength(0);expect(clipboard).not.toHaveBeenCalled();
});

it('rejects a delayed credential after batched account A→B→A even though the final identity matches',async()=>{
 const finish=delayedSession();await mount();await click('링크 만들기');await act(async()=>{useAuth.setState({user:user(B)});useAuth.setState({user:user(A)});});await act(async()=>finish());expect(requests).toHaveLength(0);await click('링크 만들기');expect(requests).toHaveLength(1);
});

it('keeps the new account operation busy when an old draft cleanup finishes',async()=>{
 await mount();await click('링크 만들기');const old=requests[0];await account(B);await click('링크 만들기');const next=requests[1];await settle(old,{id},201);expect(requests[2].init.method).toBe('DELETE');await settle(requests[2],null,204);await click('링크 만들기');expect(requests).toHaveLength(3);
 const nextId='b'.repeat(48);await settle(next,{id:nextId},201);await settle(requests[3],null,204);await settle(requests[4],{id:nextId},201);await settle(requests[5],{items:[{...row('B 전시'),id:nextId}]});expect(clipboard).toHaveBeenCalledTimes(1);expect(clipboard).toHaveBeenCalledWith(`${location.origin}/s/${nextId}`);expect(container.textContent).toContain('B 전시');expect(container.querySelector('[role="alert"]')).toBeNull();
});

it('shows a current creation failure, blocks duplicates and permits a clean retry',async()=>{
 await mount();await click('링크 만들기');await click('링크 만들기');expect(requests).toHaveLength(1);await settle(requests[0],{error:'일시적 발행 실패'},503);expect(container.querySelector('[role="alert"]')?.textContent).toContain('일시적 발행 실패');await click('링크 만들기');expect(requests).toHaveLength(2);expect(container.querySelector('[role="alert"]')).toBeNull();await settle(requests[1],{id},201);await settle(requests[2],null,204);await settle(requests[3],{id},201);await settle(requests[4],{items:[row()]});expect(clipboard).toHaveBeenCalledTimes(1);
});

it('retires the share dialog on batched project A→B→A before credentials finish',async()=>{
 const finish=delayedSession();await mount();await click('링크 만들기');await act(async()=>{useEditor.getState().loadProject({...p,id:'other-share-project'});useEditor.getState().loadProject(p);});await act(async()=>finish());expect(close).toHaveBeenCalledTimes(1);expect(requests).toHaveLength(0);expect(useEditor.getState().project.scenes).toHaveLength(2);
});

it('does not send an abandoned list request after credential lookup',async()=>{
 const finish=delayedSession();await mount();await click('공유 목록');await account(B);await act(async()=>finish());expect(requests).toHaveLength(0);await click('공유 목록');await settle(requests[0],{items:[row('B 목록')]});expect(container.textContent).toContain('B 목록');
});

it('does not revoke a link after changing accounts during credential lookup',async()=>{
 await mount();await click('공유 목록');await settle(requests[0],{items:[row()]});const finish=delayedSession();await click('A 전시 공유 중단');await account(B);await act(async()=>finish());expect(requests).toHaveLength(1);expect(container.textContent).not.toContain('A 전시');
});

it('cleans up a known draft after an abandoned creation responds without uploading or publishing it',async()=>{
 await mount();await click('링크 만들기');const old=requests[0];await account(B);await settle(old,{id},201);expect(requests).toHaveLength(2);expect(requests[1].url).toBe('/api/shares/'+id);expect(requests[1].init.method).toBe('DELETE');expect(requests[1].init.headers).toEqual({authorization:'Bearer account-a'});expect(requests[1].init.signal?.aborted).not.toBe(true);await settle(requests[1],null,204);expect(container.querySelector('.share-created')).toBeNull();expect(clipboard).not.toHaveBeenCalled();expect(container.querySelector('[role="alert"]')).toBeNull();
});

it('ignores a late revoked response and never reloads the old account list',async()=>{
 await mount();await click('공유 목록');await settle(requests[0],{items:[row()]});await click('A 전시 공유 중단');await account(B);await settle(requests[1],null,204);expect(requests).toHaveLength(2);expect(container.textContent).not.toContain('A 전시');expect(container.querySelector('[role="alert"]')).toBeNull();
});

it('rejects late A list results and keeps B list permissions and controls',async()=>{
 await mount();await click('공유 목록');const old=requests[0];await account(B);expect(old.init.signal?.aborted).toBe(true);await click('공유 목록');await settle(requests[1],{items:[row('B 목록')]});await settle(old,{items:[row('비공개 A 목록')]});expect(container.textContent).toContain('B 목록');expect(container.textContent).not.toContain('비공개 A 목록');expect(container.querySelector('button[aria-label="B 목록 공유 중단"]')).not.toBeNull();
});

it('captures the clicked camera and selected Scene before a delayed session, then lists and copies the fixed link',async()=>{
 const finish=delayedSession(),savedCamera=structuredClone(camera);await mount();await check('치수 공개');await check('작품 상세 정보 공개');await check('협업 댓글 허용');await check('공개할 Scene');await click('링크 만들기');camera={...camera,position:[8,9,10]};await act(async()=>finish());await settle(requests[0],{id},201);expect(requests[1].init.method).toBe('PUT');await settle(requests[1],null,204);expect(requests[2].url).toBe(`/api/shares/${id}/publish`);
 const snapshot=JSON.parse(requests[2].init.body as string);expect(snapshot.camera).toEqual({position:savedCamera.position,target:savedCamera.target,zoom:savedCamera.zoom});expect(snapshot.scenes).toHaveLength(1);expect(snapshot.scenes[0].name).toBe('공개할 Scene');expect(snapshot.artworks[0].description).toBe('공개 설명');expect(JSON.stringify(snapshot)).not.toContain('PRIVATE');expect(JSON.stringify(snapshot)).not.toContain('선택하지 않은 Scene');expect(new Headers(requests[2].init.headers).get('x-review-comments')).toBe('true');await settle(requests[2],{id},201);await settle(requests[3],{items:[row()]});expect(container.querySelector<HTMLInputElement>('[aria-label="생성된 공유 링크"]')!.value).toBe(`${location.origin}/s/${id}`);expect(clipboard).toHaveBeenCalledWith(`${location.origin}/s/${id}`);
});

it('publishes, reads and revokes the chosen frozen Scene through the actual Worker service bridge',async()=>{
 const fixture=commentFixture();const calls:Array<{url:string;method:string}>=[];vi.stubGlobal('fetch',vi.fn(async(url:string,init:RequestInit={})=>{calls.push({url,method:init.method??'GET'});if(url.startsWith('data:'))return new Response(Uint8Array.from(atob(png.split(',')[1]),c=>c.charCodeAt(0)),{headers:{'content-type':'image/png'}});return fixture.bridge(url,init);}));
 try{await mount();await check('공개할 Scene');await check('작품 상세 정보 공개');await check('협업 댓글 허용');await click('링크 만들기');await vi.waitFor(async()=>{await act(async()=>{});const error=container.querySelector('[role="alert"]');if(error)throw new Error(error.textContent!);expect(container.querySelector('[aria-label="생성된 공유 링크"]')).not.toBeNull();});const url=container.querySelector<HTMLInputElement>('[aria-label="생성된 공유 링크"]')!.value,shareId=url.split('/').at(-1)!;
  const response=await fixture.call('GET',`/api/public/${shareId}`);expect(response.status).toBe(200);const snapshot=await response.json();expect(snapshot.scenes).toHaveLength(1);expect(snapshot.scenes[0].name).toBe('공개할 Scene');expect(snapshot.commentsEnabled).toBe(true);expect(JSON.stringify(snapshot)).not.toContain('PRIVATE');expect(JSON.stringify(snapshot)).not.toContain('선택하지 않은 Scene');const imageId=snapshot.artworks[0].imageId;expect((await fixture.call('GET',`/api/public/${shareId}/images/${imageId}`)).status).toBe(200);
  const before=structuredClone(useEditor.getState().project);await act(async()=>useEditor.getState().patchArtwork(p.artworks[0].id,{widthMm:777}));const fixed=await(await fixture.call('GET',`/api/public/${shareId}`)).json();expect(fixed.artworks[0].widthMm).toBe(before.artworks[0].widthMm);await click(`${p.name} 공유 중단`);await vi.waitFor(async()=>{await act(async()=>{});expect(container.textContent).toContain('중단됨');});expect((await fixture.call('GET',`/api/public/${shareId}`)).status).toBe(410);expect((await fixture.call('GET',`/api/public/${shareId}/images/${imageId}`)).status).toBe(410);expect(calls.filter(c=>c.url.endsWith('/publish'))).toHaveLength(1);expect(useEditor.getState().project.artworks[0].widthMm).toBe(777);
 }finally{fixture.close();}
},20000);
