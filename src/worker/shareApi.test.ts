import {DEFAULT_OUTDOOR} from '../domain/outdoor';
import {describe,expect,it} from 'vitest';
import {materialPreset} from '../domain/materials';
import {createDemoProject} from '../domain/model';
import {createPublicShare} from '../domain/publicShare';
import {handleShareRequest,type ShareBucket} from './shareApi';

class MemoryBucket implements ShareBucket {
  data=new Map<string,{bytes:Uint8Array;contentType?:string}>();
  async put(key:string,value:string|ArrayBuffer|ReadableStream,options?:{httpMetadata?:{contentType?:string}}){
    const bytes=typeof value==='string'?new TextEncoder().encode(value):value instanceof ArrayBuffer?new Uint8Array(value):new Uint8Array(await new Response(value).arrayBuffer());
    this.data.set(key,{bytes,contentType:options?.httpMetadata?.contentType});
  }
  async get(key:string){const found=this.data.get(key);return found?{body:new Blob([new Uint8Array(found.bytes)]).stream(),text:async()=>new TextDecoder().decode(found.bytes),size:found.bytes.length,httpMetadata:{contentType:found.contentType}}:null;}
  async head(key:string){const found=this.data.get(key);return found?{size:found.bytes.length}:null;}
  async list(options:{prefix:string;cursor?:string;limit?:number}){return {objects:[...this.data.keys()].filter(key=>key.startsWith(options.prefix)).map(key=>({key})),truncated:false};}
  async delete(keys:string|string[]){for(const key of Array.isArray(keys)?keys:[keys])this.data.delete(key);}
}

const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]);
function setup(){const bucket=new MemoryBucket(),env={SHARES:bucket,OWNER_TOKEN:'private-owner-token-for-testing'};const call=(method:string,path:string,body?:BodyInit,authorized=false)=>handleShareRequest(new Request(`https://example.test${path}`,{method,headers:{...(authorized?{authorization:'Bearer private-owner-token-for-testing'}:{}),...(typeof body==='string'?{'content-type':'application/json'}:{})},body}),env);return {bucket,call};}

describe('share API',()=>{
  it('requires owner authorization for creation and listing',async()=>{
    const {call}=setup();
    expect((await call('POST','/api/shares')).status).toBe(401);
    expect((await call('GET','/api/shares')).status).toBe(401);
  });

  it('publishes an immutable snapshot with private images, then blocks both after revocation',async()=>{
    const {call}=setup();
    const project=createDemoProject();project.artworks=project.artworks.slice(0,1);
    const {snapshot}=createPublicShare(project,{includeDimensions:false});
    const created=await call('POST','/api/shares',undefined,true);
    expect(created.status).toBe(201);
    const {id}=await created.json() as {id:string};
    expect((await call('GET',`/api/public/${id}`)).status).toBe(404);
    expect((await call('POST',`/api/shares/${id}/publish`,JSON.stringify(snapshot),true)).status).toBe(409);
    expect((await call('PUT',`/api/shares/${id}/images/0`,png.buffer,true)).status).toBe(204);
    expect((await call('POST',`/api/shares/${id}/publish`,JSON.stringify({...snapshot,secret:'do not publish'}),true)).status).toBe(201);
    const response=await call('GET',`/api/public/${id}`);
    expect(response.status).toBe(200);
    const published=await response.text();
    expect(published).not.toContain('do not publish');
    expect(published).not.toContain('imageUrl');
    expect((await call('GET',`/api/public/${id}/images/0`)).status).toBe(200);
    expect((await call('PUT',`/api/shares/${id}/images/0`,png.buffer,true)).status).toBe(409);
    expect((await call('GET','/api/shares',undefined,true)).status).toBe(200);
    expect((await call('DELETE',`/api/shares/${id}`,undefined,true)).status).toBe(204);
    expect((await call('GET',`/api/public/${id}`)).status).toBe(410);
    expect((await call('GET',`/api/public/${id}/images/0`)).status).toBe(410);
  });

  it('rejects non-image uploads and malformed public snapshots',async()=>{
    const {call}=setup(),created=await call('POST','/api/shares',undefined,true),{id}=await created.json() as {id:string};
    expect((await call('PUT',`/api/shares/${id}/images/0`,new TextEncoder().encode('<script>').buffer,true)).status).toBe(415);
    expect((await call('POST',`/api/shares/${id}/publish`,JSON.stringify({schemaVersion:1,privateProject:{notes:'secret'}}),true)).status).toBe(400);
  });
});

