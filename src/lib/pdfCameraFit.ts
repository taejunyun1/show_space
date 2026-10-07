import {Box3,PerspectiveCamera,Vector3} from 'three';
/** Fit an explicit output preset, preserving its direction. Saved/current views are not refitted. */
export function fitPdfPerspective(camera:PerspectiveCamera,box:Box3){
 if(box.isEmpty())return;
 const center=box.getCenter(new Vector3()),direction=camera.position.clone().sub(center).normalize();
 if(direction.lengthSq()===0)direction.set(1,1,1).normalize();
 camera.position.copy(center.clone().add(direction));camera.zoom=1;camera.lookAt(center);camera.updateMatrixWorld(true);
 const tanY=Math.tan(camera.fov*Math.PI/360),tanX=tanY*camera.aspect;let distance=.1;
 for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
  const p=new Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse);
  distance=Math.max(distance,p.z+1+Math.max(Math.abs(p.x)/tanX,Math.abs(p.y)/tanY)/.85);
 }
 camera.position.copy(center.clone().addScaledVector(direction,distance+.05));camera.lookAt(center);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
}
