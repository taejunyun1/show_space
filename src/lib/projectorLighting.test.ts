import {expect,it} from 'vitest';
import {ShaderChunk,SpotLight,Texture,Vector3,Group} from 'three';
import {newLight,parseLight,parseLights,patchLight} from '../domain/lighting';
import {parseProjection,projectionGeometry,projectorDistance} from '../domain/projection';
import {createDemoProject,duplicateSelection,parseProject} from '../domain/model';
import {createLightObject,updateLightObject,sceneSpotShadowIds,createExportLighting,createBaseLighting,lightingProfileReady} from './sceneLighting';
import {applyProjectorMap,installProjectorShader,projectorFrame} from './projectorLighting';
import {prepareSharePresentation} from './sharePresentation';
import {parsePublicShare,publicImageIds} from '../domain/publicShare';
import {exportProjectPackage,importProjectPackage,projectImageUrls} from './projectPackage';
import {projectorTestFixture} from './projectorTestFixture';
import {PROJECTION_PATTERN} from '../domain/projectionPattern';

it('calibrates distance, throw ratio and aspect in millimetres and rejects unsafe settings',()=>{
 const p=projectorTestFixture(),l=p.lights![0],g=projectionGeometry({...l,projection:l.projection!});
 expect(g.distanceMm).toBe(3000);expect(g.widthMm).toBe(2000);expect(g.heightMm).toBe(1125);
 const position=projectorDistance(l,4500);expect(position).toEqual({x:3000,y:1500,z:4560});expect(l.target).toEqual({x:3000,y:1500,z:60});
 for(const patch of [{throwRatio:0},{aspectRatio:Infinity},{brightnessLumens:50001},{imageUrl:'https://private.invalid/image.png'},{fit:['contain']}])expect(()=>parseProjection({...l.projection,...patch})).toThrow();
 expect(()=>parseLight({...l,kind:'area'})).toThrow();expect(()=>parseLight({...l,target:{...l.position,z:l.position.z+99}})).toThrow();
 expect(parseLight({...l,projection:{...l.projection,secret:'PRIVATE'}}).projection).toEqual(l.projection);
 expect(()=>projectorDistance(l,0)).toThrow();
});

it('projects the rectangular calibrated image onto real spot matrices, with black outside and no white loading flash',()=>{
 installProjectorShader();installProjectorShader();expect(ShaderChunk.lights_fragment_begin).toContain('directLight.color * spotColor.rgb : vec3( 0.0 )');
 const p=projectorTestFixture(),l=p.lights![0],group=createLightObject('spot'),texture=new Texture();
 for(const data of [l,p.scenes[0].structure!.lights![0],{...l,projection:{...l.projection!,throwRatio:.3,aspectRatio:.5}}]){
  updateLightObject(group,data,true);applyProjectorMap(group,data,undefined);const spot=group.getObjectByName('emitter') as SpotLight;expect(spot.intensity).toBe(0);
  applyProjectorMap(group,data,texture);expect(spot.map).toBe(texture);expect(spot.castShadow).toBe(true);expect(spot.intensity).toBeGreaterThan(0);expect(spot.shadow.mapSize.toArray()).toEqual([1024,1024]);
  for(const [index,corner] of projectorFrame(data).slice(0,4).entries()){const uv=new Vector3(...corner).applyMatrix4(spot.shadow.matrix),expected=[[0,0],[1,0],[1,1],[0,1]][index];expect(uv.x).toBeCloseTo(expected[0],5);expect(uv.y).toBeCloseTo(expected[1],5);}
  const center=new Vector3(data.target.x/1000,data.target.y/1000,data.target.z/1000).applyMatrix4(spot.shadow.matrix);expect(center.x).toBeCloseTo(.5,5);expect(center.y).toBeCloseTo(.5,5);
 }
 updateLightObject(group,l,true);applyProjectorMap(group,{...l,projection:{...l.projection!,brightnessLumens:0}},texture);expect((group.getObjectByName('emitter') as SpotLight).intensity).toBe(0);
});