it('publishes validated physical material fields and rejects invalid finishes before publishing',async()=>{
 const {call}=setup(),p=createDemoProject();p.artworks=[];p.floorMaterial=materialPreset('epoxy-floor').material;p.walls[0].material=materialPreset('glass').material;
 const {snapshot}=createPublicShare(p,{includeDimensions:false}),created=await call('POST','/api/shares',undefined,true),{id}=await created.json() as {id:string};
 expect((await call('POST',`/api/shares/${id}/publish`,JSON.stringify({...snapshot,floorMaterial:{...snapshot.floorMaterial,opacity:-1}}),true)).status).toBe(400);
 const valid={...snapshot,floorMaterial:{...snapshot.floorMaterial,privateNote:'SECRET'}};expect((await call('POST',`/api/shares/${id}/publish`,JSON.stringify(valid),true)).status).toBe(201);
 const response=await call('GET',`/api/public/${id}`),published=await response.json() as typeof snapshot;
 expect(published.floorMaterial).toEqual(p.floorMaterial);expect(published.walls[0].material).toEqual(p.walls[0].material);expect(JSON.stringify(published)).not.toContain('SECRET');
});

it('uploads, publishes, serves and revokes textured surfaces through the actual share client',async()=>{
 const {publishPublicShare}=await import('../lib/shareClient'),p=createDemoProject();p.artworks=[];
 const imageUrl='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=';
 p.floorMaterial={...materialPreset('wood').material,texture:{imageUrl,widthMm:500,heightMm:250}};p.walls[0].material={...materialPreset('wood').material,texture:{imageUrl,widthMm:1000,heightMm:750}};
 const bucket=new MemoryBucket(),env={SHARES:bucket,OWNER_TOKEN:'private-owner-token-for-testing'};
 const fetcher=async(input:string,init?:RequestInit)=>input.startsWith('data:')?fetch(input):handleShareRequest(new Request(`https://example.test${input}`,init),env);
 const url=await publishPublicShare(p,{includeDimensions:false},env.OWNER_TOKEN,undefined,fetcher,'https://example.test'),id=url.split('/').at(-1)!;
 const snapshot=await(await fetcher(`/api/public/${id}`)).json() as ReturnType<typeof createPublicShare>['snapshot'];expect(snapshot.floorMaterial?.texture).toEqual({imageId:'0',widthMm:500,heightMm:250});expect(snapshot.walls[0].material?.texture).toEqual({imageId:'0',widthMm:1000,heightMm:750});
 const image=await fetcher(`/api/public/${id}/images/0`);expect(image.status).toBe(200);expect(image.headers.get('content-type')).toBe('image/png');expect((await image.arrayBuffer()).byteLength).toBeGreaterThan(8);
 expect((await fetcher(`/api/public/${id}/images/99`)).status).toBe(404);expect([...bucket.data.keys()].filter(k=>k.includes('/images/'))).toHaveLength(1);
 await fetcher(`/api/shares/${id}`,{method:'DELETE',headers:{authorization:`Bearer ${env.OWNER_TOKEN}`}});expect((await fetcher(`/api/public/${id}/images/0`)).status).toBe(410);
});
it('refuses publication until every referenced surface image has uploaded',async()=>{
 const {call}=setup(),p=createDemoProject();p.artworks=[];p.floorMaterial={...materialPreset('wood').material,texture:{imageUrl:'data:image/png;base64,AAAA',widthMm:500,heightMm:500}};
 const {snapshot}=createPublicShare(p,{includeDimensions:false}),created=await call('POST','/api/shares',undefined,true),{id}=await created.json() as {id:string};
 expect((await call('POST',`/api/shares/${id}/publish`,JSON.stringify(snapshot),true)).status).toBe(409);
});

