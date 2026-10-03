import {expect,it} from 'vitest';
import {parseSurfaceTexture} from './surfaceTexture';
import {materialPreset,parseSurfaceMaterial} from './materials';
import {createDemoProject,parseProject} from './model';
import {createPublicShare,parsePublicShare,publicImageIds} from './publicShare';
const url='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=';
const texture={imageUrl:url,widthMm:500,heightMm:300};
it('allows only stored raster textures with bounded finite physical sizes',()=>{
 expect(parseSurfaceTexture({...texture,privateNote:'SECRET'})).toEqual(texture);
 for(const patch of [{widthMm:0},{heightMm:Infinity},{widthMm:1_000_001},{widthMm:'500'},{imageUrl:'https://example.test/a.jpg'},{imageUrl:'data:image/svg+xml;base64,AAAA'},{imageUrl:'data:image/png;base64,'},{imageUrl:'gonggan-asset:assets/a.png'}])expect(()=>parseSurfaceTexture({...texture,...patch})).toThrow();
 const m={...materialPreset('wood').material,texture};expect(parseSurfaceMaterial(m)).toEqual(m);
});
it('retains textured surfaces in JSON and forbids replacing original artwork images',()=>{
 const p=createDemoProject();p.floorMaterial={...materialPreset('wood').material,texture};p.walls[0].material={...materialPreset('white-paint').material,texture};expect(parseProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
 p.artworks[0].material={...materialPreset('canvas').material,texture};expect(()=>parseProject(p)).toThrow(/作品|작품/);
});
it('shares floor/wall textures as deduplicated image IDs and excludes hidden surface assets',()=>{
 const p=createDemoProject();p.artworks=p.artworks.slice(0,1);p.floorMaterial={...materialPreset('wood').material,texture};p.walls[0].material={...materialPreset('white-paint').material,texture:{...texture,widthMm:1000}};p.walls[1].visible=false;p.walls[1].material={...materialPreset('wood').material,texture:{...texture,imageUrl:'data:image/png;base64,c2VjcmV0'}};
 const {snapshot,uploads}=createPublicShare(p,{includeDimensions:false});expect(uploads).toHaveLength(2);expect(uploads[1]).toEqual({imageId:'1',sourceUrl:url});expect(snapshot.floorMaterial?.texture).toEqual({imageId:'1',widthMm:500,heightMm:300});expect(snapshot.walls[0].material?.texture?.widthMm).toBe(1000);expect(publicImageIds(snapshot)).toEqual(['0','1']);expect(JSON.stringify(snapshot)).not.toContain('imageUrl');expect(JSON.stringify(snapshot)).not.toContain('c2VjcmV0');
 expect(parsePublicShare({...snapshot,floorMaterial:{...snapshot.floorMaterial,texture:{...snapshot.floorMaterial!.texture,privateNote:'SECRET',imageUrl:url}}})).toEqual(snapshot);
 expect(()=>parsePublicShare({...snapshot,floorMaterial:{...snapshot.floorMaterial,texture:{imageId:'../0',widthMm:500,heightMm:500}}})).toThrow();
});
