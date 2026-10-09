import {expect,it,vi} from 'vitest';
import {createDemoProject} from '../domain/model';
import {publishPublicShare} from './shareClient';
import {commentFixture} from '../worker/commentApi.fixture';

it('uploads only public snapshot fields and artwork bytes before returning a share URL',async()=>{
  const project=createDemoProject();project.artworks=project.artworks.slice(0,1);project.walls[0].note='private note';
  const calls:Array<{url:string;method:string;body?:BodyInit|null}>=[];
  const fetcher=vi.fn(async(input:string,init?:RequestInit)=>{
    calls.push({url:input,method:init?.method??'GET',body:init?.body});
    if(input==='/api/shares'&&init?.method==='POST')return Response.json({id:'a'.repeat(48)},{status:201});
    if(input==='/artworks/artwork-1.png')return new Response(new Uint8Array([137,80,78,71,13,10,26,10]),{headers:{'content-type':'image/png'}});
    if(input.endsWith('/publish'))return Response.json({id:'a'.repeat(48)},{status:201});
    return new Response(null,{status:204});
  });
  const url=await publishPublicShare(project,{includeDimensions:false},'owner-token',undefined,fetcher,'https://example.test');
  expect(url).toBe(`https://example.test/s/${'a'.repeat(48)}`);
  expect(calls.map(call=>call.method)).toEqual(['POST','GET','PUT','POST']);
  const published=JSON.stringify(JSON.parse(String(calls[3].body)));
  expect(published).not.toContain('private note');
  expect(published).not.toContain('imageUrl');
  expect(published).not.toContain('scenes');
});

it('removes an unfinished draft when an artwork upload fails',async()=>{
  const project=createDemoProject();project.artworks=project.artworks.slice(0,1);
  const methods:string[]=[];
  const fetcher=vi.fn(async(input:string,init?:RequestInit)=>{
    methods.push(init?.method??'GET');
    if(input==='/api/shares')return Response.json({id:'b'.repeat(48)},{status:201});
    if(input.startsWith('/artworks/'))return new Response('missing',{status:404});
    return new Response(null,{status:204});
  });
  await expect(publishPublicShare(project,{includeDimensions:false},'owner-token',undefined,fetcher,'https://example.test')).rejects.toThrow();
  expect(methods).toEqual(['POST','GET','DELETE']);
});

it('removes an unfinished draft when publishing is rejected',async()=>{
  const project=createDemoProject();project.artworks=[];
  const methods:string[]=[];
  const fetcher=vi.fn(async(input:string,init?:RequestInit)=>{
    methods.push(init?.method??'GET');
    if(input==='/api/shares')return Response.json({id:'b'.repeat(48)},{status:201});
    if(input.endsWith('/publish'))return Response.json({error:'rejected'},{status:400});
    return new Response(null,{status:204});
  });
  await expect(publishPublicShare(project,{includeDimensions:false},'owner-token',undefined,fetcher,'https://example.test')).rejects.toThrow('rejected');
  expect(methods).toEqual(['POST','POST','DELETE']);
});

it('refuses invalid venue assets before creating an incomplete public share',async()=>{
 const project=createDemoProject();project.referenceModel={name:'room.glb',dataUrl:'unused',visible:true,sizeMm:[1000,1000,1000],positionMm:[0,0,0],sourceOffsetM:[0,0,0],rotationDeg:0,scale:1};
 const fetcher=vi.fn();
 await expect(publishPublicShare(project,{includeDimensions:false},'owner',undefined,fetcher,'https://example.test')).rejects.toThrow(/모델 파일 데이터/);
 expect(fetcher).not.toHaveBeenCalled();
});

it('does not create a draft when already cancelled',async()=>{
 const controller=new AbortController(),fetcher=vi.fn();controller.abort();
 await expect(publishPublicShare(createDemoProject(),{includeDimensions:false},'account-a',undefined,fetcher,'https://example.test',controller.signal)).rejects.toMatchObject({name:'AbortError'});
 expect(fetcher).not.toHaveBeenCalled();
});

