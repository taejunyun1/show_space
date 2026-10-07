import {ShaderChunk,SpotLight,Texture,Vector3,PerspectiveCamera,CanvasTexture,SRGBColorSpace,type Group,type Object3D} from 'three';
import {projectionGeometry} from '../domain/projection';
import {videoPosterRect} from './videoPoster';
import type {RenderLight} from './sceneLighting';

const original='directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;';
const projected='directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : vec3( 0.0 );';
// Fixed preview exposure keeps typical 1,500 lm images legible under the app's
// existing ACES camera. This is a relative preview, not a calibrated lux renderer.
export const PROJECTOR_PREVIEW_GAIN=.05;
/** Own a bounded fitted map. Never change a cached source texture or its pixels. */
export function framedProjectorTexture(source:Texture,projection:Pick<NonNullable<RenderLight['projection']>,'aspectRatio'|'fit'>){
 const image=source.image as HTMLCanvasElement,aspect=projection.aspectRatio,canvas=document.createElement('canvas');
 canvas.width=Math.round(aspect>=1?1024:1024*aspect);canvas.height=Math.round(aspect>=1?1024/aspect:1024);
 const context=canvas.getContext('2d');if(!context)throw new Error('프로젝터 이미지를 준비하지 못했습니다.');
 const r=videoPosterRect(canvas.width,canvas.height,{widthPx:image.width,heightPx:image.height,fit:projection.fit??'contain'});
 context.fillStyle='#000000';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,r.sx,r.sy,r.sw,r.sh,r.dx,r.dy,r.dw,r.dh);
 const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;return texture;
}
function projectorUp(data:RenderLight){const d=new Vector3(data.target.x-data.position.x,data.target.y-data.position.y,data.target.z-data.position.z).normalize();return Math.abs(d.y)>.9999?new Vector3(0,0,-1):new Vector3(0,1,0);}
/** Three r180's mapped spot adds white light outside the image rectangle.
 * Our only mapped spots are projectors, so block that spill for every receiving
 * standard/physical material, including imported GLB materials. Version guarded. */
export function installProjectorShader(){
 if(ShaderChunk.lights_fragment_begin.includes(projected))return;
 if(!ShaderChunk.lights_fragment_begin.includes(original))throw new Error('프로젝터 셰이더의 Three.js 버전을 확인해주세요.');
 ShaderChunk.lights_fragment_begin=ShaderChunk.lights_fragment_begin.replace(original,projected);
}

export function applyProjectorMap(group:Group,data:RenderLight,texture:Texture|undefined,error=''){
 const lamp=group.getObjectByName('emitter');if(!(lamp instanceof SpotLight)||!data.projection)return;
 const geometry=projectionGeometry({...data,projection:data.projection});
 lamp.color.set(0xffffff);lamp.angle=geometry.halfAngle;lamp.penumbra=0;lamp.distance=0;
 lamp.shadow.focus=geometry.focus;lamp.shadow.aspect=data.projection.aspectRatio;
 lamp.shadow.camera.up.copy(projectorUp(data));
 lamp.shadow.camera.far=Math.max(20,geometry.distanceMm/1000*4);
 lamp.map=error?null:texture??null;lamp.intensity=lamp.map?geometry.intensity*PROJECTOR_PREVIEW_GAIN:0;
 group.userData.projectorReady=!!lamp.map;
 group.userData.projectorError=error;
 group.userData.projectorRenderKey=projectorRenderKey(data);
 group.userData.projectorImageUrl=data.projection.imageUrl;
 group.userData.projectorImageId=data.projection.imageId;
 lamp.updateMatrixWorld(true);lamp.shadow.updateMatrices(lamp);lamp.shadow.needsUpdate=true;
}
export function projectorRenderKey(data:RenderLight){const p=data.projection;return JSON.stringify([data.position,data.target,p?.throwRatio,p?.aspectRatio,p?.brightnessLumens,p?.fit]);}

/** An old source's failure must not reject a replacement that is still committing. */
export function projectorMapReady(scene:Object3D,data:RenderLight){
 if(!data.visible||!data.projection)return true;
 // Compare source strings by value without serializing megabytes at every capture poll.
 const group=scene.getObjectByName(`light-${data.id}`);if(!group||group.userData.projectorImageUrl!==data.projection.imageUrl||group.userData.projectorImageId!==data.projection.imageId||group.userData.projectorRenderKey!==projectorRenderKey(data))return false;
 if(group.userData.projectorError)throw new Error(group.userData.projectorError);
 const lamp=group.getObjectByName('emitter');return lamp instanceof SpotLight&&!!lamp.map&&group.userData.projectorReady===true;
}

/** Guide on the plane perpendicular to the optical axis; surface hits are rendered by the light. */
export function projectorFrame(data:RenderLight){
 if(!data.projection)return [];
 const {verticalFov,distanceMm}=projectionGeometry({...data,projection:data.projection}),camera=new PerspectiveCamera(verticalFov*180/Math.PI,data.projection.aspectRatio,.02,Math.max(20,distanceMm/1000*4)),center=new Vector3(data.target.x,data.target.y,data.target.z).multiplyScalar(.001);
 camera.position.set(data.position.x/1000,data.position.y/1000,data.position.z/1000);camera.up.copy(projectorUp(data));camera.lookAt(center);camera.updateMatrixWorld(true);
 const direction=center.clone().sub(camera.position).normalize();
 return [[-1,-1],[1,-1],[1,1],[-1,1],[-1,-1]].map(([x,y])=>{const ray=new Vector3(x,y,0).unproject(camera).sub(camera.position);return ray.multiplyScalar(distanceMm/1000/ray.dot(direction)).add(camera.position).toArray() as [number,number,number];});
}

/** Detached PDF/capture renderer owns and disposes these static projector maps. */
export async function prepareProjectorMaps(rig:Group,lights:readonly RenderLight[]){
 const textures=new Map<string,Texture>(),maps=new Set<Texture>(),dispose=()=>{textures.forEach(t=>t.dispose());maps.forEach(t=>t.dispose());};
 try{installProjectorShader();const {artworkTexture}=await import('./modelExport');
  for(const light of lights)if(light.visible&&light.projection){const url=light.projection.imageUrl;if(!url)throw new Error('투사 이미지를 준비하지 못했습니다.');let texture=textures.get(url);if(!texture){texture=await artworkTexture(url);textures.set(url,texture);}const group=rig.getObjectByName(`light-${light.id}`) as Group|undefined;if(group){const map=framedProjectorTexture(texture,light.projection);maps.add(map);applyProjectorMap(group,light,map);}}
  return dispose;
 }catch(error){dispose();throw error;}
}
