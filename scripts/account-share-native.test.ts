import {expect,it} from 'vitest';
import {writeFile} from 'node:fs/promises';
import {publishPublicShare,listPublicShares,revokePublicShare} from '../src/lib/shareClient';
import {projectorTestFixture} from '../src/lib/projectorTestFixture';
/** Real local Wrangler/R2; identity-provider response is explicitly synthetic. */
it.skipIf(process.env.GONGGAN_ACCOUNT_SHARE_NATIVE!=='1')('publishes, isolates and revokes A/B/legacy shares through a real local Worker',async()=>{
 const origin='http://127.0.0.1:8815',fetcher=(path:string,init?:RequestInit)=>fetch(path.startsWith('/')?origin+path:path,init),tokens=['account-a','account-b','synthetic-legacy-owner-token-20261007'],owned:Array<{id:string;token:string}>=[];
 const report:{accountIsolation:boolean;publicOwnerMetadataAbsent:boolean;sourceImagePreserved:boolean;revoked:boolean;identityProvider:string;production:boolean}={accountIsolation:false,publicOwnerMetadataAbsent:false,sourceImagePreserved:false,revoked:false,identityProvider:'explicit local synthetic A/B; no real Supabase login',production:false};
 try{
  for(const token of tokens){const p=projectorTestFixture();p.name='합성 공유 '+token;const url=await publishPublicShare(p,{includeDimensions:false,sceneIds:[p.scenes[0].id]},token,undefined,fetcher,origin);owned.push({id:url.split('/').at(-1)!,token});}
  for(const share of owned){const items=await listPublicShares(share.token,fetcher);expect(items.filter(i=>i.status==='active').map(i=>i.id)).toEqual([share.id]);expect(items.every(i=>i.name==='합성 공유 '+share.token)).toBe(true);expect(JSON.stringify(items)).not.toMatch(/ownerId|11111111|22222222|synthetic@example/);}
  for(const share of owned)for(const token of tokens.filter(t=>t!==share.token)){const response=await fetcher('/api/shares/'+share.id,{method:'DELETE',headers:{authorization:'Bearer '+token}});expect(response.status).toBe(404);}report.accountIsolation=true;
  const response=await fetcher('/api/public/'+owned[0].id),snapshot=await response.json();expect(response.status).toBe(200);expect(JSON.stringify(snapshot)).not.toMatch(/ownerId|11111111|22222222|synthetic@example/);report.publicOwnerMetadataAbsent=true;
  const image=await fetcher(`/api/public/${owned[0].id}/images/${snapshot.lights[0].projection.imageId}`),source=await fetch(projectorTestFixture().lights![0].projection!.imageUrl);expect(new Uint8Array(await image.arrayBuffer())).toEqual(new Uint8Array(await source.arrayBuffer()));report.sourceImagePreserved=true;
 }finally{
  for(const {id,token} of owned){await revokePublicShare(id,token,fetcher);expect((await fetcher('/api/public/'+id)).status).toBe(410);}
  report.revoked=owned.length===3;await writeFile('/tmp/gonggan-account-share-20261007.json',JSON.stringify(report,null,2));
 }
},30000);
