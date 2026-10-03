import {expect,it,vi} from 'vitest';
import {createDemoProject} from '../domain/model';
import {publishPublicShare} from './shareClient';

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

it('refuses visible reference models before creating an incomplete public share',async()=>{
 const project=createDemoProject();project.referenceModel={name:'room.glb',dataUrl:'unused',visible:true,sizeMm:[1000,1000,1000],positionMm:[0,0,0],sourceOffsetM:[0,0,0],rotationDeg:0,scale:1};
 const fetcher=vi.fn();
 await expect(publishPublicShare(project,{includeDimensions:false},'owner',undefined,fetcher,'https://example.test')).rejects.toThrow(/3D 참고 모델/);
 expect(fetcher).not.toHaveBeenCalled();
});
