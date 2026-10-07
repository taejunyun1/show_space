import {expect,it} from 'vitest';
import {Box3,PerspectiveCamera,Vector3} from 'three';
import {fitPdfPerspective} from './pdfCameraFit';
it('keeps all eight corners within the image for a wide offset venue and tall portrait object',()=>{
 for(const [min,max,aspect] of [[[-8,0,-2],[8,3,2],1.6],[[10,4,20],[11,14,21],.7]] as const){
  const box=new Box3(new Vector3(...min),new Vector3(...max)),center=box.getCenter(new Vector3()),camera=new PerspectiveCamera(50,aspect,.02,10000);camera.position.copy(center.clone().add(new Vector3(-30,40,30)));camera.lookAt(center);const direction=camera.position.clone().sub(center).normalize();fitPdfPerspective(camera,box);
  expect(camera.position.clone().sub(center).normalize().distanceTo(direction)).toBeLessThan(1e-6);
  const projected=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])projected.push(new Vector3(x,y,z).project(camera));
  expect(projected.every(p=>Math.abs(p.x)<.85&&Math.abs(p.y)<.85&&p.z>-1&&p.z<1)).toBe(true);expect(Math.max(...projected.map(p=>Math.max(Math.abs(p.x),Math.abs(p.y))))).toBeGreaterThan(.7);
 }
});
it('does not mutate an empty-geometry camera',()=>{const camera=new PerspectiveCamera();camera.position.set(1,2,3);const before=camera.toJSON();fitPdfPerspective(camera,new Box3());expect(camera.toJSON()).toEqual(before);});