it('publishes visible Spot/Area and illumination settings without exposing notes, locks or accepting invalid Kelvin',async()=>{
 const {newLight,CUSTOM_LIGHTING}=await import('../domain/lighting'),{call}=setup(),p=createDemoProject();p.artworks=[];const spot=newLight(p,'spot');p.lights=[{...spot,note:'PRIVATE LIGHT NOTE',locked:true},{...spot,id:'area-light',kind:'area'},{...spot,id:'hidden-light',visible:false}];p.lighting=CUSTOM_LIGHTING;
 const {snapshot}=createPublicShare(p,{includeDimensions:false}),created=await call('POST','/api/shares',undefined,true),{id}=await created.json() as {id:string};
 expect((await call('POST',`/api/shares/${id}/publish`,JSON.stringify({...snapshot,lights:snapshot.lights!.map(l=>({...l,kelvin:0}))}),true)).status).toBe(400);
 expect((await call('POST',`/api/shares/${id}/publish`,JSON.stringify({...snapshot,lights:snapshot.lights!.map(l=>({...l,note:'SECRET',locked:true}))}),true)).status).toBe(201);
 const result=await(await call('GET',`/api/public/${id}`)).json() as typeof snapshot;expect(result.lights).toEqual(snapshot.lights);expect(result.lighting).toEqual(CUSTOM_LIGHTING);expect(JSON.stringify(result)).not.toMatch(/PRIVATE|SECRET|hidden-light|locked/);
});

it('rejects invalid outdoor times at the API boundary and rebuilds public outdoor metadata',async()=>{
 const {call}=setup(),p=createDemoProject();p.artworks=[];p.outdoor={...DEFAULT_OUTDOOR,mode:'outdoor',time:'17:00',northDeg:90};
 const {snapshot}=createPublicShare(p,{includeDimensions:false}),created=await call('POST','/api/shares',undefined,true),{id}=await created.json() as {id:string};
 expect((await call('POST',`/api/shares/${id}/publish`,JSON.stringify({...snapshot,outdoor:{...snapshot.outdoor,timeZone:'America/New_York',date:'2026-03-08',time:'02:30'}}),true)).status).toBe(400);
 expect((await call('POST',`/api/shares/${id}/publish`,JSON.stringify({...snapshot,outdoor:{...snapshot.outdoor,secret:'PRIVATE'}}),true)).status).toBe(201);
 const result=await call('GET',`/api/public/${id}`),text=await result.text();expect(result.status).toBe(200);expect(JSON.parse(text).outdoor).toEqual(p.outdoor);expect(text).not.toContain('PRIVATE');
});

