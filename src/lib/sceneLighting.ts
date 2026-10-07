import type {ProjectionScalars} from '../domain/projection';
import {projectorMapReady} from './projectorLighting';
import {AmbientLight,Color,DirectionalLight,Group,HemisphereLight,Object3D,RectAreaLight,SpotLight,SRGBColorSpace,Vector3} from 'three';
import {RectAreaLightUniformsLib} from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import {DEFAULT_LIGHTING,kelvinRgb,spotShadowIds,type ExhibitionLight,type LightingSettings} from '../domain/lighting';
import {outdoorAppearance,type OutdoorSettings} from '../domain/outdoor';
import {projectSpatialBounds} from '../domain/referenceModel';
import type {Point} from '../domain/types';
export type RenderLight=Omit<ExhibitionLight,'locked'|'note'|'projection'>&{projection?:ProjectionScalars&{imageUrl?:string;imageId?:string}};
export interface LightingSource {lights?:RenderLight[];lighting?:LightingSettings;outdoor?:OutdoorSettings;walls?:Array<{start:Point;end:Point;heightMm:number;thicknessMm?:number}>;artworks?:Array<{widthMm:number;heightMm:number;depthMm:number;centerHeightMm:number}>;importedFloor?:Point[][];referenceModel?:Parameters<typeof projectSpatialBounds>[0]['referenceModel'];modelArtworks?:Parameters<typeof projectSpatialBounds>[0]['modelArtworks']}
let initialized=false;
export function createLightObject(kind:RenderLight['kind']){
 const group=new Group();group.name='light-object';const lamp=kind==='spot'?new SpotLight():new RectAreaLight();lamp.name='emitter';group.add(lamp);
 if(kind==='spot'){const target=new Object3D();target.name='aim';group.add(target);(lamp as SpotLight).target=target;}
 else if(!initialized){RectAreaLightUniformsLib.init();initialized=true;}
 return group;
}
export function updateLightObject(group:Group,data:RenderLight,castShadow:boolean,shadowSize=1024){
 const lamp=group.getObjectByName('emitter') as SpotLight|RectAreaLight;group.name=`light-${data.id}`;group.visible=data.visible;
 lamp.color=new Color().setRGB(...kelvinRgb(data.kelvin),SRGBColorSpace);lamp.intensity=data.intensity;lamp.position.set(data.position.x/1000,data.position.y/1000,data.position.z/1000);
 if(lamp instanceof SpotLight){
  const target=lamp.target;target.position.set(data.target.x/1000,data.target.y/1000,data.target.z/1000);target.updateMatrixWorld(true);
  if(!castShadow||lamp.shadow.mapSize.x!==shadowSize){lamp.shadow.dispose();lamp.shadow.map=null;lamp.shadow.mapPass=null;}
  lamp.shadow.focus=1;lamp.shadow.aspect=1;lamp.shadow.camera.up.set(0,1,0);lamp.map=null;
  lamp.angle=data.beamDeg*Math.PI/360;lamp.penumbra=data.penumbra;lamp.distance=data.distanceMm/1000;lamp.decay=2;lamp.castShadow=castShadow;
  lamp.shadow.mapSize.set(shadowSize,shadowSize);lamp.shadow.bias=-.0001;lamp.shadow.normalBias=.015;lamp.shadow.camera.near=.02;lamp.shadow.camera.far=Math.max(.03,lamp.distance||Math.max(20,lamp.position.distanceTo(target.position)*4));lamp.shadow.needsUpdate=true;
 }else{lamp.width=data.widthMm/1000;lamp.height=data.heightMm/1000;lamp.lookAt(data.target.x/1000,data.target.y/1000,data.target.z/1000);}
 group.updateMatrixWorld(true);
}
export function createBaseLighting(settings:LightingSettings=DEFAULT_LIGHTING,legacyShadow=true,shadowSize=2048){
 const group=new Group();group.name='base-lighting';const ambient=new AmbientLight(0xffffff,settings.ambient),hemisphere=new HemisphereLight(0xffffff,0xcad0d6,settings.hemisphere),fill=new DirectionalLight(0xffffff,settings.fill);fill.position.set(-3,12,6);fill.castShadow=legacyShadow&&settings.fill>0;fill.shadow.mapSize.set(shadowSize,shadowSize);Object.assign(fill.shadow.camera,{left:-12,right:12,top:12,bottom:-12});fill.shadow.bias=-.001;group.add(ambient,hemisphere,fill);return group;
}
export function createOutdoorLighting(source:LightingSource,base=true,shadowSize=2048){
 const group=new Group();group.name='outdoor-lighting';const appearance=outdoorAppearance(source.outdoor);if(!appearance)return group;
 if(base)group.add(new AmbientLight(0xffffff,appearance.ambient),new HemisphereLight(0xc5deff,0x757064,appearance.hemisphere));
 if(appearance.sunIntensity<=0)return group;
 const bounds=projectSpatialBounds({walls:source.walls??[],importedFloor:source.importedFloor,referenceModel:source.referenceModel,modelArtworks:source.modelArtworks});
 const min=new Vector3(bounds.minX/1000,bounds.minY/1000,bounds.minZ/1000),max=new Vector3(bounds.maxX/1000,bounds.maxY/1000,bounds.maxZ/1000),center=min.clone().add(max).multiplyScalar(.5);
 const margin=Math.max(.5,...(source.walls??[]).map(w=>(w.thicknessMm??0)/1000),...(source.artworks??[]).map(a=>Math.max(a.widthMm,a.heightMm,a.depthMm,Math.abs(a.centerHeightMm))/1000));
 const radius=Math.max(2,max.distanceTo(min)/2+margin),target=new Object3D();target.name='sun-aim';target.position.copy(center);
 const sun=new DirectionalLight(new Color().setRGB(...kelvinRgb(appearance.sunKelvin),SRGBColorSpace),appearance.sunIntensity);sun.name='outdoor-sun';sun.target=target;sun.position.copy(center).add(new Vector3(...appearance.sun.direction).multiplyScalar(radius*2));sun.castShadow=source.outdoor!.shadow;
 sun.shadow.mapSize.set(shadowSize,shadowSize);sun.shadow.bias=-.0001;sun.shadow.normalBias=.02;Object.assign(sun.shadow.camera,{left:-radius,right:radius,top:radius,bottom:-radius,near:.02,far:radius*4});sun.shadow.camera.updateProjectionMatrix();
 group.add(sun,target);group.updateMatrixWorld(true);return group;
}
export function sceneSpotShadowIds(source:LightingSource,budget=4){const outdoor=outdoorAppearance(source.outdoor),sun=outdoor&&outdoor.sunIntensity>0&&source.outdoor?.shadow?1:0,projectors=(source.lights??[]).filter(l=>l.visible&&l.projection&&l.projection.brightnessLumens>0).length;return spotShadowIds(source.lights??[]).slice(0,Math.max(0,Math.min(4,Math.max(budget,projectors+sun))-sun));}
/** DOM and R3F commit independently; export must wait for the actual preview rig. */
export function lightingProfileReady(scene:Object3D,source:LightingSource,profile:{shadowBudget:number;spotShadowSize:number;baseShadowSize:number}){
 let projectorsReady=true;for(const light of source.lights??[])if(!projectorMapReady(scene,light))projectorsReady=false;
 if(!projectorsReady)return false;
 const base=scene.getObjectByName(source.outdoor?.mode==='outdoor'?'outdoor-lighting':'base-lighting');if(!base)return false;
 if(source.outdoor?.mode==='outdoor'){const appearance=outdoorAppearance(source.outdoor)!,sun=base.getObjectByName('outdoor-sun');if((appearance.sunIntensity>0)!==(sun instanceof DirectionalLight))return false;if(sun instanceof DirectionalLight&&(sun.intensity!==appearance.sunIntensity||sun.castShadow!==source.outdoor.shadow))return false;}
 let baseReady=true;base.traverse(o=>{if(o instanceof DirectionalLight&&o.shadow.mapSize.x!==profile.baseShadowSize)baseReady=false;});if(!baseReady)return false;
 const shadowIds=new Set(sceneSpotShadowIds(source,profile.shadowBudget));
 return (source.lights??[]).filter(l=>l.visible).every(l=>{const object=scene.getObjectByName(`light-${l.id}`),lamp=object?.getObjectByName('emitter');return l.kind==='area'?lamp instanceof RectAreaLight:lamp instanceof SpotLight&&lamp.castShadow===shadowIds.has(l.id)&&lamp.shadow.mapSize.x===profile.spotShadowSize;});
}
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
 const rig=createSceneLighting({...source,lights:source.lights?.filter(l=>!l.projection)},{base:false,area:false});rig.updateMatrixWorld(true);
 const lights:Array<SpotLight|DirectionalLight>=[];rig.traverse(object=>{if(object instanceof SpotLight||object instanceof DirectionalLight)lights.push(object);});
 for(const object of lights){const target=object.target,aim=target.getWorldPosition(new Vector3());object.lookAt(aim);target.removeFromParent();target.position.set(0,0,-1);object.add(target);}
 rig.updateMatrixWorld(true);return rig;
}
