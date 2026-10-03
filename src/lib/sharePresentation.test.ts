import {expect,it,vi} from 'vitest';
import {materialPreset} from '../domain/materials';
import {createDemoProject} from '../domain/model';
import {sceneProject} from '../domain/sceneProject';
import {createPublicShare,parsePublicShare,publicImageIds,publicModelIds} from '../domain/publicShare';
import {prepareSharePresentation} from './sharePresentation';
import {publishPublicShare} from './shareClient';
import {testVenueModel} from './venueModelTestFixture';
const camera={position:[2,3,4] as [number,number,number],target:[0,0,0] as [number,number,number],zoom:40};
function fixture(){
 const p=createDemoProject();p.artworks=p.artworks.slice(0,1);
 const art=structuredClone(p.artworks[0]);art.name='Scene 작품';art.imageUrl='/scene-image.png';art.note='PRIVATE ART';
 p.scenes=[{id:'public-scene',name:'공개 Scene',cameraView:camera,artworks:[art],wallVisibility:{[p.walls[0].id]:true},structure:{walls:structuredClone(p.walls),openings:[],dimensions:[],unplacedArtworks:[],referenceModel:testVenueModel(),floorColor:'#ffffff'}}];
 p.scenes.push({id:'private-scene',name:'PRIVATE SCENE',artworks:[],wallVisibility:{}});
 p.scenes[0].structure!.walls[0].name='Scene 벽';p.scenes[0].structure!.walls[0].note='PRIVATE WALL';
 return p;
}
it('projects stored geometry and clears missing source models without changing the editor',()=>{
 const p=fixture();p.referenceModel=testVenueModel();p.importedFloor=[[{x:0,z:0},{x:1000,z:0},{x:1000,z:1000}]];
 const before=JSON.stringify(p),scene=p.scenes[0];delete scene.structure!.referenceModel;
 const detached=sceneProject(p,scene);
 expect(detached.walls[0].name).toBe('Scene 벽');expect(detached.artworks[0].name).toBe('Scene 작품');expect(detached.referenceModel).toBeUndefined();expect(detached.importedFloor).toBeUndefined();
 detached.artworks[0].name='mutation';expect(p.artworks[0].name).not.toBe('mutation');expect(p.scenes[0].artworks[0].name).toBe('Scene 작품');
 expect(JSON.parse(before).walls).toEqual(p.walls);
});
it('prepares only selected Scenes with their cameras and a global deduplicated asset map',async()=>{
 const p=fixture();p.scenes[0].structure!.walls[1].material={...materialPreset('wood').material,texture:{imageUrl:p.artworks[0].imageUrl,widthMm:1000,heightMm:1000}};
 p.artworks[0].imageUrl='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=';p.scenes[0].structure!.walls[1].material!.texture!.imageUrl=p.artworks[0].imageUrl;
 const before=JSON.stringify(p),result=await prepareSharePresentation(p,{includeDimensions:false,sceneIds:['public-scene','public-scene']},camera);
 expect(result.snapshot.scenes).toHaveLength(1);const s=result.snapshot.scenes![0];
 expect(s.snapshot.camera).toEqual(camera);expect(s.snapshot.walls[0].name).toBe('Scene 벽');expect(s.snapshot.artworks[0].imageId).toBe('1');expect(s.snapshot.walls[1].material?.texture?.imageId).toBe('0');
 expect(publicImageIds(result.snapshot)).toEqual(['0','1']);expect(publicModelIds(result.snapshot)).toHaveLength(1);expect(result.models.size).toBe(1);expect(result.uploads).toHaveLength(2);
 expect(result.snapshot.dimensions).toBeUndefined();expect(s.snapshot.dimensions).toBeUndefined();expect(JSON.stringify(result.snapshot)).not.toMatch(/PRIVATE|note|imageUrl|dataUrl|sourcePlan/);expect(JSON.stringify(p)).toBe(before);
});
it('does not publish Scenes by default, and validates selection before any network writes',async()=>{
 const p=fixture();expect((await prepareSharePresentation(p,{includeDimensions:false})).snapshot.scenes).toBeUndefined();
 const fetcher=vi.fn();await expect(publishPublicShare(p,{includeDimensions:false,sceneIds:['missing']},'owner',undefined,fetcher,'https://example.test')).rejects.toThrow(/Scene/);expect(fetcher).not.toHaveBeenCalled();
 await expect(prepareSharePresentation(p,{includeDimensions:false,sceneIds:Array.from({length:21},(_,i)=>String(i))})).rejects.toThrow(/20/);
 p.scenes[0].structure!.referenceModel!.dataUrl='invalid';await expect(publishPublicShare(p,{includeDimensions:false,sceneIds:['public-scene']},'owner',undefined,fetcher,'https://example.test')).rejects.toThrow(/모델 파일 데이터/);expect(fetcher).not.toHaveBeenCalled();
});
it('allowlists nested public geometry, permits shared image IDs, and rejects recursion and duplicate Scenes',()=>{
 const base=createPublicShare(createDemoProject(),{includeDimensions:false}).snapshot;
 const nested={...base,note:'PRIVATE',sourcePlan:'PRIVATE',artworks:base.artworks.map(a=>({...a,imageId:'9',note:'PRIVATE'}))};
 const raw={...base,scenes:[{id:'s',name:'설치안',privateNote:'PRIVATE',snapshot:nested}]};
 const parsed=parsePublicShare(raw);expect(JSON.stringify(parsed)).not.toContain('PRIVATE');expect(parsed.scenes![0].snapshot.artworks.every(a=>a.imageId==='9')).toBe(true);
 expect(()=>parsePublicShare({...raw,scenes:[...raw.scenes,...raw.scenes]})).toThrow(/중복/);
 expect(()=>parsePublicShare({...raw,scenes:[{...raw.scenes[0],snapshot:{...nested,scenes:[]}}]})).toThrow(/Scene/);
 expect(()=>parsePublicShare({...raw,scenes:[{...raw.scenes[0],snapshot:{...nested,camera:{...camera,zoom:NaN}}}]})).toThrow();
 expect(()=>parsePublicShare({...raw,scenes:Array.from({length:21},(_,i)=>({...raw.scenes[0],id:String(i)}))})).toThrow();
});
it('enforces publication-wide image and serialized UTF-8 limits across individually valid Scenes',()=>{
 const base=createPublicShare(createDemoProject(),{includeDimensions:false}).snapshot,template=base.artworks[0];
 const layout={...base,artworks:Array.from({length:500},(_,i)=>({...template,id:`art-${i}`,imageId:String(i)}))};
 const second={...layout,artworks:layout.artworks.map((a,i)=>({...a,imageId:String(i+500)}))};
 const third={...layout,artworks:layout.artworks.map((a,i)=>({...a,imageId:i===0?'1000':a.imageId}))};
 expect(()=>parsePublicShare({...layout,scenes:[{id:'s1',name:'one',snapshot:second},{id:'s2',name:'two',snapshot:third}]})).toThrow(/1,000/);
 const verbose={...layout,artworks:layout.artworks.map(a=>({...a,name:'가'.repeat(200),artist:'가'.repeat(200)}))};
 expect(()=>parsePublicShare({...verbose,scenes:[{id:'s1',name:'one',snapshot:verbose}]})).toThrow(/1MB/);
});
it('reuses identical model bytes across Scenes while keeping each Scene model assignment independent',async()=>{
 const p=fixture();p.referenceModel=testVenueModel();
 p.scenes[0].structure!.referenceModel!.positionMm=[3000,0,0];
 const same=await prepareSharePresentation(p,{includeDimensions:true,sceneIds:['public-scene']});
 expect(same.models.size).toBe(1);expect(same.snapshot.referenceModel!.modelId).toBe(same.snapshot.scenes![0].snapshot.referenceModel!.modelId);
 expect(same.snapshot.referenceModel!.positionMm).toEqual([0,0,0]);expect(same.snapshot.scenes![0].snapshot.referenceModel!.positionMm).toEqual([3000,0,0]);
 expect(same.snapshot.dimensions).toEqual([]);expect(same.snapshot.scenes![0].snapshot.dimensions).toEqual([]);
});
it('projects legacy Scenes with their saved artwork and wall visibility',()=>{
 const p=fixture();const scene={id:'old',name:'legacy',artworks:p.scenes[0].artworks,wallVisibility:{[p.walls[0].id]:false}};
 const detached=sceneProject(p,scene);expect(detached.walls[0].visible).toBe(false);expect(detached.walls[1].visible).toBe(p.walls[1].visible);expect(detached.artworks[0].name).toBe('Scene 작품');expect(detached.scenes).toEqual([]);
});
