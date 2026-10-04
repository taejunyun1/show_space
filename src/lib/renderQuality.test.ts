import {expect,it,vi} from 'vitest';
import {Group,SpotLight,WebGLRenderTarget} from 'three';
import {renderProfile} from './renderQuality';
import {createBaseLighting,createOutdoorLighting,createLightObject,lightingProfileReady,sceneSpotShadowIds,updateLightObject} from './sceneLighting';
import {createDemoProject} from '../domain/model';
import {newLight} from '../domain/lighting';
import {DEFAULT_OUTDOOR} from '../domain/outdoor';

it('budgets fast editing separately while captures always use preview lighting',()=>{
 const p=createDemoProject(),light=newLight(p,'spot');p.lights=Array.from({length:20},(_,i)=>({...light,id:`s${i}`}));const before=structuredClone(p);
 expect(sceneSpotShadowIds(p,renderProfile('edit').shadowBudget)).toHaveLength(2);
 expect(sceneSpotShadowIds(p,renderProfile('preview').shadowBudget)).toHaveLength(4);
 expect(renderProfile('edit',true)).toEqual(renderProfile('preview'));
 expect(renderProfile('edit').maxDpr).toBe(1);expect(p).toEqual(before);
 p.outdoor={...DEFAULT_OUTDOOR,mode:'outdoor'};expect(sceneSpotShadowIds(p,2)).toHaveLength(1);
 p.outdoor.time='23:00';expect(sceneSpotShadowIds(p,2)).toHaveLength(2);
});
it('releases obsolete shadow render targets when resizing or dropping a caster',()=>{
 const data=newLight(createDemoProject(),'spot'),group=createLightObject('spot'),lamp=group.getObjectByName('emitter') as SpotLight;
 updateLightObject(group,data,true,512);lamp.shadow.map=new WebGLRenderTarget(512,512);const old=lamp.shadow.map,disposed=vi.spyOn(old,'dispose');
 updateLightObject(group,data,true,1024);expect(disposed).toHaveBeenCalledOnce();expect(lamp.shadow.map).toBeNull();expect(lamp.shadow.mapSize.toArray()).toEqual([1024,1024]);
 lamp.shadow.map=new WebGLRenderTarget(1024,1024);const next=vi.spyOn(lamp.shadow.map,'dispose');updateLightObject(group,data,false,512);expect(next).toHaveBeenCalledOnce();expect(lamp.castShadow).toBe(false);expect(lamp.shadow.map).toBeNull();
 expect(lamp.intensity).toBe(data.intensity);expect(lamp.position.toArray()).toEqual([data.position.x/1000,data.position.y/1000,data.position.z/1000]);
});

it('does not capture while the actual rig still has edit shadow settings',()=>{
 const p=createDemoProject(),light=newLight(p,'spot');p.lights=Array.from({length:5},(_,i)=>({...light,id:`s${i}`}));const scene=new Group();const edit=renderProfile('edit'),preview=renderProfile('preview');
 scene.add(createBaseLighting(p.lighting,false,edit.baseShadowSize));
 for(const data of p.lights){const g=createLightObject('spot');updateLightObject(g,data,sceneSpotShadowIds(p,2).includes(data.id),512);scene.add(g);}
 expect(lightingProfileReady(scene,p,preview)).toBe(false);scene.getObjectByName('base-lighting')!.removeFromParent();scene.add(createBaseLighting(p.lighting,false,2048));
 expect(lightingProfileReady(scene,p,preview)).toBe(false);
 for(const data of p.lights)updateLightObject(scene.getObjectByName(`light-${data.id}`) as Group,data,sceneSpotShadowIds(p,4).includes(data.id),1024);
 expect(lightingProfileReady(scene,p,preview)).toBe(true);
 scene.getObjectByName('light-s3')!.removeFromParent();expect(lightingProfileReady(scene,p,preview)).toBe(false);
});

it('waits for removal of an outdated daytime sun when capturing a nighttime scene',()=>{
 const p=createDemoProject();p.outdoor={...DEFAULT_OUTDOOR,mode:'outdoor'};const scene=new Group();scene.add(createOutdoorLighting(p));
 expect(lightingProfileReady(scene,p,renderProfile('preview'))).toBe(true);
 p.outdoor.time='23:00';expect(lightingProfileReady(scene,p,renderProfile('preview'))).toBe(false);
 scene.getObjectByName('outdoor-lighting')!.removeFromParent();scene.add(createOutdoorLighting(p));expect(lightingProfileReady(scene,p,renderProfile('preview'))).toBe(true);
});
