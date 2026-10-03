import {expect,it} from 'vitest';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {Box3,Vector3} from 'three';
import {createDemoProject} from '../domain/model';
import {addModelArtwork} from '../domain/modelArtworks';
import {createPublicShare,parsePublicShare,publicModelIds} from '../domain/publicShare';
import {projectSpatialBounds,referenceModelFootprint} from '../domain/referenceModel';
import {testArtworkModel} from './modelArtworkTestFixture';
import {preparePublicModels} from './publicModelAsset';
import {placeReferenceModel,checkReferenceModelBounds} from './modelArtworkGeometry';
import {disposeModelAsset} from './modelAssetResources';

it('shares the venue model with its complete pose and deduplicates it with independent artworks',async()=>{
 const p=addModelArtwork(createDemoProject(),testArtworkModel()).project;p.referenceModel={...testArtworkModel(),name:'PRIVATE_FILE.glb',positionMm:[20000,300,15000],rotationDeg:90,scale:2};
 const assets=await preparePublicModels(p),{snapshot}=createPublicShare(p,{includeDimensions:true,modelAssetIds:assets.ids,referenceAssetId:assets.referenceId});
 expect(assets.uploads.size).toBe(1);expect(snapshot.referenceModel?.modelId).toBe(snapshot.modelArtworks![0].modelId);expect(publicModelIds(snapshot)).toHaveLength(1);
 expect(snapshot.referenceModel).toMatchObject({positionMm:[20000,300,15000],rotationDeg:90,scale:2,sizeMm:[1200,2100,900],sourceOffsetM:[-10,-2,-5]});expect(JSON.stringify(snapshot)).not.toMatch(/PRIVATE_FILE|dataUrl|visible|locked|note/);
 const model=snapshot.referenceModel!,gltf=await new GLTFLoader().parseAsync([...assets.uploads.values()][0],'');try{checkReferenceModelBounds(gltf.scene,model);const root=placeReferenceModel(model,gltf.scene),box=new Box3().setFromObject(root,true);expect(box.getSize(new Vector3()).toArray()).toEqual([expect.closeTo(1.8),expect.closeTo(4.2),expect.closeTo(2.4)]);expect(box.min.toArray()).toEqual([expect.closeTo(19.1),expect.closeTo(.3),expect.closeTo(13.8)]);}finally{disposeModelAsset(gltf.scenes);}
 const bounds=projectSpatialBounds(snapshot);expect(bounds.maxX).toBeCloseTo(20900);expect(bounds.maxZ).toBeCloseTo(16200);expect(bounds.maxY).toBe(4500);expect(referenceModelFootprint(model)).toHaveLength(4);
});
it('requires a prepared visible venue asset and excludes hidden venues completely',async()=>{
 const p=createDemoProject();p.referenceModel=testArtworkModel();expect(()=>createPublicShare(p,{includeDimensions:false})).toThrow('전시장');p.referenceModel.visible=false;const assets=await preparePublicModels(p);expect(assets.referenceId).toBeUndefined();expect(assets.uploads.size).toBe(0);expect(createPublicShare(p,{includeDimensions:false}).snapshot.referenceModel).toBeUndefined();
});
it('validates venue poses on the public boundary and drops private metadata',async()=>{
 const p=createDemoProject();p.referenceModel=testArtworkModel();const assets=await preparePublicModels(p),snapshot=createPublicShare(p,{includeDimensions:false,referenceAssetId:assets.referenceId}).snapshot;
 const dirty={...snapshot,referenceModel:{...snapshot.referenceModel,name:'PRIVATE_FILE',note:'SECRET',dataUrl:'SECRET',visible:true}};expect(JSON.stringify(parsePublicShare(dirty))).not.toMatch(/PRIVATE_FILE|SECRET|visible/);
 for(const patch of [{scale:0},{scale:101},{rotationDeg:181},{positionMm:[0,NaN,0]},{sourceOffsetM:[0,Infinity,0]},{sizeMm:[0,0,0]},{sizeMm:[-1,1,1]},{modelId:'../../secret'}])expect(()=>parsePublicShare({...snapshot,referenceModel:{...snapshot.referenceModel,...patch}})).toThrow();
});

it('preserves the complete venue geometry and real courtyard hole under rotation and scale',async()=>{
 const {testVenueModel}=await import('./venueModelTestFixture');const p=createDemoProject();p.walls=[];p.artworks=[];p.referenceModel={...testVenueModel(),positionMm:[1500,100,-500],rotationDeg:30,scale:1.2};const assets=await preparePublicModels(p),snapshot=createPublicShare(p,{includeDimensions:true,referenceAssetId:assets.referenceId}).snapshot,gltf=await new GLTFLoader().parseAsync([...assets.uploads.values()][0],'');
 try{checkReferenceModelBounds(gltf.scene,snapshot.referenceModel!);let meshes=0;gltf.scene.traverse(n=>{if('isMesh' in n)meshes++;});expect(meshes).toBe(15);const root=placeReferenceModel(snapshot.referenceModel!,gltf.scene),box=new Box3().setFromObject(root,true);expect(box.min.y).toBeCloseTo(.1);expect(box.max.y).toBeCloseTo(3.7);const {Raycaster}=await import('three');root.updateMatrixWorld(true);const center=new Vector3(10,2,5);center.applyMatrix4(root.children[0].matrixWorld);const ray=new Raycaster(new Vector3(center.x,10,center.z),new Vector3(0,-1,0));expect(ray.intersectObject(root,true)).toHaveLength(0);expect(snapshot.importedFloor).toBeUndefined();expect(snapshot.walls).toEqual([]);}finally{disposeModelAsset(gltf.scenes);}
});

it('supports flat reference geometry, but rejects zero-size venues and mismatched saved bounds',async()=>{
 const {artworkTestGltf}=await import('./modelArtworkTestFixture'),{packEmbeddedGltf}=await import('./artworkModelPayload'),{doc}=artworkTestGltf();const source=packEmbeddedGltf({...doc,nodes:[{mesh:0,translation:[10,2,5],scale:[2,0,3]}],scenes:[{nodes:[0]}]}),gltf=await new GLTFLoader().parseAsync(source,'');try{const flat={sizeMm:[2000,0,3000] as [number,number,number],sourceOffsetM:[-10,-2,-5] as [number,number,number]};expect(()=>checkReferenceModelBounds(gltf.scene,flat)).not.toThrow();expect(()=>checkReferenceModelBounds(gltf.scene,{...flat,sizeMm:[2001,0,3000]})).toThrow('일치하지');}finally{disposeModelAsset(gltf.scenes);}
});
