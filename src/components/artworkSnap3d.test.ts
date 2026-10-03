import {expect,it} from 'vitest';
import {OrthographicCamera,PerspectiveCamera} from 'three';
import {createDemoProject} from '../domain/model';
import {artworkSnapTolerance3d} from './artworkSnap3d';
it('derives a stable 12px radius from orthographic zoom and handles edge-on axes',()=>{
 const p=createDemoProject(),w=p.walls[0],a=p.artworks[0],c=new OrthographicCamera(-4,4,2,-2,.1,100);c.position.set(0,1.5,5);c.lookAt(0,1.5,-3);c.updateMatrixWorld();
 const point={alongMm:4000,centerHeightMm:1500};let r=artworkSnapTolerance3d(c,w,a,point,{width:800,height:400});expect(r.alongMm).toBeCloseTo(120);expect(r.centerHeightMm).toBeCloseTo(120);
 c.zoom=2;c.updateProjectionMatrix();r=artworkSnapTolerance3d(c,w,a,point,{width:800,height:400});expect(r.alongMm).toBeCloseTo(60);expect(r.centerHeightMm).toBeCloseTo(60);
 c.position.set(10,1.5,-3);c.lookAt(0,1.5,-3);c.updateMatrixWorld();expect(artworkSnapTolerance3d(c,w,a,point,{width:800,height:400}).alongMm).toBe(0);
});
it('uses perspective depth and refuses behind-camera or empty screen axes',()=>{
 const p=createDemoProject(),c=new PerspectiveCamera(50,2,.1,100);c.position.set(0,1.5,5);c.lookAt(0,1.5,-3);c.updateMatrixWorld();
 const first=artworkSnapTolerance3d(c,p.walls[0],p.artworks[0],{alongMm:4000,centerHeightMm:1500},{width:800,height:400});expect(first.alongMm).toBeGreaterThan(0);expect(first.alongMm).toBeCloseTo(first.centerHeightMm);
 c.position.set(0,1.5,13);c.updateMatrixWorld();expect(artworkSnapTolerance3d(c,p.walls[0],p.artworks[0],{alongMm:4000,centerHeightMm:1500},{width:800,height:400}).alongMm).toBeGreaterThan(first.alongMm);
 c.lookAt(0,1.5,20);c.updateMatrixWorld();expect(artworkSnapTolerance3d(c,p.walls[0],p.artworks[0],{alongMm:4000,centerHeightMm:1500},{width:800,height:400})).toEqual({alongMm:0,centerHeightMm:0});
 expect(artworkSnapTolerance3d(c,p.walls[0],p.artworks[0],{alongMm:4000,centerHeightMm:1500},{width:0,height:0})).toEqual({alongMm:0,centerHeightMm:0});
});