it('publishes real 3D artwork assets once through the client, preserves physical poses, and revokes assets with the snapshot',async()=>{
 const {addModelArtwork}=await import('../domain/modelArtworks'),{testArtworkModel}=await import('../lib/modelArtworkTestFixture'),{publishPublicShare}=await import('../lib/shareClient');const p=addModelArtwork(createDemoProject(),testArtworkModel()).project;p.artworks=[];const a=p.modelArtworks![0];p.modelArtworks=[{...a,note:'PRIVATE_MODEL_NOTE',artist:'Synthetic',position:{x:15000,y:50,z:7000},rotation:{x:20,y:35,z:-10}},{...a,id:'copy',position:{x:0,y:0,z:0}},{...a,id:'hidden',visible:false}];
 const bucket=new MemoryBucket(),env={SHARES:bucket,OWNER_TOKEN:'private-owner-token-for-testing'},fetcher=async(input:string,init?:RequestInit)=>handleShareRequest(new Request(`https://example.test${input}`,init),env),url=await publishPublicShare(p,{includeDimensions:true},env.OWNER_TOKEN,undefined,fetcher,'https://example.test'),id=url.split('/').at(-1)!;
 const published=await fetcher(`/api/public/${id}`),snapshot=await published.json() as ReturnType<typeof createPublicShare>['snapshot'];expect(snapshot.modelArtworks).toHaveLength(2);expect(snapshot.modelArtworks![0].position).toEqual(p.modelArtworks[0].position);expect(snapshot.modelArtworks![0].rotation).toEqual(p.modelArtworks[0].rotation);expect(JSON.stringify(snapshot)).not.toMatch(/PRIVATE|hidden|note|locked|groupId|dataUrl/);const hash=snapshot.modelArtworks![0].modelId;expect(snapshot.modelArtworks![1].modelId).toBe(hash);expect([...bucket.data.keys()].filter(k=>k.includes('/models/'))).toHaveLength(1);
 const model=await fetcher(`/api/public/${id}/models/${hash}`);expect(model.status).toBe(200);expect(model.headers.get('content-type')).toBe('model/gltf-binary');expect(model.headers.get('cache-control')).toBe('no-store');const bytes=await model.arrayBuffer(),{inspectStaticArtworkGlb}=await import('../lib/artworkModelPayload');expect(inspectStaticArtworkGlb(bytes).meshes).toHaveLength(2);expect((await fetcher(`/api/public/${id}/models/${'0'.repeat(64)}`)).status).toBe(404);expect((await fetcher(`/api/public/${id}/models/${hash}`,{method:'PUT',body:bytes})).status).toBe(405);expect((await fetcher(`/api/shares/${id}/models/${hash}`,{method:'PUT',headers:{authorization:`Bearer ${env.OWNER_TOKEN}`},body:bytes})).status).toBe(409);
 await fetcher(`/api/shares/${id}`,{method:'DELETE',headers:{authorization:`Bearer ${env.OWNER_TOKEN}`}});expect((await fetcher(`/api/public/${id}`)).status).toBe(410);expect((await fetcher(`/api/public/${id}/models/${hash}`)).status).toBe(410);expect([...bucket.data.keys()].filter(k=>k.includes('/models/'))).toHaveLength(0);
});
it('validates model upload authorization, canonical hash, GLB bounds and publication references',async()=>{
 const {call,bucket}=setup(),{artworkTestGlb,testArtworkModel}=await import('../lib/modelArtworkTestFixture'),{publicModelBytes,publicModelHash,preparePublicModels}=await import('../lib/publicModelAsset'),{addModelArtwork}=await import('../domain/modelArtworks'),created=await call('POST','/api/shares',undefined,true),{id}=await created.json() as {id:string},bytes=publicModelBytes(artworkTestGlb()),hash=await publicModelHash(bytes);
 expect((await call('PUT',`/api/shares/${id}/models/${hash}`,bytes)).status).toBe(401);expect((await call('PUT',`/api/shares/${id}/models/${'0'.repeat(64)}`,bytes,true)).status).toBe(400);expect((await call('PUT',`/api/shares/${id}/models/${hash}`,new Uint8Array([0,1]).buffer,true)).status).toBe(400);
 const p=addModelArtwork(createDemoProject(),testArtworkModel()).project;p.artworks=[];const models=await preparePublicModels(p),snapshot=createPublicShare(p,{includeDimensions:false,modelAssetIds:models.ids}).snapshot;expect((await call('POST',`/api/shares/${id}/publish`,JSON.stringify(snapshot),true)).status).toBe(409);expect((await call('PUT',`/api/shares/${id}/models/${hash}`,bytes,true)).status).toBe(204);expect((await call('PUT',`/api/shares/${id}/models/${hash}`,bytes,true)).status).toBe(204);expect([...bucket.data.keys()].filter(k=>k.includes('/models/'))).toHaveLength(1);expect((await call('POST',`/api/shares/${id}/publish`,JSON.stringify(snapshot),true)).status).toBe(201);
});
it('cleans metadata on the server and refuses oversized declared or streamed model bodies',async()=>{
 const {call,bucket}=setup(),{artworkTestGltf}=await import('../lib/modelArtworkTestFixture'),{packEmbeddedGltf}=await import('../lib/artworkModelPayload'),{publicModelBytes,publicModelHash}=await import('../lib/publicModelAsset'),{doc}=artworkTestGltf(),source=packEmbeddedGltf({...doc,extras:{note:'SECRET'},asset:{...doc.asset,generator:'SECRET'},nodes:doc.nodes.map(n=>({...n,name:'SECRET'}))}),hash=await publicModelHash(publicModelBytes(source)),{id}=await(await call('POST','/api/shares',undefined,true)).json() as {id:string};
 expect((await call('PUT',`/api/shares/${id}/models/${hash}`,source,true)).status).toBe(204);const stored=[...bucket.data.values()].find(v=>v.contentType==='model/gltf-binary')!;expect(new TextDecoder().decode(stored.bytes)).not.toContain('SECRET');expect((await call('PUT',`/api/shares/${id}/models/${hash}`,new Uint8Array(12*1024*1024+1).buffer,true)).status).toBe(413);expect((await handleShareRequest(new Request(`https://example.test/api/shares/${id}/models/${hash}`,{method:'PUT',headers:{authorization:'Bearer private-owner-token-for-testing','content-length':String(12*1024*1024+1)},body:source}),{SHARES:bucket,OWNER_TOKEN:'private-owner-token-for-testing'})).status).toBe(413);
});
it('deletes an unfinished 3D share draft on failed model upload or publication',async()=>{
 const {addModelArtwork}=await import('../domain/modelArtworks'),{testArtworkModel}=await import('../lib/modelArtworkTestFixture'),{publishPublicShare}=await import('../lib/shareClient'),p=addModelArtwork(createDemoProject(),testArtworkModel()).project;p.artworks=[];
 const methods:string[]=[],fetcher=async(input:string,init?:RequestInit)=>{methods.push(init?.method??'GET');if(input==='/api/shares')return Response.json({id:'b'.repeat(48)},{status:201});if(input.includes('/models/'))return Response.json({error:'upload failed'},{status:503});return new Response(null,{status:204});};await expect(publishPublicShare(p,{includeDimensions:false},'owner',undefined,fetcher,'https://example.test')).rejects.toThrow('upload failed');expect(methods).toEqual(['POST','PUT','DELETE']);
});

