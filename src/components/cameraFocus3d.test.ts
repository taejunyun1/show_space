import {expect,it} from 'vitest';
import {OrthographicCamera,PerspectiveCamera,Vector3} from 'three';
import {createFocusedView} from './cameraView3d';
import {selectionFocusPoints} from '../domain/selectionFocus';
import {projectionReceiverFixture} from '../lib/projectionReceiverFixture';
import type {CameraView} from '../domain/types';

it('fits selected physical corners in actual Three cameras across portrait, landscape and perspective views',()=>{
 const p=projectionReceiverFixture(),selection=p.walls.filter(w=>w.visible).map(w=>({type:'wall' as const,id:w.id})),points=selectionFocusPoints(p,selection);
 for(const viewport of [{width:1200,height:300},{width:300,height:1200},{width:800,height:600}])for(const projection of ['orthographic','perspective'] as const)for(const position of [[0,3,12],[-7,8,12],[12,3,0]] as [number,number,number][]){
  const current:CameraView={projection,position,target:[0,1,0],zoom:33,...(projection==='perspective'?{fov:45}:{})},before=JSON.stringify(current),focused=createFocusedView(points,current,viewport)!;
  const camera=projection==='perspective'?new PerspectiveCamera(45,viewport.width/viewport.height,.1,1000):new OrthographicCamera(-viewport.width/2,viewport.width/2,viewport.height/2,-viewport.height/2,.1,1000);
  camera.position.fromArray(focused.position);camera.zoom=focused.zoom;camera.lookAt(new Vector3().fromArray(focused.target));camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  for(const p of points){const ndc=new Vector3(p.x/1000,p.y/1000,p.z/1000).project(camera);expect(Math.abs(ndc.x)).toBeLessThanOrEqual(.801);expect(Math.abs(ndc.y)).toBeLessThanOrEqual(.801);expect(ndc.z).toBeGreaterThan(-1);expect(ndc.z).toBeLessThan(1);}
  const originalDirection=new Vector3().fromArray(current.position).sub(new Vector3().fromArray(current.target)).normalize(),newDirection=camera.position.clone().sub(new Vector3().fromArray(focused.target)).normalize();expect(originalDirection.distanceTo(newDirection)).toBeLessThan(1e-10);expect(JSON.stringify(current)).toBe(before);
 }
});
it('keeps tiny point selections finite and within controls zoom limits and handles coincident target/position',()=>{
 for(const projection of ['orthographic','perspective'] as const){const focused=createFocusedView([{x:1000,y:2700,z:3000}],{projection,position:[1,2.7,3],target:[1,2.7,3],zoom:1},{width:800,height:600})!;expect(focused.target).toEqual([1,2.7,3]);expect(focused.position).not.toEqual(focused.target);expect(focused.zoom).toBeGreaterThan(0);expect(focused.zoom).toBeLessThanOrEqual(240);expect(focused.position.every(Number.isFinite)).toBe(true);}
 expect(createFocusedView([],{position:[1,2,3],target:[0,0,0],zoom:1},{width:800,height:600})).toBeNull();
});

it('fits the projector device marker in a narrow perspective viewport',()=>{
 const p=projectionReceiverFixture(),points=selectionFocusPoints(p,[{type:'light',id:p.lights![0].id}]),viewport={width:200,height:1000},focused=createFocusedView(points,{projection:'perspective',position:[0,2,10],target:[0,2,0],fov:50,zoom:1},viewport)!;
 const camera=new PerspectiveCamera(50,.2,.1,1000);camera.position.fromArray(focused.position);camera.lookAt(new Vector3().fromArray(focused.target));camera.updateMatrixWorld(true);for(const p of points){const v=new Vector3(p.x/1000,p.y/1000,p.z/1000).project(camera);expect(Math.abs(v.x)).toBeLessThan(.8);expect(Math.abs(v.y)).toBeLessThan(.8);}
});
