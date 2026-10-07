import {expect,it} from 'vitest';
import {writeFile} from 'node:fs/promises';
import {createPublicShare} from '../src/domain/publicShare';
import {projectorTestFixture} from '../src/lib/projectorTestFixture';

/** Explicit synthetic identities; real localhost Worker HTTP and R2 only. */
it.skipIf(process.env.GONGGAN_SHARE_STREAM_NATIVE!=='1')('enforces streamed image limits and preserves exact accepted bytes through local Worker HTTP/R2',async()=>{
 const origin='http://127.0.0.1:8815',request=(path:string,init?:RequestInit)=>fetch(origin+path,init);
 const owned:Array<{id:string;token:string;published:boolean}>=[],checks:Array<{principal:string;oversizedStatus:number;missingImageStatus:number;exactLimitStatus:number;bytesIdentical:boolean}>=[];
 const report={scope:'real local Worker HTTP/R2; synthetic PNG with trailing padding',identityProvider:'explicit synthetic A/B and legacy key; no real Supabase',production:false,checks,cleanupComplete:false,complete:false};
 const project=projectorTestFixture(),snapshot=createPublicShare(project,{includeDimensions:false}).snapshot;
 const source=new Uint8Array(await(await fetch(project.lights![0].projection!.imageUrl)).arrayBuffer()),accepted=new Uint8Array(5_000_000);accepted.set(source);accepted[accepted.length-1]=42;
 try{
  for(const [principal,token] of [['A','account-a'],['B','account-b'],['legacy','synthetic-legacy-owner-token-20261007']]){
   const headers={authorization:`Bearer ${token}`},created=await request('/api/shares',{method:'POST',headers});expect(created.status).toBe(201);
   const {id}=await created.json() as {id:string},entry={id,token,published:false};owned.push(entry);
   let produced=0;const body=new ReadableStream<Uint8Array>({pull(controller){const bytes=new Uint8Array(600_000);if(produced===0)bytes.set(source);produced++;controller.enqueue(bytes);if(produced===20)controller.close();}},{highWaterMark:0});
   const streamedInit={method:'PUT',headers,body,duplex:'half'} as RequestInit;
   const oversized=await request(`/api/shares/${id}/images/0`,streamedInit);expect(oversized.status).toBe(413);
   const missing=await request(`/api/shares/${id}/publish`,{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify(snapshot)});expect(missing.status).toBe(409);
   const exact=await request(`/api/shares/${id}/images/0`,{method:'PUT',headers,body:accepted});expect(exact.status).toBe(204);
   const published=await request(`/api/shares/${id}/publish`,{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify(snapshot)});expect(published.status).toBe(201);entry.published=true;
   const publicImage=await request(`/api/public/${id}/images/0`);expect(publicImage.status).toBe(200);expect(publicImage.headers.get('content-type')).toBe('image/png');
   const identical=Buffer.from(await publicImage.arrayBuffer()).equals(Buffer.from(accepted));expect(identical).toBe(true);
   checks.push({principal,oversizedStatus:oversized.status,missingImageStatus:missing.status,exactLimitStatus:exact.status,bytesIdentical:identical});
  }
 }finally{
  let cleanupComplete=true;
  for(const entry of owned){
   try{const deleted=await request(`/api/shares/${entry.id}`,{method:'DELETE',headers:{authorization:`Bearer ${entry.token}`}});expect(deleted.status).toBe(204);expect((await request(`/api/public/${entry.id}`)).status).toBe(entry.published?410:404);expect((await request(`/api/public/${entry.id}/images/0`)).status).toBe(entry.published?410:404);}catch{cleanupComplete=false;}
  }
  report.cleanupComplete=cleanupComplete;report.complete=checks.length===3&&cleanupComplete;
  await writeFile('/tmp/gonggan-share-stream-native-20261007.json',JSON.stringify(report,null,2));
  expect(cleanupComplete).toBe(true);
 }
},30000);