it('publishes a model-only venue pose and blocks all model requests after revocation',async()=>{
 const {testVenueModel}=await import('../lib/venueModelTestFixture'),{publishPublicShare}=await import('../lib/shareClient'),p=createDemoProject();p.walls=[];p.artworks=[];p.referenceModel={...testVenueModel(),name:'PRIVATE_VENUE_FILE.glb',positionMm:[1500,100,-500],rotationDeg:30,scale:1.2};
 const bucket=new MemoryBucket(),env={SHARES:bucket,OWNER_TOKEN:'private-owner-token-for-testing'},fetcher=async(input:string,init?:RequestInit)=>handleShareRequest(new Request(`https://example.test${input}`,init),env),link=await publishPublicShare(p,{includeDimensions:true},env.OWNER_TOKEN,undefined,fetcher,'https://example.test'),id=link.split('/').at(-1)!,response=await fetcher(`/api/public/${id}`),snapshot=await response.json() as ReturnType<typeof createPublicShare>['snapshot'];
 expect(snapshot.walls).toEqual([]);expect(snapshot.artworks).toEqual([]);expect(snapshot.referenceModel).toMatchObject({positionMm:[1500,100,-500],rotationDeg:30,scale:1.2});expect(JSON.stringify(snapshot)).not.toMatch(/PRIVATE_VENUE_FILE|dataUrl|name.*glb/);const hash=snapshot.referenceModel!.modelId;expect((await fetcher(`/api/public/${id}/models/${hash}`)).status).toBe(200);expect((await fetcher(`/api/public/${id}/models/${'0'.repeat(64)}`)).status).toBe(404);expect([...bucket.data.keys()].filter(k=>k.includes('/models/'))).toHaveLength(1);
 expect((await fetcher(`/api/shares/${id}`,{method:'DELETE',headers:{authorization:`Bearer ${env.OWNER_TOKEN}`}})).status).toBe(204);expect((await fetcher(`/api/public/${id}`)).status).toBe(410);expect((await fetcher(`/api/public/${id}/models/${hash}`)).status).toBe(410);expect([...bucket.data.keys()].filter(k=>k.includes(`/shares/${id}/models/`))).toHaveLength(0);
});
it('allows 51 public model assets including the venue, then rejects another new asset',async()=>{
 const {call,bucket}=setup(),{publicModelBytes,publicModelHash}=await import('../lib/publicModelAsset'),{venueTestGlb}=await import('../lib/venueModelTestFixture'),bytes=publicModelBytes(venueTestGlb()),hash=await publicModelHash(bytes),{id}=await(await call('POST','/api/shares',undefined,true)).json() as {id:string};
 for(let i=0;i<50;i++)await bucket.put(`shares/${id}/models/${String(i).padStart(64,'0')}.glb`,new ArrayBuffer(4));expect((await call('PUT',`/api/shares/${id}/models/${hash}`,bytes,true)).status).toBe(204);expect((await call('PUT',`/api/shares/${id}/models/${hash}`,bytes,true)).status).toBe(204);
 const {artworkTestGlb}=await import('../lib/modelArtworkTestFixture'),other=publicModelBytes(artworkTestGlb()),otherHash=await publicModelHash(other);expect((await call('PUT',`/api/shares/${id}/models/${otherHash}`,other,true)).status).toBe(413);
});