function gate(){let release!:()=>void;const promise=new Promise<void>(resolve=>release=resolve);return {promise,release};}
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=';

// Use the actual Worker router and an in-memory storage/auth transport. Hold a
// write response on either side of its server mutation to reproduce cancellation.
it.each(['creation','upload','publication'] as const)('waits for the %s mutation before retiring its known share with the original owner',async phase=>{
 const fixture=commentFixture(),controller=new AbortController(),pending=gate();
 const project=createDemoProject();project.artworks=project.artworks.slice(0,1).map(a=>({...a,imageUrl:png}));
 const calls:Array<{url:string;init:RequestInit}>=[];let entered=false,id='';
 const fetcher=vi.fn(async(url:string,init:RequestInit={})=>{
  calls.push({url,init});
  if(url.startsWith('data:'))return new Response(Buffer.from(png.split(',')[1],'base64'),{headers:{'content-type':'image/png'}});
  if(phase==='upload'&&init.method==='PUT'){entered=true;await pending.promise;}
  const response=await fixture.bridge(url,init);
  if(url==='/api/shares'&&init.method==='POST')id=(await response.clone().json()).id;
  if((phase==='creation'&&url==='/api/shares'&&init.method==='POST')||(phase==='publication'&&url.endsWith('/publish'))){entered=true;await pending.promise;}
  return response;
 });
 const operation=publishPublicShare(project,{includeDimensions:false},'account-a',undefined,fetcher,'https://example.test',controller.signal);
 const rejected=expect(operation).rejects.toMatchObject({name:'AbortError'});
 try{
  await vi.waitFor(()=>expect(entered).toBe(true));controller.abort();
  expect(calls.some(c=>c.init.method==='DELETE')).toBe(false);
  if(phase==='publication')expect((await fixture.call('GET',`/api/public/${id}`)).status).toBe(200);
  pending.release();await rejected;
  const writes=calls.filter(c=>c.init.method==='POST'||c.init.method==='PUT'||c.init.method==='DELETE');
  expect(writes.map(c=>c.init.method)).toEqual(phase==='creation'?['POST','DELETE']:phase==='upload'?['POST','PUT','DELETE']:['POST','PUT','POST','DELETE']);
  for(const call of writes){expect(new Headers(call.init.headers).get('authorization')).toBe('Bearer account-a');expect(call.init.signal).toBeUndefined();}
  expect((await fixture.call('GET',`/api/public/${id}`)).status).toBe(phase==='publication'?410:404);
  expect((await fixture.call('GET',`/api/public/${id}/images/0`)).status).toBe(phase==='publication'?410:404);
  expect([...fixture.bucket.data.keys()].some(k=>k.includes(id)&&k.includes('/images/'))).toBe(false);
 }finally{pending.release();await operation.catch(()=>{});fixture.close();}
});

it('aborts a pending source read and still cleans the draft without the aborted signal',async()=>{
 const controller=new AbortController();let sourceSignal:AbortSignal|undefined,reading=false;
 const methods:string[]=[];
 const fetcher=vi.fn(async(url:string,init:RequestInit={})=>{
  methods.push(init.method??'GET');
  if(url==='/api/shares')return Response.json({id:'c'.repeat(48)},{status:201});
  if(url.startsWith('/artworks/')){sourceSignal=init.signal??undefined;reading=true;return new Promise<Response>((_resolve,reject)=>init.signal!.addEventListener('abort',()=>reject(init.signal!.reason),{once:true}));}
  expect(init.signal).toBeUndefined();return new Response(null,{status:204});
 });
 const p=createDemoProject();p.artworks=p.artworks.slice(0,1);
 const operation=publishPublicShare(p,{includeDimensions:false},'account-a',undefined,fetcher,'https://example.test',controller.signal),rejected=expect(operation).rejects.toMatchObject({name:'AbortError'});
 await vi.waitFor(()=>expect(reading).toBe(true));controller.abort();await rejected;
 expect(sourceSignal).toBe(controller.signal);expect(methods).toEqual(['POST','GET','DELETE']);
});
