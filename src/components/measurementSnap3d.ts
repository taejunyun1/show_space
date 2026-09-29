import {Mesh,Vector3,type Camera,type Object3D} from 'three';

// Compare in CSS pixels so the acquisition radius stays stable while zooming.
export function snapMeasurementCorner(object:Object3D,point:Vector3,normal:Vector3|undefined,camera:Camera,size:{width:number;height:number}):Vector3|null{
 if(!(object instanceof Mesh)||!normal||size.width<=0||size.height<=0)return null;
 const geometry=object.geometry;
 if(!geometry.boundingBox)geometry.computeBoundingBox();
 const box=geometry.boundingBox;if(!box)return null;
 const local=object.worldToLocal(point.clone()),screen=point.clone().project(camera);
 let closest:Vector3|null=null,best=12*12;
 for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
  const corner=new Vector3(x,y,z);
  // Only corners on the intersected face, never the back of a thick wall/frame.
  if(Math.abs(corner.clone().sub(local).dot(normal))>1e-4)continue;
  const world=object.localToWorld(corner),projected=world.clone().project(camera);
  if(projected.z < -1 || projected.z > 1)continue;
  const distance=((projected.x-screen.x)*size.width/2)**2+((projected.y-screen.y)*size.height/2)**2;
  if(distance<best){best=distance;closest=world;}
 }
 return closest;
}
