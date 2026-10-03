import {expect,it} from 'vitest';
import {BoxGeometry,BufferGeometry,Float32BufferAttribute,Group,Mesh,MeshBasicMaterial} from 'three';
import type {ReferenceModel} from '../domain/types';
import {extractModelWalls} from './modelWalls';
const model:ReferenceModel={name:'room.glb',dataUrl:'unused',visible:true,sizeMm:[8000,3000,6000],sourceOffsetM:[0,0,0],positionMm:[0,0,0],rotationDeg:0,scale:1};
function box(x:number,z:number,width:number,depth:number,height=3){const mesh=new Mesh(new BoxGeometry(width,height,depth),new MeshBasicMaterial());mesh.position.set(x,height/2,z);return mesh;}
it('extracts actual solid wall faces and thickness, excluding the floor and low furniture',()=>{
 const scene=new Group();scene.add(box(0,-3,8,.2),box(-4,0,.2,6),box(4,0,.2,6),box(0,0,8,6,.15),box(0,0,1,.5,.8));
 const result=extractModelWalls(scene,model);expect(result.walls).toHaveLength(3);
 expect(result.walls.map(w=>w.heightMm)).toEqual([3000,3000,3000]);expect(result.walls.every(w=>w.thicknessMm===200)).toBe(true);
 expect(result.walls.map(w=>Math.hypot(w.end.x-w.start.x,w.end.z-w.start.z)).sort((a,b)=>a-b)).toEqual([6000,6000,8000]);
});
it('uses nested transforms, model rotation, translation and scale without modifying the source',()=>{
 const scene=new Group(),group=new Group();group.position.set(2,0,1);group.rotation.y=Math.PI/6;group.add(box(0,0,4,.2));scene.add(group);
 const before=scene.toJSON(),result=extractModelWalls(scene,{...model,sourceOffsetM:[-2,0,-1],positionMm:[1000,0,2000],rotationDeg:60,scale:2});
 expect(result.walls).toHaveLength(1);const wall=result.walls[0];expect(Math.hypot(wall.end.x-wall.start.x,wall.end.z-wall.start.z)).toBeCloseTo(8000,0);expect(wall.thicknessMm).toBe(400);expect(wall.heightMm).toBe(6000);
 expect((wall.start.x+wall.end.x)/2).toBeCloseTo(1000);expect((wall.start.z+wall.end.z)/2).toBeCloseTo(2000);expect(scene.toJSON()).toEqual(before);
});
it('keeps disconnected coplanar wall segments separate instead of filling a doorway',()=>{
 const scene=new Group();scene.add(box(-2,0,2,.2),box(2,0,2,.2));
 const {walls}=extractModelWalls(scene,model);expect(walls).toHaveLength(2);expect(walls.every(w=>Math.hypot(w.end.x-w.start.x,w.end.z-w.start.z)===2000)).toBe(true);
});
it('does not invent a wall thickness between two unconnected parallel surfaces',()=>{
 const scene=new Group();for(const z of [0,.2]){const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute([-2,0,z,2,0,z,2,3,z,-2,0,z,2,3,z,-2,3,z],3));scene.add(new Mesh(geometry,new MeshBasicMaterial()));}
 expect(extractModelWalls(scene,model).walls).toEqual([]);
});
it('skips tilted, elevated and excessively thick blocks',()=>{
 const scene=new Group(),tilt=box(0,0,4,.2);tilt.rotation.x=.2;const raised=box(0,5,4,.2);raised.position.y=5;scene.add(tilt,raised,box(0,10,4,2));
 expect(extractModelWalls(scene,model).walls).toEqual([]);
});
it('does not turn a tall exported artwork frame into a wall on reimport',()=>{
 const scene=new Group(),artwork=new Group();artwork.userData={gonggan:{kind:'artwork'}};artwork.add(box(0,0,1,.04,2));scene.add(artwork,box(0,-3,8,.2));
 expect(extractModelWalls(scene,model).walls).toHaveLength(1);
});
it('preserves the actual floor even when the model has an open wall boundary',()=>{
 const scene=new Group();scene.add(box(0,-3,8,.2),box(-4,0,.2,6),box(4,0,.2,6),box(0,0,8,6,.15));
 const result=extractModelWalls(scene,model);expect(result.importedFloor).toHaveLength(1);expect(result.importedFloor![0]).toHaveLength(4);
 expect(result.importedFloor![0].every(p=>Math.abs(p.x)===4000&&Math.abs(p.z)===3000)).toBe(true);
 const wall=result.walls[0],dx=wall.end.x-wall.start.x,dz=wall.end.z-wall.start.z;expect(-dz*-(wall.start.x+wall.end.x)/2+dx*-(wall.start.z+wall.end.z)/2).toBeGreaterThan(0);
});
it('retains a courtyard hole in the extracted floor',async()=>{
 const {Shape,Path,ShapeGeometry}=await import('three');const shape=new Shape();shape.moveTo(-4,-3);shape.lineTo(4,-3);shape.lineTo(4,3);shape.lineTo(-4,3);shape.closePath();
 const hole=new Path();hole.moveTo(-1,-1);hole.lineTo(-1,1);hole.lineTo(1,1);hole.lineTo(1,-1);hole.closePath();shape.holes.push(hole);
 const floor=new Mesh(new ShapeGeometry(shape),new MeshBasicMaterial());floor.rotation.x=-Math.PI/2;
 const scene=new Group();scene.add(floor,box(0,-3,8,.2));const result=extractModelWalls(scene,model);
 const {floorFromLoops}=await import('../domain/importedFloor');const boundary=floorFromLoops(result.importedFloor!);expect(boundary.areaMm2).toBe(44_000_000);expect(boundary.surfaces[0].holes).toHaveLength(1);
});
