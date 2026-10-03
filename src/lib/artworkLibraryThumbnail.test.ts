import {expect,it} from 'vitest';
import {OrthographicCamera,Vector3} from 'three';
import {artworkLibraryThumbnailView} from './artworkLibraryThumbnail';
it('includes every corner at a consistent thumbnail fill for small, large, flat and tall models',()=>{
 for(const dimensions of [[1,1,1],[50000,50000,50000],[1200,2100,900],[50000,1,50000],[1,50000,1]] as [number,number,number][]){
  const v=artworkLibraryThumbnailView(dimensions),camera=new OrthographicCamera(-128,128,128,-128,.01,10000);camera.position.set(...v.position);camera.lookAt(new Vector3(...v.target));camera.zoom=v.zoom;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  const [w,h,d]=dimensions.map(n=>n/1000);let fill=0;
  for(const x of [-w/2,w/2])for(const y of [0,h])for(const z of [-d/2,d/2]){const p=new Vector3(x,y,z).project(camera);expect(Math.abs(p.x)).toBeLessThan(.86);expect(Math.abs(p.y)).toBeLessThan(.86);expect(p.z).toBeGreaterThan(-1);expect(p.z).toBeLessThan(1);fill=Math.max(fill,Math.abs(p.x),Math.abs(p.y));}
  expect(fill).toBeCloseTo(.85);
 }
});