it('discards note text, checklists and private photo fields at the server publication boundary',async()=>{
 const {newLight}=await import('../domain/lighting'),{call,bucket}=setup(),p=createDemoProject();p.artworks=[];p.lights=[newLight(p,'spot')];const {snapshot}=createPublicShare(p,{includeDimensions:false}),created=await call('POST','/api/shares',undefined,true),{id}=await created.json() as {id:string};
 const details={checklist:[{id:'secret-check',text:'PRIVATE_SERVER_CHECK',done:true}],images:[{id:'secret-photo',name:'PRIVATE_SERVER_PHOTO.png',imageUrl:'https://private.example/photo.png'}]};
 const dirty={...snapshot,note:'PRIVATE_SERVER_NOTE',noteDetails:details,floorNoteDetails:details,walls:snapshot.walls.map(w=>({...w,noteDetails:details})),lights:snapshot.lights!.map(l=>({...l,note:'PRIVATE_SERVER_LIGHT',noteDetails:details}))};
 expect((await call('POST',`/api/shares/${id}/publish`,JSON.stringify(dirty),true)).status).toBe(201);const response=await call('GET',`/api/public/${id}`);expect(response.status).toBe(200);expect(await response.text()).not.toMatch(/PRIVATE_SERVER|noteDetails|checklist|private.example/);expect([...bucket.data.keys()].some(k=>k.includes('/images/'))).toBe(false);
});

