import {AmbientLight,Color,DirectionalLight,Group,HemisphereLight,Object3D,RectAreaLight,SpotLight,SRGBColorSpace,Vector3} from 'three';
import {RectAreaLightUniformsLib} from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import {DEFAULT_LIGHTING,kelvinRgb,spotShadowIds,type ExhibitionLight,type LightingSettings} from '../domain/lighting';
import {outdoorAppearance,type OutdoorSettings} from '../domain/outdoor';
import {projectSpatialBounds} from '../domain/referenceModel';
import type {Project,Point} from '../domain/types';
export type RenderLight=Omit<ExhibitionLight,'locked'|'note'>;
export interface LightingSource {lights?:RenderLight[];lighting?:LightingSettings;outdoor?:OutdoorSettings;walls?:Array<{start:Point;end:Point;heightMm:number;thicknessMm?:number}>;artworks?:Array<{widthMm:number;heightMm:number;depthMm:number;centerHeightMm:number}>;importedFloor?:Point[][];referenceModel?:Project['referenceModel'];modelArtworks?:Project['modelArtworks']}
let initialized=false;
export function createLightObject(kind:RenderLight['kind']){
 const group=new Group();group.name='light-object';const lamp=kind==='spot'?new SpotLight():new RectAreaLight();lamp.name='emitter';group.add(lamp);
 if(kind==='spot'){const target=new Object3D();target.name='aim';group.add(target);(lamp as SpotLight).target=target;}
 else if(!initialized){RectAreaLightUniformsLib.init();initialized=true;}
 return group;
}
export function updateLightObject(group:Group,data:RenderLight,castShadow:boolean){
 const lamp=group.getObjectByName('emitter') as SpotLight|RectAreaLight;group.name=`light-${data.id}`;group.visible=data.visible;
 lamp.color=new Color().setRGB(...kelvinRgb(data.kelvin),SRGBColorSpace);lamp.intensity=data.intensity;lamp.position.set(data.position.x/1000,data.position.y/1000,data.position.z/1000);
 if(lamp instanceof SpotLight){
  const target=lamp.target;target.position.set(data.target.x/1000,data.target.y/1000,data.target.z/1000);target.updateMatrixWorld(true);
  lamp.angle=data.beamDeg*Math.PI/360;lamp.penumbra=data.penumbra;lamp.distance=data.distanceMm/1000;lamp.decay=2;lamp.castShadow=castShadow;
  lamp.shadow.mapSize.set(1024,1024);lamp.shadow.bias=-.0001;lamp.shadow.normalBias=.015;lamp.shadow.camera.near=.02;lamp.shadow.camera.far=Math.max(.03,lamp.distance||Math.max(20,lamp.position.distanceTo(target.position)*4));lamp.shadow.needsUpdate=true;
 }else{lamp.width=data.widthMm/1000;lamp.height=data.heightMm/1000;lamp.lookAt(data.target.x/1000,data.target.y/1000,data.target.z/1000);}
 group.updateMatrixWorld(true);
}
export function createBaseLighting(settings:LightingSettings=DEFAULT_LIGHTING,legacyShadow=true){
 const group=new Group();group.name='base-lighting';const ambient=new AmbientLight(0xffffff,settings.ambient),hemisphere=new HemisphereLight(0xffffff,0xcad0d6,settings.hemisphere),fill=new DirectionalLight(0xffffff,settings.fill);fill.position.set(-3,12,6);fill.castShadow=legacyShadow&&settings.fill>0;fill.shadow.mapSize.set(2048,2048);Object.assign(fill.shadow.camera,{left:-12,right:12,top:12,bottom:-12});fill.shadow.bias=-.001;group.add(ambient,hemisphere,fill);return group;
}
export function createOutdoorLighting(source:LightingSource,base=true){
 const group=new Group();group.name='outdoor-lighting';const appearance=outdoorAppearance(source.outdoor);if(!appearance)return group;
 if(base)group.add(new AmbientLight(0xffffff,appearance.ambient),new HemisphereLight(0xc5deff,0x757064,appearance.hemisphere));
 if(appearance.sunIntensity<=0)return group;
 const bounds=projectSpatialBounds({walls:source.walls??[],importedFloor:source.importedFloor,referenceModel:source.referenceModel,modelArtworks:source.modelArtworks});
 const min=new Vector3(bounds.minX/1000,bounds.minY/1000,bounds.minZ/1000),max=new Vector3(bounds.maxX/1000,bounds.maxY/1000,bounds.maxZ/1000),center=min.clone().add(max).multiplyScalar(.5);
 const margin=Math.max(.5,...(source.walls??[]).map(w=>(w.thicknessMm??0)/1000),...(source.artworks??[]).map(a=>Math.max(a.widthMm,a.heightMm,a.depthMm,Math.abs(a.centerHeightMm))/1000));
 const radius=Math.max(2,max.distanceTo(min)/2+margin),target=new Object3D();target.name='sun-aim';target.position.copy(center);
 const sun=new DirectionalLight(new Color().setRGB(...kelvinRgb(appearance.sunKelvin),SRGBColorSpace),appearance.sunIntensity);sun.name='outdoor-sun';sun.target=target;sun.position.copy(center).add(new Vector3(...appearance.sun.direction).multiplyScalar(radius*2));sun.castShadow=source.outdoor!.shadow;
 sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.0001;sun.shadow.normalBias=.02;Object.assign(sun.shadow.camera,{left:-radius,right:radius,top:radius,bottom:-radius,near:.02,far:radius*4});sun.shadow.camera.updateProjectionMatrix();
 group.add(sun,target);group.updateMatrixWorld(true);return group;
}
export function sceneSpotShadowIds(source:LightingSource){const outdoor=outdoorAppearance(source.outdoor);return spotShadowIds(source.lights??[]).slice(0,outdoor&&outdoor.sunIntensity>0&&source.outdoor?.shadow?3:4);}
export function createSceneLighting(source:LightingSource,{base=true,area=true}={}){
 const group=new Group();group.name='gonggan-lighting';const visible=(source.lights??[]).filter(l=>l.visible),shadows=new Set(sceneSpotShadowIds(source));
 if(source.outdoor?.mode==='outdoor')group.add(createOutdoorLighting(source,base));
 else if(base)group.add(createBaseLighting(source.lighting,visible.length===0));
 for(const data of visible){if(data.kind==='area'&&!area)continue;const object=createLightObject(data.kind);updateLightObject(object,data,shadows.has(data.id));group.add(object);}
 return group;
}
export function disposeLighting(object:Object3D){object.traverse(o=>{if(o instanceof SpotLight||o instanceof DirectionalLight)o.shadow.dispose();});}
/** glTF stores local -Z direction rather than Three's independent target object. */
export function createExportLighting(source:LightingSource){
 const rig=createSceneLighting(source,{base:false,area:false});rig.updateMatrixWorld(true);
 const lights:Array<SpotLight|DirectionalLight>=[];rig.traverse(object=>{if(object instanceof SpotLight||object instanceof DirectionalLight)lights.push(object);});
 for(const object of lights){const target=object.target,aim=target.getWorldPosition(new Vector3());object.lookAt(aim);target.removeFromParent();target.position.set(0,0,-1);object.add(target);}
 rig.updateMatrixWorld(true);return rig;
}
