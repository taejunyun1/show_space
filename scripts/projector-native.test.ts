import {expect,it} from 'vitest';
import {writeFile} from 'node:fs/promises';
import {projectorTestFixture} from '../src/lib/projectorTestFixture';
import {publishPublicShare,revokePublicShare} from '../src/lib/shareClient';
import {parsePublicShare,publicImageIds} from '../src/domain/publicShare';
/** Opt-in synthetic fixture only. A local Worker is required for publication. */
it.skipIf(!process.env.GONGGAN_PROJECTOR_NATIVE)('writes the owned projector fixture and optionally publishes through the real local Worker',async()=>{
 const project=projectorTestFixture();await writeFile('/tmp/gonggan-projector-fixture-20261007.json',JSON.stringify(project,null,2));
 if(process.env.GONGGAN_PROJECTOR_NATIVE!=='publish')return;
 const origin='http://127.0.0.1:8814',token='synthetic-video-owner-token-20261007',fetcher=(path:string,init?:RequestInit)=>fetch(path.startsWith('/')?origin+path:path,init);
 const url=await publishPublicShare(project,{includeDimensions:true,sceneIds:project.scenes.map(s=>s.id)},token,undefined,fetcher,origin),id=url.split('/').at(-1)!;
 try{
  const response=await fetcher('/api/public/'+id),snapshot=parsePublicShare(await response.json());expect(response.status).toBe(200);expect(snapshot.scenes).toHaveLength(1);expect(publicImageIds(snapshot)).toHaveLength(1);expect(snapshot.lights![0].projection).toMatchObject({throwRatio:1.5,aspectRatio:16/9,brightnessLumens:1500,fit:'contain'});expect(JSON.stringify(snapshot)).not.toMatch(/PRIVATE|imageUrl|data:|locked/);
  const image=await fetcher(`/api/public/${id}/images/${snapshot.lights![0].projection!.imageId}`);expect(image.status).toBe(200);expect(new Uint8Array(await image.arrayBuffer())).toEqual(new Uint8Array(await (await fetch(project.lights![0].projection!.imageUrl)).arrayBuffer()));
  await writeFile('/tmp/gonggan-projector-share-20261007.json',JSON.stringify({url,id,sceneId:project.scenes[0].id,revoked:process.env.GONGGAN_PROJECTOR_KEEP!=='1'},null,2));
 }finally{if(process.env.GONGGAN_PROJECTOR_KEEP!=='1'){await revokePublicShare(id,token,fetcher);expect((await fetcher('/api/public/'+id)).status).toBe(410);}}
},30000);
