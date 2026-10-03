import {describe,it,expect} from 'vitest';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {artworkTestGltf,testArtworkModel} from './modelArtworkTestFixture';
import {packEmbeddedGltf,inspectStaticArtworkGlb,modelDataUrl} from './artworkModelPayload';
import {preparePublicModels,publicModelBytes,publicModelHash} from './publicModelAsset';
import {modelAssetBounds,placeModelArtwork} from './modelArtworkGeometry';
import {disposeModelAsset} from './modelAssetResources';
import {addModelArtwork} from '../domain/modelArtworks';
import {createDemoProject} from '../domain/model';
import {createPublicShare,parsePublicShare} from '../domain/publicShare';
import {publicModelArtworkPose} from '../domain/publicModelArtwork';
import {Box3,Vector3} from 'three';

describe('public GLB sanitization and snapshot',()=>{
 it('removes every source name/extras/unknown metadata field and preserves actual geometry and PBR values',async()=>{
  const {doc}=artworkTestGltf(),privateDoc={...doc,privateNote:'SECRET_ROOT',asset:{...doc.asset,generator:'SECRET_GENERATOR',copyright:'SECRET_COPYRIGHT'},nodes:doc.nodes.map(n=>({...n,name:'SECRET_NODE',extras:{note:'SECRET_EXTRAS'}})),materials:doc.materials.map(m=>({...m,name:'SECRET_MATERIAL',privateNote:'SECRET_MATERIAL_NOTE',extras:{note:'SECRET_MATERIAL_EXTRAS'}}))};
  const bytes=publicModelBytes(packEmbeddedGltf(privateDoc)),parsed=inspectStaticArtworkGlb(bytes);expect(JSON.stringify(parsed)).not.toContain('SECRET');expect(parsed.asset).toEqual({version:'2.0'});expect(parsed.materials[0].pbrMetallicRoughness).toEqual(doc.materials[0].pbrMetallicRoughness);expect(new Uint8Array(publicModelBytes(bytes))).toEqual(new Uint8Array(bytes));
  const gltf=await new GLTFLoader().parseAsync(bytes,'');try{expect(modelAssetBounds(gltf.scene).sizeMm).toEqual([expect.closeTo(1200),expect.closeTo(2100),expect.closeTo(900)]);let meshes=0;gltf.scene.traverse(n=>{if('isMesh' in n)meshes++;});expect(meshes).toBe(3);}finally{disposeModelAsset(gltf.scenes);}
 });
 it('preserves embedded textures and UVs, including standard material extensions, without resampling',()=>{
  const {doc}=artworkTestGltf();const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=';const source={...doc,images:[{uri:'data:image/png;base64,'+png}],textures:[{source:0}],materials:[{...doc.materials[0],pbrMetallicRoughness:{...doc.materials[0].pbrMetallicRoughness,baseColorTexture:{index:0,extensions:{KHR_texture_transform:{offset:[.1,.2],rotation:.2,scale:[2,3],extras:{note:'SECRET'}}}}},extensions:{KHR_materials_clearcoat:{clearcoatFactor:.3,clearcoatTexture:{index:0,extras:{note:'SECRET'}},privateNote:'SECRET'}}}],extensionsUsed:['KHR_texture_transform','KHR_materials_clearcoat']};const b=publicModelBytes(packEmbeddedGltf(source)),parsed=inspectStaticArtworkGlb(b),v=parsed.bufferViews[parsed.images[0].bufferView],offset=28+new DataView(b).getUint32(12,true);expect(new Uint8Array(b,offset+v.byteOffset,v.byteLength)).toEqual(Uint8Array.from(atob(png),c=>c.charCodeAt(0)));expect(parsed.meshes[0].primitives[0].attributes.TEXCOORD_0).toBe(3);expect(parsed.materials[0].extensions.KHR_materials_clearcoat.clearcoatFactor).toBe(.3);expect(JSON.stringify(parsed)).not.toContain('SECRET');
 });
 it('deduplicates public assets, excludes hidden models and strips private snapshot fields while preserving physical poses',async()=>{
  const {project,artwork}=addModelArtwork(createDemoProject(),testArtworkModel());const a={...artwork,widthMm:2400,heightMm:1050,depthMm:450,position:{x:3000,y:100,z:-2000},rotation:{x:0,y:90,z:0},artist:'Test Artist',year:'2026',note:'PRIVATE_NOTE',groupId:'PRIVATE_GROUP',locked:true};project.modelArtworks=[a,{...a,id:'copy',position:{x:0,y:0,z:0}},{...a,id:'hidden',visible:false}];const models=await preparePublicModels(project);expect(models.uploads.size).toBe(1);expect(models.ids.size).toBe(2);const {snapshot}=createPublicShare(project,{includeDimensions:false,modelAssetIds:models.ids});expect(snapshot.modelArtworks).toHaveLength(2);expect(JSON.stringify(snapshot)).not.toMatch(/PRIVATE|dataUrl|sourceOffsetM.*PRIVATE/);expect(snapshot.modelArtworks![0].artist).toBe('Test Artist');expect(snapshot.dimensions).toBeUndefined();const malicious={...snapshot,modelArtworks:snapshot.modelArtworks!.map(a=>({...a,note:'SECRET',locked:false,model:{dataUrl:'SECRET'}}))};expect(JSON.stringify(parsePublicShare(malicious))).not.toContain('SECRET');
  const gltf=await new GLTFLoader().parseAsync([...models.uploads.values()][0],'');try{const root=placeModelArtwork(publicModelArtworkPose(snapshot.modelArtworks![0]),gltf.scene),size=new Box3().setFromObject(root,true).getSize(new Vector3());expect(size.toArray()).toEqual([expect.closeTo(.45),expect.closeTo(1.05),expect.closeTo(2.4)]);}finally{disposeModelAsset(gltf.scenes);}
 });
 it('rejects foreign asset IDs, invalid poses, duplicate entity IDs and invalid nonnumeric material properties',async()=>{
  const {project,artwork}=addModelArtwork(createDemoProject(),testArtworkModel()),models=await preparePublicModels(project),snapshot=createPublicShare(project,{includeDimensions:true,modelAssetIds:models.ids}).snapshot,a=snapshot.modelArtworks![0];for(const patch of [{modelId:'../../secret'},{rotation:{x:181,y:0,z:0}},{id:snapshot.walls[0].id},{sizeMm:[0,1,1]}])expect(()=>parsePublicShare({...snapshot,modelArtworks:[{...a,...patch}]})).toThrow();const {doc}=artworkTestGltf();expect(()=>publicModelBytes(packEmbeddedGltf({...doc,materials:[{pbrMetallicRoughness:{baseColorFactor:['PRIVATE']}}]}))).toThrow('숫자');const hash=await publicModelHash([...models.uploads.values()][0]);expect(hash).toMatch(/^[0-9a-f]{64}$/);expect(hash).toBe(models.ids.get(artwork.id));expect(modelDataUrl([...models.uploads.values()][0])).toContain('gltf-binary');
 });
});
