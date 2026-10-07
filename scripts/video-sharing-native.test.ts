import {expect,it} from 'vitest';
import {readFile,writeFile} from 'node:fs/promises';
import {importProjectPackage} from '../src/lib/projectPackage';
import {publishPublicShare} from '../src/lib/shareClient';
import {publicVideoHash} from '../src/lib/publicVideoAsset';
import {parsePublicShare,publicVideoIds} from '../src/domain/publicShare';
/** Opt-in, owned synthetic fixture only; no production credential or personal artwork. */
it.skipIf(process.env.GONGGAN_VIDEO_NATIVE!=='1')('publishes the owned MP4 fixture through a real local Worker and preserves exact source bytes',async()=>{
 const origin='http://127.0.0.1:8814',token='synthetic-video-owner-token-20261007',raw=await readFile('/tmp/gonggan-video-backup-20261007.zip'),project=await importProjectPackage(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));
 project.name='공유 영상 검증 20261007';const clip=project.artworks.find(a=>a.video)!;expect(clip).toBeDefined();clip.video={...clip.video!,fit:'contain'};clip.widthMm=1600;clip.heightMm=900;
 const fetcher=(path:string,init?:RequestInit)=>fetch(path.startsWith('/')?origin+path:path,init),url=await publishPublicShare(project,{includeDimensions:true,sceneIds:project.scenes.map(s=>s.id)},token,undefined,fetcher,origin),id=url.split('/').at(-1)!;
 const snapshot=parsePublicShare(await (await fetcher('/api/public/'+id)).json()),hash=publicVideoIds(snapshot)[0];expect(publicVideoIds(snapshot)).toHaveLength(1);expect(snapshot.scenes).toHaveLength(1);expect(snapshot.artworks.find(a=>a.video)?.video?.fit).toBe('contain');expect(snapshot.scenes![0].snapshot.artworks.find(a=>a.video)?.video?.fit).toBe('cover');
 const response=await fetcher(`/api/public/${id}/videos/${hash}`),bytes=await response.arrayBuffer();expect(response.headers.get('content-type')).toBe('video/mp4');expect(await publicVideoHash(bytes)).toBe(hash);const source=await readFile('/tmp/gonggan-video-test-20261007.mp4');expect(new Uint8Array(bytes)).toEqual(new Uint8Array(source));
 const partial=await fetcher(`/api/public/${id}/videos/${hash}`,{headers:{range:'bytes=0-1'}});expect(partial.status).toBe(206);expect(partial.headers.get('content-range')).toBe(`bytes 0-1/${bytes.byteLength}`);expect(new Uint8Array(await partial.arrayBuffer())).toEqual(new Uint8Array(bytes).slice(0,2));
 await writeFile('/tmp/gonggan-video-share-20261007.json',JSON.stringify({url,id,hash,bytes:bytes.byteLength,sceneId:project.scenes[0].id,artworkId:clip.id},null,2));
},30000);
