import {projectSpatialBounds} from '../domain/referenceModel';
import {Vector3,type Camera} from 'three';
import type {CameraView,Project,WorldPoint} from '../domain/types';

export type CameraView3D=CameraView;

export function createCameraViewGetter(camera: Camera, getTarget: () => Vector3): () => CameraView3D {
  return () => {
    const target = getTarget();
    return {
      ...('isPerspectiveCamera' in camera&&camera.isPerspectiveCamera ? {projection:'perspective' as const,fov:Number('fov' in camera?camera.fov:50)} : {}),
      position: [camera.position.x, camera.position.y, camera.position.z],
      target: [target.x, target.y, target.z],
      zoom: 'zoom' in camera && typeof camera.zoom === 'number' ? camera.zoom : 1,
    };
  };
}

export function createEyeLevelView(project:Project,wallId:string,heightMm=1600):CameraView {
  const wall=project.walls.find(w=>w.id===wallId)??project.walls[0];
  const points=project.walls.flatMap(w=>[w.start,w.end]);
  const x=(Math.min(...points.map(p=>p.x))+Math.max(...points.map(p=>p.x)))/2000;
  const z=(Math.min(...points.map(p=>p.z))+Math.max(...points.map(p=>p.z)))/2000;
  const target:[number,number,number]=[(wall.start.x+wall.end.x)/2000,heightMm/1000,(wall.start.z+wall.end.z)/2000];
  const position:[number,number,number]=[x,heightMm/1000,z];
  if(Math.hypot(x-target[0],z-target[2])<.1){
    const dx=wall.end.x-wall.start.x,dz=wall.end.z-wall.start.z,length=Math.hypot(dx,dz)||1;
    position[0]-=dz/length*2;position[2]+=dx/length*2;
  }
  return {projection:'perspective',fov:50,zoom:1,position,target};
}

export type StandardView='front'|'left'|'right'|'bird';
export function createStandardView(project:Project,view:StandardView,viewport:{width:number;height:number}):CameraView {
  const bounds=projectSpatialBounds(project);
  const minX=bounds.minX/1000,maxX=bounds.maxX/1000,minZ=bounds.minZ/1000,maxZ=bounds.maxZ/1000;
  const height=(bounds.maxY-bounds.minY)/1000;
  const target:[number,number,number]=[(minX+maxX)/2,bounds.minY/1000+height/2,(minZ+maxZ)/2];
  const span=Math.max(Math.hypot(maxX-minX,maxZ-minZ),2);
  const position:[number,number,number]=view==='front'?[target[0],target[1],maxZ+span]:view==='left'?[minX-span,target[1],target[2]]:view==='right'?[maxX+span,target[1],target[2]]:[target[0]-span,target[1]+span*1.5,target[2]+span];
  const width=view==='front'?maxX-minX:view==='bird'?span:maxZ-minZ;
  const visibleHeight=view==='bird'?span+height:height;
  const zoom=Math.max(.1,Math.min(viewport.width/(width+2),viewport.height/(visibleHeight+2))*.8);
  return {projection:'orthographic',position,target,zoom};
}
export function rotateCameraView(view:CameraView,degrees:number):CameraView {
  const radians=degrees*Math.PI/180,dx=view.position[0]-view.target[0],dz=view.position[2]-view.target[2];
  return {...view,target:[...view.target],position:[view.target[0]+dx*Math.cos(radians)+dz*Math.sin(radians),view.position[1],view.target[2]-dx*Math.sin(radians)+dz*Math.cos(radians)]};
}

/** Fit actual corners, preserving orbit direction and lens. Never edits model dimensions. */
export function createFocusedView(pointsMm:WorldPoint[],current:CameraView,viewport:{width:number;height:number}):CameraView|null {
  if(!pointsMm.length)return null;
  const points=pointsMm.map(p=>new Vector3(p.x/1000,p.y/1000,p.z/1000));
  const min=points[0].clone(),max=min.clone();for(const p of points){min.min(p);max.max(p);}
  const target=min.clone().add(max).multiplyScalar(.5);
  const outward=new Vector3().fromArray(current.position).sub(new Vector3().fromArray(current.target));
  if(outward.lengthSq()<1e-12)outward.set(-1,1,1);outward.normalize();
  const right=new Vector3().crossVectors(new Vector3(0,1,0),outward);
  if(right.lengthSq()<1e-12)right.set(1,0,0);right.normalize();
  const up=new Vector3().crossVectors(outward,right).normalize();
  let halfWidth=.1,halfHeight=.1,depth=.1;
  const local=points.map(p=>p.clone().sub(target));
  for(const p of local){halfWidth=Math.max(halfWidth,Math.abs(p.dot(right)));halfHeight=Math.max(halfHeight,Math.abs(p.dot(up)));depth=Math.max(depth,Math.abs(p.dot(outward)));}
  let zoom:number,distance:number;
  if(current.projection==='perspective'){
    const aspect=Math.max(.01,viewport.width/Math.max(1,viewport.height)),tanY=Math.tan((current.fov??50)*Math.PI/360),tanX=tanY*aspect;
    distance=Math.max(.3,...local.map(p=>p.dot(outward)+Math.max(Math.abs(p.dot(right))*1.25/tanX,Math.abs(p.dot(up))*1.25/tanY)+.2));zoom=1;
  }else{
    zoom=Math.max(.1,Math.min(240,viewport.width/(halfWidth*2*1.25),viewport.height/(halfHeight*2*1.25)));
    distance=Math.max(.3,Math.hypot(halfWidth,halfHeight,depth)*2+.2);
  }
  return {...current,position:target.clone().addScaledVector(outward,distance).toArray() as [number,number,number],target:target.toArray() as [number,number,number],zoom};
}
