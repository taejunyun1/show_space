import {expect,it} from 'vitest';
import {createPublicShare} from './publicShare';
import {createDemoProject} from './model';
import {presentationLayout,adjacentPresentationScene} from './presentation';
import {materialPreset} from './materials';
import {appendTimeComparisonScenes,DEFAULT_COMPARISON_TIMES} from './timeComparison';
import {addModelArtwork} from './modelArtworks';
import {testArtworkModel} from '../lib/modelArtworkTestFixture';

it('keeps complete current/Scene layouts detached, excludes private notes, and maps each local image without publishing',()=>{
 let p=createDemoProject();p.walls[0].material={...materialPreset('wood').material,texture:{imageUrl:'data:image/png;base64,YQ==',widthMm:2000,heightMm:1000}};
 p.artworks[0]={...p.artworks[0],artist:'Artist',year:'2026',medium:'Photo',description:'Artwork description',note:'SECRET_INSTALLATION'};
 p=appendTimeComparisonScenes(p,p,{sceneId:'',date:'2026-07-21',times:DEFAULT_COMPARISON_TIMES,occurrence:'earlier'});
 p.walls[0].color='#123456';p.artworks[0].alongMm=2300;p.artworks[0].imageUrl='data:image/png;base64,Yg==';
 p.walls[0].material!.texture!.imageUrl='data:image/png;base64,Yw==';
 const original=structuredClone(p),camera={position:[-9,10,13] as [number,number,number],target:[0,1,0] as [number,number,number],zoom:65};
 const current=presentationLayout(p,null,camera),saved=presentationLayout(p,p.scenes[0].id,camera);
 expect(current.snapshot.camera).toEqual(camera);expect(saved.snapshot.camera).toBeUndefined();
 expect(current.snapshot.walls[0].color).toBe('#123456');expect(saved.snapshot.walls[0].color).not.toBe('#123456');
 expect(current.snapshot.artworks[0].alongMm).toBe(2300);expect(saved.snapshot.artworks[0].alongMm).not.toBe(2300);
 expect(current.images.get(current.snapshot.artworks[0].imageId)).toBe(p.artworks[0].imageUrl);
 expect(saved.images.get(saved.snapshot.floorMaterial?.texture?.imageId??saved.snapshot.walls[0].material!.texture!.imageId)).toBe('data:image/png;base64,YQ==');
 expect(current.images.get(current.snapshot.walls[0].material!.texture!.imageId)).toBe('data:image/png;base64,Yw==');
 expect(current.snapshot.artworks[0]).toMatchObject({artist:'Artist',year:'2026',medium:'Photo',description:'Artwork description'});
 expect(saved.snapshot.outdoor?.time).toBe('09:00');
 expect(JSON.stringify(current.snapshot)).not.toContain('SECRET');expect(current.snapshot.dimensions).toEqual([]);
 current.snapshot.walls[0].start.x=99999;current.snapshot.artworks[0].name='presentation only';expect(p).toEqual(original);
});
it('retains every saved Scene for local navigation beyond the public selected-Scene limit and uses authored cameras',()=>{
 const p=createDemoProject();p.scenes=Array.from({length:30},(_,i)=>({id:'s'+i,name:'Scene '+i,artworks:structuredClone(p.artworks),wallVisibility:{},cameraView:{position:[i+5,10,15],target:[0,1,0],zoom:50}}));
 const original=structuredClone(p),layout=presentationLayout(p,'s29');expect(layout.snapshot.camera).toEqual(p.scenes[29].cameraView);layout.snapshot.camera!.position[0]=999;expect(p).toEqual(original);
 expect(adjacentPresentationScene(p.scenes.map(s=>s.id),'s28',1)).toBe('s29');
 expect(adjacentPresentationScene(p.scenes.map(s=>s.id),'s29',1)).toBe('s29');
 expect(adjacentPresentationScene([],null,1)).toBeNull();expect(adjacentPresentationScene(['a','b'],null,-1)).toBeNull();
 expect(adjacentPresentationScene(['a','b'],null,1)).toBe('a');expect(adjacentPresentationScene(['a','b'],'a',-1)).toBeNull();
 expect(()=>presentationLayout(p,'missing')).toThrow(/Scene/);
});
it('retains independent model poses and shared local bytes while excluding hidden models',()=>{
 const {project:p,artwork:a}=addModelArtwork(createDemoProject(),testArtworkModel());
 p.referenceModel=testArtworkModel();
 p.modelArtworks=[{...a,position:{x:2400,y:100,z:3000},rotation:{x:0,y:45,z:0},note:'PRIVATE'}, {...a,id:'copy'}, {...a,id:'hidden',visible:false}];
 const local=presentationLayout(p,null);
 expect(local.models.size).toBe(1);expect(local.models.get(local.snapshot.referenceModel!.modelId)).toBe(a.model.dataUrl);expect(local.snapshot.modelArtworks).toHaveLength(2);
 expect(local.snapshot.modelArtworks![0]).toMatchObject({position:{x:2400,y:100,z:3000},rotation:{x:0,y:45,z:0}});
 expect(local.models.get(local.snapshot.modelArtworks![0].modelId)).toBe(a.model.dataUrl);
 expect(JSON.stringify(local.snapshot)).not.toMatch(/PRIVATE|dataUrl/);
});
it('rejects uncalibrated 3D without modifying the imported plan or current project',()=>{
 const p=createDemoProject();p.planDraft={kind:'partial',sourceEvidenceHash:'fixture',originalWalls:structuredClone(p.walls)};const original=structuredClone(p);
 expect(()=>presentationLayout(p,null)).toThrow(/축척/);expect(p).toEqual(original);
});

it('can present the editor artwork capacity without applying the remote publication byte limit',()=>{
 const p=createDemoProject(),art=p.artworks[0];
 p.artworks=Array.from({length:500},(_,i)=>({...art,id:'a'+i,description:'한'.repeat(2000)}));
 expect(presentationLayout(p,null).snapshot.artworks).toHaveLength(500);
 expect(()=>createPublicShare(p,{includeDimensions:true,includeArtworkDetails:true})).toThrow(/1MB/);
});
