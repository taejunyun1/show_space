import {createSurfaceMaterial} from './surfaceMaterial';
import {BoxGeometry,ExtrudeGeometry,Group,Mesh,MeshStandardMaterial,Path,PlaneGeometry,Scene,Shape,Texture,type Material,type Object3D} from 'three';
import {artworkPosition,wallLength} from '../domain/model';
import {floorWithOpenings} from '../domain/openings';
import type {Project} from '../domain/types';

const frameColors={black:'#282827',natural:'#b9a383',white:'#f5f4ef',none:'#eee8dc'};

/** Build from stored geometry, independent of the editor camera, grid and selection. */
export function buildExportScene(project:Project,textures=new Map<string,Texture>(),referenceScene?:Object3D):Scene{
 if(project.planReference&&!project.planReference.calibrated)throw new Error('도면 축척을 설정한 뒤 3D 모델을 내보내세요.');
 const scene=new Scene();scene.name=project.name;
 for(const wall of project.walls){
  if(!wall.visible)continue;
  const mesh=new Mesh(new BoxGeometry(wallLength(wall)/1000,wall.heightMm/1000,wall.thicknessMm/1000),createSurfaceMaterial(wall.color,wall.material,.92));
  mesh.name=`wall-${wall.id}`;mesh.position.set((wall.start.x+wall.end.x)/2000,wall.heightMm/2000,(wall.start.z+wall.end.z)/2000);mesh.rotation.y=-Math.atan2(wall.end.z-wall.start.z,wall.end.x-wall.start.x);
  mesh.userData={gonggan:{kind:'wall',id:wall.id}};scene.add(mesh);
 }
 for(const [index,{outer,holes}] of floorWithOpenings(project).surfaces.entries()){
  const shape=new Shape();shape.moveTo(outer[0].x/1000,outer[0].z/1000);outer.slice(1).forEach(p=>shape.lineTo(p.x/1000,p.z/1000));shape.closePath();
  shape.holes=holes.map(points=>{const reversed=[...points].reverse(),hole=new Path();hole.moveTo(reversed[0].x/1000,reversed[0].z/1000);reversed.slice(1).forEach(p=>hole.lineTo(p.x/1000,p.z/1000));hole.closePath();return hole;});
  const floor=new Mesh(new ExtrudeGeometry(shape,{depth:.16,bevelEnabled:false,steps:1}),createSurfaceMaterial(project.floorColor,project.floorMaterial,.96));
  floor.name=`floor-${index+1}`;floor.rotation.x=Math.PI/2;floor.userData={gonggan:{kind:'floor'}};scene.add(floor);
 }
 for(const artwork of project.artworks){
  const wall=project.walls.find(w=>w.id===artwork.wallId);if(!artwork.visible||!wall?.visible||!artwork.imageUrl)continue;
  const group=new Group(),pose=artworkPosition(artwork,wall),w=artwork.widthMm/1000,h=artwork.heightMm/1000,d=artwork.depthMm/1000,padding=artwork.frame==='none'?0:.045;
  group.name=`artwork-${artwork.id}`;group.position.set(pose.x/1000,pose.y/1000,pose.z/1000);group.rotation.set(0,pose.rotationY,(artwork.rotationDeg??0)*Math.PI/180);
  group.userData={gonggan:{kind:'artwork',id:artwork.id}};
  const frame=new Mesh(new BoxGeometry(w+padding,h+padding,d),new MeshStandardMaterial({color:frameColors[artwork.frame],roughness:.75}));frame.name='frame';group.add(frame);
  const image=new Mesh(new PlaneGeometry(w,h),Object.assign(createSurfaceMaterial('#ffffff',artwork.material,.9),{map:textures.get(artwork.id)??null}));image.name='image';image.position.z=d/2+.002;group.add(image);scene.add(group);
 }
 if(project.referenceModel?.visible&&referenceScene){
  const model=project.referenceModel,root=new Group(),offset=new Group();root.name=model.name;root.position.set(...model.positionMm.map(v=>v/1000) as [number,number,number]);root.rotation.y=model.rotationDeg*Math.PI/180;root.scale.setScalar(model.scale);
  offset.position.set(...model.sourceOffsetM);offset.add(referenceScene.clone(true));root.add(offset);scene.add(root);
 }
 scene.updateMatrixWorld(true);return scene;
}

/** Export owns its resources; never call this with the live editor scene. */
export function disposeExportScene(scene:Object3D){
 const geometries=new Set<Mesh['geometry']>(),materials=new Set<Material>(),textures=new Set<Texture>();
 scene.traverse(object=>{if(object instanceof Mesh){geometries.add(object.geometry);for(const material of Array.isArray(object.material)?object.material:[object.material]){materials.add(material);for(const value of Object.values(material))if(value instanceof Texture)textures.add(value);}}});
 textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());
}
