import {describe,it,expect} from 'vitest';
import {Box3,Vector3} from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {createDemoProject,parseProject,duplicateSelection,deleteSelection,addWall} from './model';
import {addModelArtwork,parseModelArtwork,patchModelArtwork,groupModelArtworks,transformModelArtworks,modelArtworkBounds,modelArtworkFootprint} from './modelArtworks';
import {artworkTestGlb,testArtworkModel} from '../lib/modelArtworkTestFixture';
import {modelAssetBounds,placeModelArtwork,checkModelArtworkBounds} from '../lib/modelArtworkGeometry';
import {disposeModelAsset} from '../lib/modelAssetResources';
import {projectSpatialBounds} from './referenceModel';
import {createPublicShare} from './publicShare';
describe('physical 3D artwork',()=>{
 it('normalizes a real multipart model to its bottom centre and respects numeric sizes and XYZ rotation',async()=>{
  const gltf=await new GLTFLoader().parseAsync(artworkTestGlb(),'');
  try{const source=modelAssetBounds(gltf.scene);expect(source.sizeMm).toEqual([expect.closeTo(1200),expect.closeTo(2100),expect.closeTo(900)]);expect(source.sourceOffsetM).toEqual([-10,expect.closeTo(-2),-5]);const a=addModelArtwork(createDemoProject(),testArtworkModel()).artwork;a.widthMm=2400;a.heightMm=1050;a.depthMm=450;a.position={x:3000,y:100,z:-2000};a.rotation={x:0,y:90,z:0};const root=placeModelArtwork(a,gltf.scene),size=new Box3().setFromObject(root,true).getSize(new Vector3());expect(size.toArray()).toEqual([expect.closeTo(.45),expect.closeTo(1.05),expect.closeTo(2.4)]);expect(new Box3().setFromObject(root,true).min.y).toBeCloseTo(.1);expect(modelArtworkBounds(a)).toEqual({minX:expect.closeTo(2775),maxX:expect.closeTo(3225),minY:expect.closeTo(100),maxY:expect.closeTo(1150),minZ:expect.closeTo(-3200),maxZ:expect.closeTo(-800)});expect(checkModelArtworkBounds(gltf.scene,a.model)).toBeUndefined();expect(()=>checkModelArtworkBounds(gltf.scene,{...a.model,sizeMm:[100,100,100]})).toThrow('일치');}finally{disposeModelAsset(gltf.scenes);}
 });
 it('preserves independent model entities, metadata, groups, Scene snapshots and old schema compatibility',()=>{
  const original=createDemoProject(),{project,artwork}=addModelArtwork(original,testArtworkModel());const parsed=parseProject(project);expect(original.modelArtworks).toBeUndefined();expect(parsed.modelArtworks?.[0]).toEqual(artwork);expect(parseProject(original).modelArtworks).toBeUndefined();
  const scene={id:'s',name:'3D scene',artworks:project.artworks,wallVisibility:{},structure:{walls:project.walls,openings:[],dimensions:[],unplacedArtworks:[],modelArtworks:[artwork]}};expect(parseProject({...project,scenes:[scene]}).scenes[0].structure?.modelArtworks?.[0]).toEqual(artwork);
  expect(()=>parseProject({...project,modelArtworks:[{...artwork,id:project.walls[0].id}]})).toThrow('중복');expect(()=>parseProject({...project,scenes:[{...scene,structure:{...scene.structure,modelArtworks:[{...artwork,id:project.artworks[0].id}]}}]})).toThrow('중복');
  expect(()=>parseModelArtwork({...artwork,widthMm:0})).toThrow('크기');expect(()=>parseModelArtwork({...artwork,rotation:{x:NaN,y:0,z:0}})).toThrow('회전');
 });
 it('duplicates and deletes models without altering image artwork or locked originals',()=>{
  const {project,artwork}=addModelArtwork(createDemoProject(),testArtworkModel()),duplicate=duplicateSelection(project,{type:'modelArtwork',id:artwork.id});expect(duplicate.project.modelArtworks).toHaveLength(2);expect(duplicate.project.modelArtworks![1].position.x).toBe(400);expect(duplicate.project.modelArtworks![1].model).toEqual(artwork.model);expect(deleteSelection(duplicate.project,duplicate.selection).modelArtworks).toHaveLength(1);
  const locked=patchModelArtwork(project,artwork.id,{locked:true});expect(()=>patchModelArtwork(locked,artwork.id,{widthMm:500})).toThrow('잠긴');expect(()=>deleteSelection(locked,{type:'modelArtwork',id:artwork.id})).toThrow('잠긴');expect(patchModelArtwork(locked,artwork.id,{note:'메모'}).modelArtworks![0].note).toBe('메모');expect(project.artworks).toEqual(duplicate.project.artworks);
  const idCollision={...project,modelArtworks:[{...artwork,id:'wall-1'}]};expect(addWall(idCollision).walls.at(-1)?.id).not.toBe('wall-1');
 });
 it('applies a world transform to a group with spacing and dimensions preserved and refuses locked members',()=>{
  const first=addModelArtwork(createDemoProject(),testArtworkModel()),copy=duplicateSelection(first.project,{type:'modelArtwork',id:first.artwork.id}),ids=copy.project.modelArtworks!.map(a=>a.id),group=groupModelArtworks(copy.project,ids);const moved=transformModelArtworks(group,ids,ids[0],{x:1000,y:0,z:0},{x:0,y:90,z:0});expect(moved.modelArtworks![1].position.x).toBeCloseTo(1000);expect(moved.modelArtworks![1].position.z).toBeCloseTo(-400);expect(moved.modelArtworks![1].widthMm).toBe(1200);expect(moved.modelArtworks![0].groupId).toBe(moved.modelArtworks![1].groupId);expect(()=>transformModelArtworks(patchModelArtwork(group,ids[1],{locked:true}),ids,ids[0],{x:0,y:0,z:0},{x:0,y:0,z:0})).toThrow('잠긴');
 });
 it('fits far-away and tipped sculptures and prevents silent loss from public sharing',()=>{
  const {project,artwork}=addModelArtwork(createDemoProject(),testArtworkModel()),a={...artwork,position:{x:50000,y:0,z:50000},rotation:{x:45,y:30,z:20}};const p={...project,modelArtworks:[a]},b=projectSpatialBounds(p),corners=modelArtworkFootprint(a);expect(corners.length).toBeGreaterThanOrEqual(4);expect(b.maxX).toBeGreaterThan(50000);expect(b.maxY).toBeGreaterThan(0);expect(()=>createPublicShare(p,{includeDimensions:false})).toThrow('3D 작품');expect(()=>createPublicShare({...p,modelArtworks:[{...a,visible:false}]},{includeDimensions:false})).not.toThrow();
 });
});
