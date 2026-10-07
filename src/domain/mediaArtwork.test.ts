import {expect,it} from 'vitest';
import {parseVideoArtwork,videoPayload,videoScreenLayout} from './mediaArtwork';
import {createDemoProject,parseProject,duplicateSelection} from './model';

const mp4=Uint8Array.from([0,0,0,16,102,116,121,112,105,115,111,109,0,0,0,0]);
const url='data:video/mp4;base64,'+btoa(String.fromCharCode(...mp4));
const media={dataUrl:url,widthPx:1920,heightPx:1080,durationSeconds:12.5,loop:true,fit:'contain' as const};
it('allows embedded MP4/WebM only and rejects a forged container, browser URL or invalid metadata',()=>{
 expect(videoPayload(url).bytes).toEqual(mp4);expect(parseVideoArtwork({...media,note:'not media metadata'})).toEqual(media);
 for(const dataUrl of ['https://example.org/movie.mp4','blob:private',url.replace('video/mp4','video/webm'),'data:video/mp4;base64,AAAA'])expect(()=>parseVideoArtwork({...media,dataUrl})).toThrow();
 expect(()=>parseVideoArtwork({...media,dataUrl:undefined})).toThrow();
 for(const widthPx of [0,1921,1.2,Infinity])expect(()=>parseVideoArtwork({...media,widthPx})).toThrow();
 for(const durationSeconds of [0,-1,Infinity,3601])expect(()=>parseVideoArtwork({...media,durationSeconds})).toThrow();
});
it('preserves video bytes and settings through project/Scene validation and object duplication',()=>{
 const project=createDemoProject();project.artworks[0]={...project.artworks[0],video:media};project.scenes=[{id:'scene-a',name:'A',artworks:structuredClone(project.artworks),wallVisibility:{}}];
 const parsed=parseProject(JSON.parse(JSON.stringify(project)));expect(parsed.artworks[0].video).toEqual(media);expect(parsed.scenes[0].artworks[0].video).toEqual(media);
 const copy=duplicateSelection(parsed,{type:'artwork',id:parsed.artworks[0].id});expect(copy.project.artworks.at(-1)?.video).toEqual(media);
 parsed.scenes[0].artworks[0].video!.dataUrl='https://untrusted/movie.mp4';expect(()=>parseProject(parsed)).toThrow();
});
it('fits a full frame without stretching, or crops centrally when the screen is filled',()=>{
 expect(videoScreenLayout(1000,1000,1920,1080,'contain')).toEqual({widthMm:1000,heightMm:562.5,repeat:[1,1],offset:[0,0]});
 expect(videoScreenLayout(1000,1000,1920,1080,'cover')).toEqual({widthMm:1000,heightMm:1000,repeat:[.5625,1],offset:[.21875,0]});
 expect(videoScreenLayout(1600,900,900,1600,'contain').heightMm).toBe(900);
});
