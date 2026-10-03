import {expect,it} from 'vitest';
import {OrthographicCamera,PerspectiveCamera} from 'three';
import {modelSnapRadius3d} from './modelSnap3d';
const pos={x:0,y:0,z:0},dir={x:1,y:0,z:0},size={width:800,height:400};
it('uses CSS pixels consistently across zoom and disables edge-on axes',()=>{const c=new OrthographicCamera(-4,4,2,-2,.1,100);c.position.set(0,0,5);c.lookAt(0,0,0);c.updateMatrixWorld();expect(modelSnapRadius3d(c,pos,dir,size)).toBeCloseTo(120);c.zoom=2;c.updateProjectionMatrix();expect(modelSnapRadius3d(c,pos,dir,size)).toBeCloseTo(60);expect(modelSnapRadius3d(c,pos,{x:0,y:0,z:1},size)).toBe(0);});
it('responds to perspective depth and refuses invalid or behind-camera projections',()=>{const c=new PerspectiveCamera(50,2,.1,100);c.position.set(0,0,5);c.lookAt(0,0,0);c.updateMatrixWorld();const first=modelSnapRadius3d(c,pos,dir,size);c.position.z=10;c.updateMatrixWorld();expect(modelSnapRadius3d(c,pos,dir,size)).toBeGreaterThan(first);c.lookAt(0,0,20);c.updateMatrixWorld();expect(modelSnapRadius3d(c,pos,dir,size)).toBe(0);expect(modelSnapRadius3d(c,pos,dir,{width:0,height:0})).toBe(0);expect(modelSnapRadius3d(c,pos,{x:0,y:0,z:0},size)).toBe(0);});
