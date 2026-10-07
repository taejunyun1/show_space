import {afterEach} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handleProjectRequest,type ProjectDatabase,type ProjectStatement,type ProjectBucket,type ProjectEnv} from './projectApi';
import type {AuthFetch} from './auth';
import {cloudPackageHash} from '../lib/cloudProjectClient';
export const ownerA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',ownerB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const config={SUPABASE_URL:'https://testing.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_public_test'};
const dbs:DatabaseSync[]=[];afterEach(()=>dbs.splice(0).forEach(db=>db.close()));
class Sqlite implements ProjectDatabase {
 sql=new DatabaseSync(':memory:');throwAfterLibrary=false;
 constructor(){dbs.push(this.sql);this.sql.exec('PRAGMA foreign_keys = ON');for(const file of ['0001_cloud_projects.sql','0002_cloud_history.sql','0003_cloud_library.sql'])this.sql.exec(readFileSync(new URL('../../migrations/'+file,import.meta.url),'utf8'));}
 prepare(query:string):ProjectStatement{let args:unknown[]=[];const self=this;return {bind(...v){args=v;return this;},async first<T>(){return (self.sql.prepare(query).get(...args as never[])??null) as T|null;},async all<T>(){return {results:self.sql.prepare(query).all(...args as never[]) as T[]};},async run(){const result=self.sql.prepare(query).run(...args as never[]);if(self.throwAfterLibrary&&query.startsWith('INSERT INTO cloud_library')){self.throwAfterLibrary=false;throw new Error('Committed response lost');}return {success:true,meta:{changes:Number(result.changes)}};}};}
}
class Bucket implements ProjectBucket {
 files=new Map<string,Uint8Array<ArrayBuffer>>();beforePut?:()=>Promise<void>;
 async put(key:string,body:ReadableStream,opts:{sha256:string;httpMetadata:{contentType:string}}){const b=new Uint8Array(await new Response(body).arrayBuffer());if(await cloudPackageHash(b.buffer)!==opts.sha256)throw new Error('checksum');await this.beforePut?.();this.files.set(key,b);return {size:b.length};}
 async get(key:string,opts?:{range:{offset:number;length:number}}){const b=this.files.get(key);if(!b)return null;const data=opts?b.slice(opts.range.offset,opts.range.offset+opts.range.length):b;return {body:new Response(data).body!,size:b.length};}
 async delete(key:string){this.files.delete(key);}
}
const authFetch:AuthFetch=async(_input,init)=>{const token=new Headers(init?.headers).get('authorization');if(!['Bearer test-a','Bearer test-b'].includes(token??''))return Response.json({error:'bad token'},{status:401});return Response.json({id:token==='Bearer test-b'?ownerB:ownerA,email:'test@example.test',role:'authenticated',aud:'authenticated',created_at:'2026-10-07T00:00:00Z'});};
export function libraryApiFixture(){const db=new Sqlite(),bucket=new Bucket(),env:ProjectEnv={...config,PROJECTS_DB:db,PRIVATE_PROJECTS:bucket};const bridge=async(path:string,init:RequestInit={})=>{const headers=new Headers(init.headers);if(init.body instanceof Blob)headers.set('content-length',String(init.body.size));if(typeof init.body==='string')headers.set('content-length',String(new TextEncoder().encode(init.body).length));return handleProjectRequest(new Request('https://app.example'+path,{...init,headers}),env,authFetch);};return {db,bucket,env,bridge};}
