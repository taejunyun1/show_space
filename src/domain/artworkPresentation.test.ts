import {expect,it} from 'vitest';
import {createDemoProject,addArtwork,placeUnplacedArtwork,parseProject,updateArtwork,distributeArtworks,artworkWarnings,artworkPosition,deleteSelection} from './model';
import {parseFrameSettings,artworkPresentation,rotatedArtworkOuterSize,framePresets} from './artworkPresentation';
import {createPublicShare,parsePublicShare} from './publicShare';
import {useEditor} from '../state/editor';
import {exportProjectPackage,importProjectPackage} from '../lib/projectPackage';
import {needsSurfaceEnvironment} from '../lib/surfaceEnvironment';
const settings={widthMm:30,depthMm:70,material:'metal' as const,matWidthMm:60,matColor:'#f5f4ef',cover:'glass' as const};
it('keeps image dimensions and the default 45mm border while computing the real framed size',()=>{
 const a=createDemoProject().artworks[0];expect(artworkPresentation(a)).toMatchObject({widthMm:945,heightMm:1245,depthMm:30});
 const framed={...a,frameSettings:settings};expect(artworkPresentation(framed)).toMatchObject({widthMm:1080,heightMm:1380,depthMm:70,innerWidthMm:1020,innerHeightMm:1320,coverThicknessMm:2});
 expect(rotatedArtworkOuterSize({...framed,rotationDeg:90})).toEqual({widthMm:1380,heightMm:1080});
 expect(artworkPresentation({...framed,frame:'none'})).toMatchObject({widthMm:900,heightMm:1200,depthMm:30,coverThicknessMm:0});
 expect(artworkPresentation({...framed,depthMm:100})).toMatchObject({depthMm:100});
});
it('rejects malformed settings in live artworks, unplaced artworks, Scenes and public snapshots',()=>{
 const p=createDemoProject();
 const invalid=[null,[],{...settings,widthMm:0},{...settings,widthMm:201},{...settings,depthMm:Infinity},{...settings,matWidthMm:-1},{...settings,matColor:'url(evil)'},{...settings,material:'other'},{...settings,cover:'other'}];
 for(const frameSettings of invalid){
  expect(()=>parseFrameSettings(frameSettings)).toThrow();expect(()=>updateArtwork(p,p.artworks[0].id,{frameSettings} as never)).toThrow();
  const bad=structuredClone(p);bad.artworks[0].frameSettings=frameSettings as never;expect(()=>parseProject(bad)).toThrow();
  const {wallId:_,...a}=bad.artworks[0];bad.unplacedArtworks=[a];bad.artworks=[];expect(()=>parseProject(bad)).toThrow();
  bad.unplacedArtworks=[];bad.scenes=[{id:'bad',name:'bad',artworks:[{...a,wallId:p.walls[0].id}],wallVisibility:{}}];expect(()=>parseProject(bad)).toThrow();
  const snapshot=createPublicShare(p,{includeDimensions:false}).snapshot;snapshot.artworks[0].frameSettings=frameSettings as never;expect(()=>parsePublicShare(snapshot)).toThrow();
 }
 for(const preset of Object.values(framePresets))expect(parseFrameSettings(preset).widthMm).toBe(preset.widthMm);
 expect(parseFrameSettings({...settings,note:'PRIVATE',modelUrl:'evil'})).toEqual(settings);
});
it('spaces and constrains rotated outer edges, and mounts framing depth clear of either wall face',()=>{
 const p=createDemoProject();p.artworks=p.artworks.slice(0,2).map(a=>({...a,frameSettings:settings}));p.artworks[1].rotationDeg=90;
 const spaced=distributeArtworks(p,p.artworks.map(a=>a.id),100),[a,b]=spaced.artworks;
 expect(b.alongMm-rotatedArtworkOuterSize(b).widthMm/2-(a.alongMm+rotatedArtworkOuterSize(a).widthMm/2)).toBeCloseTo(100);
 expect(artworkWarnings({...a,centerHeightMm:680},p.walls[0])).toContain('작품이 바닥 아래로 내려갑니다.');
 const front=artworkPosition(a,p.walls[0]),back=artworkPosition({...a,wallSide:'back'},p.walls[0]);expect(front.z-p.walls[0].start.z).toBe(120);expect(back.z-p.walls[0].start.z).toBe(-120);
 expect(needsSurfaceEnvironment(p)).toBe(true);expect(needsSurfaceEnvironment({...p,artworks:p.artworks.map(a=>({...a,frame:'none'}))})).toBe(false);
});
it('retains settings through lock, Undo, Scene, unplaced storage and an asset backup without publicly copying notes',async()=>{
 const p=createDemoProject();p.artworks=p.artworks.slice(0,1);p.artworks[0].imageUrl='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=';
 const state=useEditor.getState();state.loadProject(p,true);useEditor.getState().patchArtwork(p.artworks[0].id,{frameSettings:settings});useEditor.getState().undo();expect(useEditor.getState().project.artworks[0].frameSettings).toBeUndefined();useEditor.getState().redo();useEditor.getState().saveScene('액자');
 useEditor.getState().patchArtwork(p.artworks[0].id,{frame:'none'});useEditor.getState().restoreScene('scene-1');const saved=useEditor.getState().project;expect(saved.artworks[0].frameSettings).toEqual(settings);
 expect(()=>updateArtwork({...saved,artworks:saved.artworks.map(a=>({...a,locked:true}))},p.artworks[0].id,{frameSettings:{...settings,widthMm:20}})).toThrow(/잠긴/);
 const removed=deleteSelection(saved,{type:'wall',id:p.walls[0].id});const restored=await importProjectPackage(await(await exportProjectPackage(removed,async()=>{throw new Error('No sample asset');})).arrayBuffer());expect(restored.unplacedArtworks![0].frameSettings).toEqual(settings);expect(restored.scenes[0].artworks[0].frameSettings).toEqual(settings);
 saved.artworks[0].note='PRIVATE';const snapshot=createPublicShare(saved,{includeDimensions:false,includeArtworkDetails:false}).snapshot;expect(parsePublicShare(snapshot).artworks[0].frameSettings).toEqual(settings);expect(JSON.stringify(snapshot)).not.toContain('PRIVATE');
});

it('starts a new framed artwork inside the wall edge and centers an oversized piece on a short wall',()=>{
 const p=createDemoProject(),added=addArtwork(p).artworks.at(-1)!;
 expect(added.alongMm).toBe(472.5);expect(artworkWarnings(added,p.walls[0])).toEqual([]);
 p.walls[0].end={x:p.walls[0].start.x+600,z:p.walls[0].start.z};
 const large=addArtwork(p).artworks.at(-1)!;expect(large.alongMm).toBe(300);expect(artworkWarnings(large,p.walls[0]).join(' ')).toMatch(/벽/);
});

it('reinstalls an unplaced framed work using its full outer dimensions',()=>{
 const p=createDemoProject();p.artworks[0].frameSettings=settings;p.artworks[0].alongMm=1;p.artworks[0].centerHeightMm=1;
 const removed=deleteSelection(p,{type:'wall',id:p.artworks[0].wallId}),placed=placeUnplacedArtwork(removed,p.artworks[0].id,'wall-b').artworks.at(-1)!;
 expect(placed.alongMm).toBe(540);expect(placed.centerHeightMm).toBe(690);expect(artworkWarnings(placed,p.walls[1])).toEqual([]);
});
