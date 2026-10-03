import {expect,it,vi} from 'vitest';
import {BoxGeometry,ExtrudeGeometry,ShapeGeometry,Shape,Texture,RepeatWrapping,SRGBColorSpace,Mesh,MeshStandardMaterial} from 'three';
import {wallMetricUv,floorMetricUv,repeatingSurfaceTexture} from './surfaceUv';
import {buildExportScene,disposeExportScene} from './exportScene';
import {createDemoProject} from '../domain/model';
import {materialPreset} from '../domain/materials';
function extent(geometry:BoxGeometry,axis:'x'|'y'|'z'){
 const uv=geometry.getAttribute('uv'),n=geometry.getAttribute('normal'),values=[];for(let i=0;i<n.count;i++)if(Math.abs(axis==='x'?n.getX(i):axis==='y'?n.getY(i):n.getZ(i))>.5)values.push([uv.getX(i),uv.getY(i)]);
 return [Math.max(...values.map(v=>v[0]))-Math.min(...values.map(v=>v[0])),Math.max(...values.map(v=>v[1]))-Math.min(...values.map(v=>v[1]))];
}
it('keeps one-meter UVs on all six wall faces, including changed dimensions',()=>{
 for(const width of [4,8]){const g=wallMetricUv(new BoxGeometry(width,3,.16));expect(extent(g,'z')).toEqual([width,3]);expect(extent(g,'x')[0]).toBeCloseTo(.16);expect(extent(g,'y')[0]).toBe(width);g.dispose();}
});
it('aligns editor/export and flat public floor UVs at the same physical world points',()=>{
 const shape=new Shape().moveTo(-4,-3).lineTo(4,-3).lineTo(4,3).lineTo(-4,3).closePath(),flat=new Shape().moveTo(-4,3).lineTo(4,3).lineTo(4,-3).lineTo(-4,-3).closePath();
 const extrusion=floorMetricUv(new ExtrudeGeometry(shape,{depth:.16,bevelEnabled:false})),publicFloor=floorMetricUv(new ShapeGeometry(flat),1);
 for(const [g,sign] of [[extrusion,-1],[publicFloor,1]] as const){const pos=g.getAttribute('position'),normal=g.getAttribute('normal'),uv=g.getAttribute('uv');for(let i=0;i<pos.count;i++)if(Math.abs(normal.getZ(i))>.5){expect(uv.getX(i)).toBeCloseTo(pos.getX(i));expect(uv.getY(i)).toBeCloseTo(sign*pos.getY(i));}g.dispose();}
});
it('clones per-surface texture scale without changing the source or another material',()=>{
 const source=new Texture(),a=repeatingSurfaceTexture(source,{widthMm:500,heightMm:250}),b=repeatingSurfaceTexture(source,{widthMm:1000,heightMm:1000});expect(a.repeat.toArray()).toEqual([2,4]);expect(b.repeat.toArray()).toEqual([1,1]);expect(source.repeat.toArray()).toEqual([1,1]);expect(a.wrapS).toBe(RepeatWrapping);expect(a.colorSpace).toBe(SRGBColorSpace);[source,a,b].forEach(t=>t.dispose());
});
it('exports independent wall and floor transforms and never drops a missing surface image',()=>{
 const p=createDemoProject();p.artworks=[];const imageUrl='data:image/png;base64,AAAA';p.walls[0].material={...materialPreset('wood').material,texture:{imageUrl,widthMm:500,heightMm:250}};p.floorMaterial={...materialPreset('wood').material,texture:{imageUrl,widthMm:1000,heightMm:1000}};
 expect(()=>buildExportScene(p)).toThrow(/텍스처/);const source=new Texture(),scene=buildExportScene(p,undefined,undefined,new Map([[imageUrl,source]]));
 const wall=scene.getObjectByName('wall-wall-a') as Mesh<BoxGeometry,MeshStandardMaterial>,floor=scene.getObjectByName('floor-1') as Mesh<ExtrudeGeometry,MeshStandardMaterial>;
 expect(wall.material.map!.repeat.toArray()).toEqual([2,4]);expect(floor.material.map!.repeat.toArray()).toEqual([1,1]);expect(extent(wall.geometry,'z')).toEqual([8,3.200000047683716]);expect(wall.material.map).not.toBe(floor.material.map);const dispose=vi.spyOn(wall.material.map!,'dispose');disposeExportScene(scene);expect(dispose).toHaveBeenCalledOnce();source.dispose();
});
