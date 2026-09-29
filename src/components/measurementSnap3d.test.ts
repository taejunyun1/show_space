import {expect,it} from 'vitest';
import {BoxGeometry,Mesh,OrthographicCamera,Vector3} from 'three';
import {snapMeasurementCorner} from './measurementSnap3d';
it('snaps only within a fixed screen radius, including after zoom',()=>{
 const camera=new OrthographicCamera(-5,5,5,-5,.1,100);camera.position.z=10;camera.updateMatrixWorld();
 const mesh=new Mesh(new BoxGeometry(2,2,.2));mesh.updateMatrixWorld();
 const point=new Vector3(.9,.9,.1);
 expect(snapMeasurementCorner(mesh,point,new Vector3(0,0,1),camera,{width:500,height:500})?.toArray()).toEqual([1,1,expect.closeTo(.1)]);
 camera.zoom=4;camera.updateProjectionMatrix();
 expect(snapMeasurementCorner(mesh,point,new Vector3(0,0,1),camera,{width:500,height:500})).toBeNull();
});
it('uses the hit face and world transform for rotated objects',()=>{
 const camera=new OrthographicCamera(-5,5,5,-5,.1,100);camera.position.z=10;camera.updateMatrixWorld();
 const mesh=new Mesh(new BoxGeometry(2,2,.2));mesh.rotation.z=Math.PI/2;mesh.position.x=2;mesh.updateMatrixWorld();
 const point=mesh.localToWorld(new Vector3(.95,.95,.1));
 const snapped=snapMeasurementCorner(mesh,point,new Vector3(0,0,1),camera,{width:500,height:500});
 expect(snapped?.x).toBeCloseTo(1);expect(snapped?.y).toBeCloseTo(1);expect(snapped?.z).toBeCloseTo(.1);
});
