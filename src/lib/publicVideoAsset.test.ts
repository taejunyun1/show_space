import {expect,it,vi} from 'vitest';
import {createDemoProject} from '../domain/model';
import {parsePublicShare,publicVideoIds} from '../domain/publicShare';
import {presentationLayout} from '../domain/presentation';
import {parsePublicVideo,publicVideoUrl,readonlyVideoSessionKey} from '../domain/publicVideo';
import {readonlyVideoSource} from '../components/ReadonlyAssets';
import {testVideoArtwork} from './videoArtworkTestFixture';
import {prepareSharePresentation} from './sharePresentation';
import {publicVideoBytes} from './publicVideoAsset';
import {publishPublicShare} from './shareClient';
function fixture(){const p=createDemoProject();p.artworks=p.artworks.slice(0,1);p.artworks[0].video=testVideoArtwork();return p;}
it('deduplicates source bytes across current/selected Scenes while preserving screen fit and geometry',async()=>{
 const p=fixture(),a=p.artworks[0];p.scenes=[{id:'public',name:'Selected',artworks:[{...a,alongMm:3200,video:{...a.video!,fit:'cover'},note:'PRIVATE'}],wallVisibility:{}},{id:'private',name:'PRIVATE',artworks:[{...a,id:'other',video:{...a.video!,dataUrl:'invalid'}}],wallVisibility:{}}];
 const before=JSON.stringify(p),r=await prepareSharePresentation(p,{includeDimensions:false,sceneIds:['public']});expect(r.videos.size).toBe(1);const video=r.snapshot.artworks[0].video!;expect(video.videoId).toMatch(/^[a-f0-9]{64}$/);expect(publicVideoIds(r.snapshot)).toEqual([video.videoId]);expect(r.snapshot.scenes![0].snapshot.artworks[0]).toMatchObject({alongMm:3200,video:{fit:'cover',videoId:video.videoId}});expect(JSON.stringify(r.snapshot)).not.toMatch(/PRIVATE|dataUrl|note/);expect(JSON.stringify(p)).toBe(before);expect([...r.videos.values()][0].bytes.byteLength).toBe(16);
});
it('excludes hidden screens and hidden walls before parsing private originals, while local presentation stays detached',async()=>{
 const p=fixture(),a=p.artworks[0];p.artworks.push({...a,id:'hidden',visible:false,video:{...a.video!,dataUrl:'invalid'}});p.walls[1].visible=false;p.artworks.push({...a,id:'hidden-wall',wallId:p.walls[1].id,video:{...a.video!,dataUrl:'invalid'}});const r=await prepareSharePresentation(p,{includeDimensions:false});expect(r.videos.size).toBe(1);expect(r.snapshot.artworks).toHaveLength(1);
 const before=JSON.stringify(p),local=presentationLayout(p,null),v=local.snapshot.artworks[0].video!;expect(local.videos.get(v.videoId)).toBe(a.video!.dataUrl);expect(JSON.stringify(local.snapshot)).not.toContain('dataUrl');local.snapshot.artworks[0].alongMm=999;expect(JSON.stringify(p)).toBe(before);
 expect(readonlyVideoSource('local',v.videoId,{images:new Map(),models:new Map(),videos:local.videos})).toBe(a.video!.dataUrl);expect(readonlyVideoSource('local','f'.repeat(64),{images:new Map(),models:new Map()})).toBeUndefined();
});
it('allowlists public descriptors, rejects unsafe addresses, invalid metadata, and publication-wide overflow',async()=>{
 const v={...testVideoArtwork(),videoId:'a'.repeat(64),privateNote:'PRIVATE'};expect(parsePublicVideo(v)).not.toHaveProperty('dataUrl');expect(()=>parsePublicVideo({...v,widthPx:4000})).toThrow();expect(()=>parsePublicVideo({...v,videoId:'https://example.test'})).toThrow();expect(()=>publicVideoUrl('../bad','a'.repeat(64))).toThrow();expect(publicVideoUrl('b'.repeat(48),v.videoId)).toBe(`/api/public/${'b'.repeat(48)}/videos/${v.videoId}`);expect(readonlyVideoSessionKey('current','a')).not.toBe(readonlyVideoSessionKey('scene','a'));
 const p=fixture(),r=await prepareSharePresentation(p,{includeDimensions:false}),a=r.snapshot.artworks[0];expect(()=>parsePublicShare({...r.snapshot,artworks:Array.from({length:21},(_,i)=>({...a,id:String(i),video:{...a.video!,videoId:i.toString(16).padStart(64,'0')}}))})).toThrow(/20/);
 expect(()=>publicVideoBytes(new Uint8Array([1,2,3]).buffer,'video/mp4')).toThrow();
});
it('validates before remote writes and cleans the draft if the exact original video upload fails',async()=>{
 const p=fixture(),fetcher=vi.fn(async(path:string)=>path==='/api/shares'?Response.json({id:'a'.repeat(48)},{status:201}):path.includes('/videos/')?Response.json({error:'video failed'},{status:500}):path.startsWith('/api/')?new Response(null,{status:204}):new Response(new Uint8Array([137,80,78,71])));
 await expect(publishPublicShare(p,{includeDimensions:false},'owner',undefined,fetcher,'https://example.test')).rejects.toThrow('video failed');expect(fetcher.mock.calls.some(([p])=>p.endsWith('/publish'))).toBe(false);expect(fetcher.mock.calls.at(-1)![0]).toBe('/api/shares/'+'a'.repeat(48));
 p.artworks[0].video!.dataUrl='invalid';fetcher.mockClear();await expect(publishPublicShare(p,{includeDimensions:false},'owner',undefined,fetcher,'https://example.test')).rejects.toThrow();expect(fetcher).not.toHaveBeenCalled();
});
