import type { Camera, Vector3 } from 'three';
import type {CameraView,Project} from '../domain/types';

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
  const points=project.walls.flatMap(w=>[w.start,w.end]);
  const minX=Math.min(...points.map(p=>p.x))/1000,maxX=Math.max(...points.map(p=>p.x))/1000;
  const minZ=Math.min(...points.map(p=>p.z))/1000,maxZ=Math.max(...points.map(p=>p.z))/1000;
  const height=Math.max(...project.walls.map(w=>w.heightMm))/1000;
  const target:[number,number,number]=[(minX+maxX)/2,height/2,(minZ+maxZ)/2];
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
