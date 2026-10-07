/** Synthetic service bridge for tests. Never imported by production. */
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handleShareRequest,type ShareBucket} from './shareApi';
import type {ProjectDatabase,ProjectStatement} from './projectApi';
import type {AuthFetch} from './auth';
import {createDemoProject} from '../domain/model';
import {createPublicShare} from '../domain/publicShare';
import {prepareSharePresentation} from '../lib/sharePresentation';
import {appendSceneSnapshot} from '../domain/sceneSnapshot';
class Bucket implements ShareBucket {
 data=new Map<string,Uint8Array>();
 async put(key:string,value:string|ArrayBuffer|ReadableStream){this.data.set(key,typeof value==='string'?new TextEncoder().encode(value):new Uint8Array(await new Response(value).arrayBuffer()));}
 async get(key:string){const bytes=this.data.get(key);return bytes?{body:new Blob([bytes.slice().buffer]).stream(),text:async()=>new TextDecoder().decode(bytes),size:bytes.length}:null;}
 async head(key:string){const bytes=this.data.get(key);return bytes?{size:bytes.length}:null;}
 async list({prefix,limit=1000}:{prefix:string;limit?:number}){const keys=[...this.data.keys()].filter(k=>k.startsWith(prefix));return {objects:keys.slice(0,limit).map(key=>({key})),truncated:keys.length>limit};}
 async delete(keys:string|string[]){for(const key of Array.isArray(keys)?keys:[keys])this.data.delete(key);}
}
export function commentFixture(){
 const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../../migrations/0004_review_comments.sql',import.meta.url),'utf8'));const state={throwAfterWrite:false};
 const db:ProjectDatabase={prepare(query:string):ProjectStatement{let values:unknown[]=[];return {bind(...args){values=args;return this;},async first<T>(){return (sql.prepare(query).get(...values as Parameters<ReturnType<DatabaseSync['prepare']>['get']>)??null) as T|null;},async all<T>(){return {results:sql.prepare(query).all(...values as Parameters<ReturnType<DatabaseSync['prepare']>['all']>) as T[]};},async run(){const r=sql.prepare(query).run(...values as Parameters<ReturnType<DatabaseSync['prepare']>['run']>);if(state.throwAfterWrite){state.throwAfterWrite=false;throw new Error('synthetic lost D1 response');}return {success:true,meta:{changes:Number(r.changes)}};}};}};
 const bucket=new Bucket(),legacy='legacy-owner-token-for-comments',users={'account-a':'11111111-1111-4111-8111-111111111111','account-b':'22222222-2222-4222-8222-222222222222','account-c':'33333333-3333-4333-8333-333333333333'};
 const auth:AuthFetch=async(_input,init)=>{const token=new Headers(init?.headers).get('authorization')?.replace('Bearer ','')??'',id=users[token as keyof typeof users];return id?Response.json({id,email:'private-account@example.test',role:'authenticated',aud:'authenticated',is_anonymous:false,created_at:'2026-10-07T00:00:00Z'}):Response.json({message:'invalid JWT'},{status:401});};
 const env={SHARES:bucket,OWNER_TOKEN:legacy,PROJECTS_DB:db,SUPABASE_URL:'https://testing.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_only_public_test_key'};
 const bridge=(path:string,init?:RequestInit)=>handleShareRequest(new Request('https://example.test'+path,init),env,auth);
 const call=(method:string,path:string,token?:string,body?:unknown,headers?:HeadersInit)=>bridge(path,{method,headers:{...(token?{authorization:'Bearer '+token}:{}),...(body===undefined?{}:{'content-type':'application/json'}),...Object.fromEntries(new Headers(headers))},...(body===undefined?{}:{body:JSON.stringify(body)})});
 async function publish(enabled=true,token='account-a',scenes=false){let p=createDemoProject();p.artworks=[];p.note='NEVER PUBLIC INTERNAL NOTE';p=appendSceneSnapshot(p,p,'B안');const snapshot=scenes?(await prepareSharePresentation(p,{includeDimensions:false,sceneIds:[p.scenes[0].id]})).snapshot:createPublicShare(p,{includeDimensions:false}).snapshot;
  const id=(await(await call('POST','/api/shares',token)).json()).id as string;const response=await call('POST',`/api/shares/${id}/publish`,token,snapshot,enabled?{'x-review-comments':'true'}:{});if(response.status!==201)throw new Error(await response.text());return {id,p,snapshot};}
 return {sql,state,env,bucket,auth,bridge,call,publish,legacy,close:()=>sql.close()};
}