it('prioritises two projector occlusion maps, caps creation/duplication, and supports a model-only venue',()=>{
 const p=projectorTestFixture(),l=p.lights![0],second={...l,id:'second'};p.lights=[...Array.from({length:4},(_,i)=>({...newLight(createDemoProject(),'spot'),id:`spot-${i}`})),l,second];
 expect(sceneSpotShadowIds(p,2)).toEqual([l.id,'second']);expect(sceneSpotShadowIds(p,4)).toEqual([l.id,'second','spot-0','spot-1']);
 expect(()=>newLight(p,'projector')).toThrow(/2/);expect(()=>parseLights([l,second,{...l,id:'third'}])).toThrow(/2/);expect(()=>duplicateSelection(p,{type:'light',id:l.id})).toThrow(/2/);
 p.lights=[{...l,locked:true}];expect(()=>patchLight(p,l.id,{projection:{...l.projection!,throwRatio:2}})).toThrow(/잠긴/);
 const empty=createDemoProject();empty.artworks=[];empty.walls=[];expect(newLight(empty,'projector').target.y).toBe(0);expect(parseLight(newLight(empty,'spot')).position.y).toBeGreaterThan(0);
 const rig=createExportLighting(p);expect(rig.getObjectByName(`light-${l.id}`)).toBeUndefined();
});

it('preserves source pixels/settings in JSON/ZIP/Scenes and publishes only remapped image IDs',async()=>{
 const p=projectorTestFixture();p.scenes[0].structure!.lights![0].projection!.imageUrl='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
 const before=JSON.stringify(p),result=await prepareSharePresentation(p,{includeDimensions:false,sceneIds:[p.scenes[0].id]});
 expect(result.uploads).toHaveLength(2);expect(result.snapshot.lights![0].projection?.imageId).toBe('0');expect(result.snapshot.scenes![0].snapshot.lights![0].projection?.imageId).toBe('1');expect(publicImageIds(result.snapshot)).toEqual(['0','1']);expect(JSON.stringify(result.snapshot)).not.toMatch(/PRIVATE|imageUrl|data:|note|locked/);
 const clean=parsePublicShare({...result.snapshot,lights:result.snapshot.lights!.map(l=>({...l,projection:{...l.projection,imageUrl:'PRIVATE',note:'PRIVATE'}}))});expect(JSON.stringify(clean)).not.toContain('PRIVATE');
 for(const imageId of ['https://evil.test','../1','0000'])expect(()=>parsePublicShare({...result.snapshot,lights:result.snapshot.lights!.map(l=>({...l,projection:{...l.projection,imageId}}))})).toThrow();
 expect(projectImageUrls(p)).toContain(PROJECTION_PATTERN);
 const zip=await exportProjectPackage(p,async()=>{throw new Error('Unexpected external image');}),restored=await importProjectPackage(await zip.arrayBuffer());expect(restored).toEqual(p);expect(parseProject(JSON.parse(before))).toEqual(p);expect(JSON.stringify(p)).toBe(before);
});
it('waits for the actual latest projector source, exposure and pose before allowing a clean capture',()=>{
 const p=projectorTestFixture(),l=p.lights![0],scene=new Group(),group=createLightObject('spot'),profile={shadowBudget:4,spotShadowSize:1024,baseShadowSize:2048};scene.add(createBaseLighting(p.lighting,false,2048),group);
 updateLightObject(group,l,true);applyProjectorMap(group,l,undefined);expect(lightingProfileReady(scene,p,profile)).toBe(false);
 const texture=new Texture();applyProjectorMap(group,l,texture);expect(lightingProfileReady(scene,p,profile)).toBe(true);
 for(const next of [{...l,projection:{...l.projection!,brightnessLumens:2000}},{...l,position:{...l.position,x:3500}},{...l,projection:{...l.projection!,fit:'cover' as const}}]){
  expect(lightingProfileReady(scene,{...p,lights:[next]},profile)).toBe(false);applyProjectorMap(group,next,texture);expect(lightingProfileReady(scene,{...p,lights:[next]},profile)).toBe(true);applyProjectorMap(group,l,texture);
 }
 texture.dispose();
});
