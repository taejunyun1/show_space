import {expect,it,vi} from 'vitest';
import {handleShareRequest,type ShareBucket} from './shareApi';
import type {AuthFetch} from './auth';
import {createDemoProject} from '../domain/model';
import {createPublicShare} from '../domain/publicShare';

class Bucket implements ShareBucket {
 data=new Map<string,Uint8Array>();
 async put(key:string,value:string|ArrayBuffer|ReadableStream){this.data.set(key,typeof value==='string'?new TextEncoder().encode(value):new Uint8Array(await new Response(value).arrayBuffer()));}
 async get(key:string){const bytes=this.data.get(key);return bytes?{body:new Blob([bytes.slice().buffer]).stream(),text:async()=>new TextDecoder().decode(bytes),size:bytes.length}:null;}
 async head(key:string){return this.data.has(key)?{size:this.data.get(key)!.length}:null;}
 async list({prefix,limit=1000}:{prefix:string;limit?:number}){const keys=[...this.data.keys()].filter(k=>k.startsWith(prefix));return {objects:keys.slice(0,limit).map(key=>({key})),truncated:keys.length>limit};}
 async delete(keys:string|string[]){for(const key of Array.isArray(keys)?keys:[keys])this.data.delete(key);}
}
const userA='11111111-1111-4111-8111-111111111111',userB='22222222-2222-4222-8222-222222222222';
const config={SUPABASE_URL:'https://testing.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_only_public_test_key'};
const auth:AuthFetch=async(_input,init)=>{
 const token=new Headers(init?.headers).get('authorization');if(!['Bearer account-a','Bearer account-b','Bearer anonymous'].includes(token??''))return Response.json({message:'invalid JWT'},{status:401});
 return Response.json({id:token==='Bearer account-b'?userB:userA,email:'private@example.test',role:'authenticated',aud:'authenticated',is_anonymous:token==='Bearer anonymous',created_at:'2026-10-07T00:00:00Z'});
};
function setup(){const bucket=new Bucket(),env={...config,SHARES:bucket,OWNER_TOKEN:'legacy-owner-token-for-testing'},call=(method:string,path:string,token?:string,body?:BodyInit,origin?:string)=>handleShareRequest(new Request('https://example.test'+path,{method,headers:{...(token?{authorization:'Bearer '+token}:{}),...(origin?{origin}:{})},body}),env,auth);return {bucket,env,call};}
async function publish(call:ReturnType<typeof setup>['call'],token:string){const id=(await(await call('POST','/api/shares',token)).json()).id,p=createDemoProject();p.artworks=[];const snapshot=createPublicShare(p,{includeDimensions:false}).snapshot;expect((await call('POST',`/api/shares/${id}/publish`,token,JSON.stringify(snapshot))).status).toBe(201);return id as string;}
it('lets logged-in authors publish and list only their own shares without exposing owner metadata',async()=>{
 const {call}=setup(),a=await publish(call,'account-a'),b=await publish(call,'account-b'),legacy=await publish(call,'legacy-owner-token-for-testing');
 for(const [token,expected] of [['account-a',a],['account-b',b],['legacy-owner-token-for-testing',legacy]]){const response=await call('GET','/api/shares',token),data=await response.json();expect(response.status).toBe(200);expect(data.items.map((v:{id:string})=>v.id)).toEqual([expected]);expect(JSON.stringify(data)).not.toMatch(/owner|11111111|22222222|private@example/);}
 const publicResponse=await call('GET','/api/public/'+a);expect(publicResponse.status).toBe(200);expect(JSON.stringify(await publicResponse.json())).not.toMatch(/owner|11111111|private@example/);
});
it('denies another account and legacy key from changing or revoking account-owned shares and assets',async()=>{
 const {call,bucket}=setup(),id=(await(await call('POST','/api/shares','account-a')).json()).id;
 const before=[...bucket.data.entries()].map(([key,bytes])=>[key,[...bytes]]);
 for(const token of ['account-b','legacy-owner-token-for-testing'])for(const [method,path,body] of [['DELETE',`/api/shares/${id}`,undefined],['POST',`/api/shares/${id}/publish`,'{}'],['PUT',`/api/shares/${id}/images/0`,'fake'],['PUT',`/api/shares/${id}/models/${'0'.repeat(64)}`,'fake'],['PUT',`/api/shares/${id}/videos/${'0'.repeat(64)}`,'fake']])expect((await call(method!,path!,token,body)).status).toBe(404);
 expect([...bucket.data.entries()].map(([key,bytes])=>[key,[...bytes]])).toEqual(before);
 expect((await call('DELETE',`/api/shares/${id}`,'account-a')).status).toBe(204);expect([...bucket.data.keys()]).toEqual([]);
});
it('keeps legacy unowned shares isolated and denies invalid, anonymous and cross-origin requests',async()=>{
 const {call}=setup(),legacy=await publish(call,'legacy-owner-token-for-testing');expect((await call('DELETE','/api/shares/'+legacy,'account-a')).status).toBe(404);
 for(const token of [undefined,'invalid','anonymous'])expect((await call('POST','/api/shares',token)).status).toBe(401);
 expect((await call('POST','/api/shares','account-a',undefined,'https://elsewhere.test')).status).toBe(403);
 expect((await call('DELETE','/api/shares/'+legacy,'legacy-owner-token-for-testing')).status).toBe(204);expect((await call('GET','/api/public/'+legacy)).status).toBe(410);
});
it('fails closed when the authentication service or account index write fails',async()=>{
 const {env,bucket}=setup(),request=new Request('https://example.test/api/shares',{method:'POST',headers:{authorization:'Bearer account-a'}});
 const offline:AuthFetch=async()=>{throw new Error('offline');};expect((await handleShareRequest(request,env,offline)).status).toBe(503);expect(bucket.data.size).toBe(0);
 const put=bucket.put.bind(bucket);vi.spyOn(bucket,'put').mockImplementation(async(key,value)=>{if(key.startsWith('owners/'))throw new Error('index failed');return put(key,value);});
 expect((await handleShareRequest(request,env,auth)).status).toBe(503);expect(bucket.data.size).toBe(0);
});
