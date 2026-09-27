import {describe,expect,it} from 'vitest';
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
