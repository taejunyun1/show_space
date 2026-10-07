import {artworkPresentation} from '../domain/artworkPresentation';
import {artworkFrameGeometry,artworkFrameMaterial,artworkCoverMaterial} from './artworkPresentationGeometry';
import {placeModelArtwork,checkModelArtworkBounds} from './modelArtworkGeometry';
import {createExportLighting,disposeLighting} from './sceneLighting';
import {wallMetricUv,floorMetricUv,repeatingSurfaceTexture,repeatingNormalTexture} from './surfaceUv';
import {createSurfaceMaterial} from './surfaceMaterial';
import {BoxGeometry,ExtrudeGeometry,Group,Mesh,MeshStandardMaterial,Path,PlaneGeometry,Scene,Shape,Texture,type Material,type Object3D} from 'three';
import {artworkPosition,wallLength} from '../domain/model';
import {floorWithOpenings} from '../domain/openings';
import type {Project} from '../domain/types';


/** Build from stored geometry, independent of the editor camera, grid and selection. */
export function buildExportScene(project:Project,textures=new Map<string,Texture>(),referenceScene?:Object3D,materialTextures=new Map<string,Texture>(),artworkModels=new Map<string,Object3D>()):Scene{
 if(project.planReference&&!project.planReference.calibrated)throw new Error('도면 축척을 설정한 뒤 3D 모델을 내보내세요.');
 const finishes=[project.floorMaterial,...project.walls.filter(w=>w.visible).map(w=>w.material),...project.artworks.filter(a=>a.visible&&a.imageUrl&&project.walls.some(w=>w.id===a.wallId&&w.visible)).map(a=>a.material)];
 for(const m of finishes){if(m?.texture&&!materialTextures.has(m.texture.imageUrl))throw new Error('표면 텍스처를 준비하지 못했습니다.');if(m?.normal&&!materialTextures.has(m.normal.imageUrl))throw new Error('노멀 맵을 준비하지 못했습니다.');}
 function normal(result:MeshStandardMaterial,material:Project['floorMaterial'],extentM?:readonly [number,number]){if(material?.normal)result.normalMap=repeatingNormalTexture(materialTextures.get(material.normal.imageUrl)!,material.normal,extentM);return result;}
 function finish(color:string,material:Project['floorMaterial'],roughness:number){const result=createSurfaceMaterial(color,material,roughness) as MeshStandardMaterial;if(material?.texture){const source=materialTextures.get(material.texture.imageUrl);if(!source)throw new Error('표면 텍스처를 준비하지 못했습니다.');result.map=repeatingSurfaceTexture(source,material.texture);}return normal(result,material);}
 for(const a of project.modelArtworks??[])if(a.visible){const source=artworkModels.get(a.id);if(!source)throw new Error('3D 작품 모델을 준비하지 못했습니다.');checkModelArtworkBounds(source,a.model);}
 const scene=new Scene();scene.name=project.name;
 for(const wall of project.walls){
  if(!wall.visible)continue;
  const mesh=new Mesh(wallMetricUv(new BoxGeometry(wallLength(wall)/1000,wall.heightMm/1000,wall.thicknessMm/1000)),finish(wall.color,wall.material,.92));
  mesh.name=`wall-${wall.id}`;mesh.position.set((wall.start.x+wall.end.x)/2000,wall.heightMm/2000,(wall.start.z+wall.end.z)/2000);mesh.rotation.y=-Math.atan2(wall.end.z-wall.start.z,wall.end.x-wall.start.x);
  mesh.userData={gonggan:{kind:'wall',id:wall.id}};scene.add(mesh);
 }
 for(const [index,{outer,holes}] of floorWithOpenings(project).surfaces.entries()){
  const shape=new Shape();shape.moveTo(outer[0].x/1000,outer[0].z/1000);outer.slice(1).forEach(p=>shape.lineTo(p.x/1000,p.z/1000));shape.closePath();
  shape.holes=holes.map(points=>{const reversed=[...points].reverse(),hole=new Path();hole.moveTo(reversed[0].x/1000,reversed[0].z/1000);reversed.slice(1).forEach(p=>hole.lineTo(p.x/1000,p.z/1000));hole.closePath();return hole;});
  const floor=new Mesh(floorMetricUv(new ExtrudeGeometry(shape,{depth:.16,bevelEnabled:false,steps:1})),finish(project.floorColor,project.floorMaterial,.96));
  floor.name=`floor-${index+1}`;floor.rotation.x=Math.PI/2;floor.userData={gonggan:{kind:'floor'}};scene.add(floor);
 }
 for(const artwork of project.artworks){
  const wall=project.walls.find(w=>w.id===artwork.wallId);if(!artwork.visible||!wall?.visible||!artwork.imageUrl)continue;
  const group=new Group(),pose=artworkPosition(artwork,wall),w=artwork.widthMm/1000,h=artwork.heightMm/1000,p=artworkPresentation(artwork),d=p.depthMm/1000;
  group.name=`artwork-${artwork.id}`;group.position.set(pose.x/1000,pose.y/1000,pose.z/1000);group.rotation.set(0,pose.rotationY,(artwork.rotationDeg??0)*Math.PI/180);
  group.userData={gonggan:{kind:'artwork',id:artwork.id}};
  const frame=new Mesh(artworkFrameGeometry(artwork),artworkFrameMaterial(artwork));frame.name='frame';group.add(frame);
  const iw=p.innerWidthMm/1000,ih=p.innerHeightMm/1000,back=Math.min(2,p.depthMm/2)/1000;
  if(p.framed){const backing=new Mesh(new BoxGeometry(iw,ih,back),new MeshStandardMaterial({color:'#eee8dc',roughness:.95}));backing.name='backing';backing.position.z=-d/2+back/2;group.add(backing);}
  if(p.framed&&p.settings.matWidthMm>0){const mat=new Mesh(new PlaneGeometry(iw,ih),new MeshStandardMaterial({color:p.settings.matColor,roughness:.95}));mat.name='mat';mat.position.z=(p.imageZMm-.05)/1000;group.add(mat);}
  if(p.coverThicknessMm>0){const cover=new Mesh(new BoxGeometry(iw,ih,p.coverThicknessMm/1000),artworkCoverMaterial(artwork));cover.name='front-cover';cover.position.z=d/2-p.coverThicknessMm/2000;group.add(cover);}
  const image=new Mesh(new PlaneGeometry(w,h),normal(Object.assign(createSurfaceMaterial('#ffffff',artwork.material,.9),{map:textures.get(artwork.id)??null}) as MeshStandardMaterial,artwork.material,[w,h]));image.name='image';image.position.z=p.imageZMm/1000;group.add(image);scene.add(group);
 }
 for(const a of project.modelArtworks??[])if(a.visible){const source=artworkModels.get(a.id);if(!source)throw new Error('3D 작품 모델을 준비하지 못했습니다.');const root=placeModelArtwork(a,source);root.traverse(o=>{if(o!==root)o.userData={};if(o instanceof Mesh){o.castShadow=true;o.receiveShadow=true;for(const material of Array.isArray(o.material)?o.material:[o.material])material.userData={};}});scene.add(root);}
 if(project.referenceModel?.visible&&referenceScene){
  const model=project.referenceModel,root=new Group(),offset=new Group();root.name=model.name;root.position.set(...model.positionMm.map(v=>v/1000) as [number,number,number]);root.rotation.y=model.rotationDeg*Math.PI/180;root.scale.setScalar(model.scale);
  offset.position.set(...model.sourceOffsetM);offset.add(referenceScene.clone(true));root.add(offset);scene.add(root);
 }
 if(project.outdoor?.mode==='outdoor'||project.lights?.some(l=>l.visible&&l.kind==='spot'))scene.add(createExportLighting(project));
 scene.updateMatrixWorld(true);return scene;
}

/** Export owns its resources; never call this with the live editor scene. */
export function disposeExportScene(scene:Object3D){
 disposeLighting(scene);
 const geometries=new Set<Mesh['geometry']>(),materials=new Set<Material>(),textures=new Set<Texture>();
 scene.traverse(object=>{if(object instanceof Mesh){geometries.add(object.geometry);for(const material of Array.isArray(object.material)?object.material:[object.material]){materials.add(material);for(const value of Object.values(material))if(value instanceof Texture)textures.add(value);}}});
 const images=new Set<unknown>();textures.forEach(t=>{images.add(t.source.data);t.dispose();});for(const image of images)if(typeof ImageBitmap!=='undefined'&&image instanceof ImageBitmap)image.close();materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());
}