it('checks Scene-only assets before publish, strips private nested fields, and revokes every Scene asset',async()=>{
 const {call}=setup(),p=createDemoProject();p.artworks=p.artworks.slice(0,1);
 const {snapshot}=createPublicShare(p,{includeDimensions:false});
 const scene=structuredClone(snapshot);scene.artworks[0].imageId='9';scene.artworks[0].name='Scene only';
 const raw={...snapshot,scenes:[{id:'scene-one',name:'Presentation',note:'PRIVATE',snapshot:{...scene,note:'PRIVATE',sourcePlan:'PRIVATE',artworks:scene.artworks.map(a=>({...a,note:'PRIVATE'}))}}]};
 const {id}=await (await call('POST','/api/shares',undefined,true)).json() as {id:string};
 expect((await call('PUT',`/api/shares/${id}/images/0`,png.buffer,true)).status).toBe(204);
 expect((await call('POST',`/api/shares/${id}/publish`,JSON.stringify(raw),true)).status).toBe(409);
 expect((await call('PUT',`/api/shares/${id}/images/9`,png.buffer,true)).status).toBe(204);
 expect((await call('POST',`/api/shares/${id}/publish`,JSON.stringify(raw),true)).status).toBe(201);
 const published=await (await call('GET',`/api/public/${id}`)).text();expect(published).toContain('Presentation');expect(published).not.toContain('PRIVATE');
 expect((await call('GET',`/api/public/${id}/images/9`)).status).toBe(200);expect((await call('GET',`/api/public/${id}/images/8`)).status).toBe(404);
 expect((await call('POST',`/api/public/${id}`,JSON.stringify(raw))).status).toBe(405);
 const listed=await (await call('GET','/api/shares',undefined,true)).json() as {items:Array<{sceneCount:number}>};expect(listed.items[0].sceneCount).toBe(1);
 expect((await call('DELETE',`/api/shares/${id}`,undefined,true)).status).toBe(204);expect((await call('GET',`/api/public/${id}/images/9`)).status).toBe(410);
});
it('publishes and serves a model that exists only in a selected saved Scene',async()=>{
 const {testVenueModel}=await import('../lib/venueModelTestFixture'),{publishPublicShare}=await import('../lib/shareClient');
 const p=createDemoProject();p.artworks=[];p.scenes=[{id:'scene-model',name:'모델 설치안',artworks:[],wallVisibility:{},structure:{walls:structuredClone(p.walls),openings:[],dimensions:[],unplacedArtworks:[],referenceModel:testVenueModel()}}];
 const {bucket}=setup(),env={SHARES:bucket,OWNER_TOKEN:'private-owner-token-for-testing'};
 const fetcher=(input:string,init?:RequestInit)=>handleShareRequest(new Request(`https://example.test${input}`,init),env);
 const url=await publishPublicShare(p,{includeDimensions:false,sceneIds:['scene-model']},env.OWNER_TOKEN,undefined,fetcher,'https://example.test'),id=url.split('/').at(-1)!;
 const snapshot=await (await fetcher(`/api/public/${id}`)).json() as import('../domain/publicShare').PublicShareSnapshot;
 expect(snapshot.referenceModel).toBeUndefined();const hash=snapshot.scenes![0].snapshot.referenceModel!.modelId;
 expect((await fetcher(`/api/public/${id}/models/${hash}`)).status).toBe(200);
 await fetcher(`/api/shares/${id}`,{method:'DELETE',headers:{authorization:`Bearer ${env.OWNER_TOKEN}`}});
 expect((await fetcher(`/api/public/${id}/models/${hash}`)).status).toBe(410);
 expect([...bucket.data.keys()].filter(k=>k.startsWith(`shares/${id}/`))).toHaveLength(0);
});
it('deletes all pages of data and resumes an interrupted revoked cleanup',async()=>{
 const {bucket,call}=setup();
 const {id}=await (await call('POST','/api/shares',undefined,true)).json() as {id:string};
 const originalList=bucket.list.bind(bucket);bucket.list=async options=>{const all=await originalList(options);return {objects:all.objects.slice(0,1000),truncated:all.objects.length>1000};};
 const originalDelete=bucket.delete.bind(bucket);let first=true;
 bucket.delete=async keys=>{if(first){first=false;throw new Error('storage unavailable');}await originalDelete(keys);};
 const p=createDemoProject();p.artworks=[];const snapshot=createPublicShare(p,{includeDimensions:false}).snapshot;
 expect((await call('POST',`/api/shares/${id}/publish`,JSON.stringify(snapshot),true)).status).toBe(201);
 for(let i=0;i<1051;i++)await bucket.put(`shares/${id}/images/${i}`,png.buffer);
 await expect(call('DELETE',`/api/shares/${id}`,undefined,true)).rejects.toThrow('storage unavailable');
 expect((await call('GET',`/api/public/${id}`)).status).toBe(410);
 expect((await call('DELETE',`/api/shares/${id}`,undefined,true)).status).toBe(204);
 expect([...bucket.data.keys()].filter(k=>k.startsWith(`shares/${id}/`))).toHaveLength(0);
});
it('stops oversized chunked publication input before consuming the entire stream',async()=>{
 const {bucket,call}=setup();const {id}=await (await call('POST','/api/shares',undefined,true)).json() as {id:string};let produced=0,cancelled=false;
 const body=new ReadableStream({pull(controller){produced++;controller.enqueue(new Uint8Array(600000));if(produced===10)controller.close();},cancel(){cancelled=true;}});
 const request=new Request(`https://example.test/api/shares/${id}/publish`,{method:'POST',headers:{authorization:'Bearer private-owner-token-for-testing'},body,duplex:'half'} as RequestInit);
 expect((await handleShareRequest(request,{SHARES:bucket,OWNER_TOKEN:'private-owner-token-for-testing'})).status).toBe(400);expect(cancelled).toBe(true);expect(produced).toBeLessThan(10);
});
it('honors the publication-wide details flag on server input and excludes private Note from every Scene',async()=>{
 const {call}=setup(),p=createDemoProject();p.artworks=[];
 const base=createPublicShare(p,{includeDimensions:false}).snapshot;
 const art={id:'info-art',name:'텍스트 작품',artist:'검증 작가',year:'2026',medium:'<b>재료</b>',description:'작품 설명',artworkType:'photo',presentationType:'mounted-print',wallId:p.walls[0].id,wallSide:'front',widthMm:900,heightMm:1200,depthMm:30,alongMm:1000,centerHeightMm:1500,frame:'none',imageId:'0',note:'PRIVATE NOTE',noteDetails:{text:'PRIVATE'}};
 for(const includeArtworkDetails of [false,true]){
  const nested={...base,includeArtworkDetails:true,artworks:[art]};
  const raw={...base,includeArtworkDetails,artworks:[art],scenes:[{id:'s',name:'Scene',snapshot:nested}]};
  const {id}=await (await call('POST','/api/shares',undefined,true)).json() as {id:string};
  await call('PUT',`/api/shares/${id}/images/0`,png.buffer,true);
  expect((await call('POST',`/api/shares/${id}/publish`,JSON.stringify(raw),true)).status).toBe(201);
  const snapshot=await (await call('GET',`/api/public/${id}`)).json() as import('../domain/publicShare').PublicShareSnapshot;
  for(const layout of [snapshot,snapshot.scenes![0].snapshot]){expect(layout.artworks[0].year).toBe('2026');expect(layout.artworks[0].medium).toBe(includeArtworkDetails?art.medium:undefined);expect(layout.artworks[0].description).toBe(includeArtworkDetails?art.description:undefined);}
  expect(JSON.stringify(snapshot)).not.toContain('PRIVATE');
  await call('DELETE',`/api/shares/${id}`,undefined,true);
 }
});
