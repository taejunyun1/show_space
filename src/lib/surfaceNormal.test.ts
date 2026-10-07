import {expect,it,vi} from 'vitest';
import {Texture,Mesh,MeshStandardMaterial,NoColorSpace,SRGBColorSpace} from 'three';
import JSZip from 'jszip';
import {IDBFactory} from 'fake-indexeddb';
import {parseSurfaceNormal} from '../domain/surfaceNormal';
import {materialPreset,parseSurfaceMaterial} from '../domain/materials';
import {patchSurfaceMaterial,setMaterialFinish} from '../domain/materialEditing';
import {createDemoProject,parseProject} from '../domain/model';
import {appendSceneSnapshot} from '../domain/sceneSnapshot';
import {sceneProject} from '../domain/sceneProject';
import {createPublicShare,parsePublicShare,publicImageIds} from '../domain/publicShare';
import {applyMaterialTemplate} from '../domain/materialLibrary';
import {normalPixels} from './readSurfaceNormal';
import {repeatingNormalTexture} from './surfaceUv';
import {buildExportScene,disposeExportScene} from './exportScene';
import {exportProjectPackage,importProjectPackage,projectImageUrls} from './projectPackage';
import {prepareSharePresentation} from './sharePresentation';
import {createMaterialLibrary} from './materialLibrary';

const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=';
const normal={imageUrl:png,widthMm:500,heightMm:250,strength:1.75};
const finish=()=>({...materialPreset('wood').material,normal});

it('validates stored normal PNG bounds, strength and physical scale while keeping old materials unchanged',()=>{
 expect(parseSurfaceNormal({...normal,note:'PRIVATE'})).toEqual(normal);
 expect(parseSurfaceMaterial(materialPreset('wood').material)).toEqual(materialPreset('wood').material);
 for(const strength of [-.1,5.1,NaN,Infinity,undefined])expect(()=>parseSurfaceNormal({...normal,strength})).toThrow(/강도/);
 for(const imageUrl of ['https://example.test/normal.png','data:image/png;base64,AAAA','data:image/jpeg;base64,AAAA'])expect(()=>parseSurfaceNormal({...normal,imageUrl})).toThrow();
 expect(()=>parseSurfaceNormal({...normal,widthMm:0})).toThrow();
 const large=Uint8Array.from(atob(png.split(',')[1]),c=>c.charCodeAt(0));new DataView(large.buffer).setUint32(16,1025);
 expect(()=>parseSurfaceNormal({...normal,imageUrl:'data:image/png;base64,'+btoa(String.fromCharCode(...large))})).toThrow(/1,024/);
 expect(parseSurfaceNormal({...normal,strength:0}).strength).toBe(0);
});
it('converts DirectX green values exactly once without changing red/blue or accepting transparent pixels',()=>{
 const data=new Uint8ClampedArray([128,32,244,255,200,255,190,255]);
 expect([...normalPixels(data,'directx')]).toEqual([128,223,244,255,200,0,190,255]);
 expect(normalPixels(data,'opengl')).toEqual(data);expect([...data]).toEqual([128,32,244,255,200,255,190,255]);
 expect(()=>normalPixels(new Uint8ClampedArray([128,128,255,0]),'opengl')).toThrow(/투명/);
});
it('keeps normal maps when editing finishes, strength or applying library designs to image artworks',()=>{
 const original=finish(),changed=patchSurfaceMaterial(original,{normal:{...normal,strength:0}});
 expect(changed.normal?.strength).toBe(0);expect(changed.texture).toBeUndefined();expect(original.normal.strength).toBe(1.75);
 expect(setMaterialFinish(original,'glossy').normal).toEqual(normal);
 const p=createDemoProject(),t={name:'요철',category:'custom' as const,color:'#ffffff',material:{...finish(),texture:{...normal}}};
 const next=applyMaterialTemplate(p,{type:'artwork',id:p.artworks[0].id},t,p.id);
 expect(next.artworks[0].material?.normal).toEqual(normal);expect(next.artworks[0].material?.texture).toBeUndefined();
 expect(next.artworks[0].imageUrl).toBe(p.artworks[0].imageUrl);expect(next.artworks[0].widthMm).toBe(p.artworks[0].widthMm);
 expect(parseProject(next)).toEqual(next);
});
it('uses linear per-surface normal maps with metric repeat, independent image repeat and unchanged source textures',()=>{
 const p=createDemoProject();p.floorMaterial=finish();p.walls[0].material={...finish(),texture:{imageUrl:png,widthMm:2000,heightMm:1000}};p.artworks[0].material=finish();
 const source=new Texture();source.colorSpace=SRGBColorSpace;
 expect(()=>buildExportScene(p)).toThrow(/텍스처|노멀/);
 const scene=buildExportScene(p,undefined,undefined,new Map([[png,source]]));
 const wall=(scene.getObjectByName('wall-wall-a') as Mesh).material as MeshStandardMaterial;
 const floor=(scene.getObjectByName('floor-1') as Mesh).material as MeshStandardMaterial;
 const artwork=(scene.getObjectByName('image') as Mesh).material as MeshStandardMaterial;
 expect(wall.map!.repeat.toArray()).toEqual([.5,1]);expect(wall.map!.colorSpace).toBe(SRGBColorSpace);
 expect(wall.normalMap!.repeat.toArray()).toEqual([2,4]);expect(wall.normalMap!.colorSpace).toBe(NoColorSpace);expect(wall.normalScale.toArray()).toEqual([1.75,1.75]);
 expect(artwork.normalMap!.repeat.toArray()).toEqual([1.8,4.8]);expect(artwork.normalMap).not.toBe(wall.normalMap);expect(floor.normalMap).not.toBe(wall.normalMap);
 expect(source.colorSpace).toBe(SRGBColorSpace);expect(source.repeat.toArray()).toEqual([1,1]);
 const disposed=vi.spyOn(wall.normalMap!,'dispose');disposeExportScene(scene);expect(disposed).toHaveBeenCalledOnce();source.dispose();
 const data=new Texture(),n=repeatingNormalTexture(data,normal,[2,3]);expect(n.repeat.toArray()).toEqual([4,12]);n.dispose();data.dispose();
});
it('packages wall/floor/artwork/unplaced and saved Scene maps as hashed assets and restores every value',async()=>{
 let p=createDemoProject();p.artworks=p.artworks.slice(0,1);p.artworks[0].imageUrl=png;p.artworks[0].material=finish();p.walls[0].material=finish();p.floorMaterial={...finish(),normal:{...normal,strength:0}};
 const {wallId:_,...unplaced}=p.artworks[0];p.unplacedArtworks=[{...unplaced,id:'waiting'}];
 p=appendSceneSnapshot(p,p,'normal Scene');const before=structuredClone(p);
 const blob=await exportProjectPackage(p,async()=>png),zip=await JSZip.loadAsync(await blob.arrayBuffer()),stored=JSON.parse(await zip.file('project.json')!.async('string'));
 expect(stored.walls[0].material.normal.imageUrl).toMatch(/^gonggan-asset:/);expect(stored.scenes[0].structure.floorMaterial.normal.imageUrl).toMatch(/^gonggan-asset:/);
 expect(stored.unplacedArtworks[0].material.normal.imageUrl).toMatch(/^gonggan-asset:/);expect(await importProjectPackage(await blob.arrayBuffer())).toEqual(p);
 expect(projectImageUrls(p)).toEqual([png]);expect(p).toEqual(before);
 p.walls[0].material!.normal!.strength=3;expect(sceneProject(p,p.scenes[0]).walls[0].material!.normal!.strength).toBe(1.75);
});
it('allowlists normal references, includes only visible maps and remaps changed Scene normal assets globally',async()=>{
 let p=createDemoProject();p.artworks=p.artworks.slice(0,1);p.artworks[0].imageUrl=png;p.artworks[0].material=finish();p.walls[0].material=finish();p.floorMaterial=finish();
 const result=createPublicShare(p,{includeDimensions:false});expect(result.snapshot.artworks[0].material?.normal?.strength).toBe(1.75);
 expect(publicImageIds(result.snapshot)).toEqual(['0','1']);expect(JSON.stringify(result.snapshot)).not.toMatch(/imageUrl|data:|note/);
 const raw=structuredClone(result.snapshot);Object.assign(raw.floorMaterial!.normal!,{imageUrl:'PRIVATE',note:'PRIVATE'});expect(JSON.stringify(parsePublicShare(raw))).not.toContain('PRIVATE');
 for(const strength of [-1,NaN,6]){raw.floorMaterial!.normal!.strength=strength;expect(()=>parsePublicShare(raw)).toThrow(/강도/);}
 p=appendSceneSnapshot(p,p,'normals');p.scenes[0].structure!.walls[0].material!.normal!.imageUrl=png.replace('O+a2io','O+aEmk');
 const prepared=await prepareSharePresentation(p,{includeDimensions:false,sceneIds:[p.scenes[0].id]});
 expect(prepared.uploads).toHaveLength(2);expect(prepared.snapshot.floorMaterial?.normal?.imageId).toBe('0');expect(prepared.snapshot.artworks[0].material?.normal?.imageId).toBe('0');expect(prepared.snapshot.scenes![0].snapshot.walls[0].material?.normal?.imageId).toBe('1');
 const hidden=createDemoProject();hidden.walls[0].material=finish();hidden.walls[0].visible=false;expect(createPublicShare(hidden,{includeDimensions:false}).uploads.every(u=>u.sourceUrl!==png)).toBe(true);
});
it('stores normal-only library entries and restores full maps and zero strength across IndexedDB connections',async()=>{
 const f=new IDBFactory(),a=createMaterialLibrary(f),b=createMaterialLibrary(f),template={name:'노멀만',category:'custom' as const,color:'#ffffff',material:{...finish(),normal:{...normal,strength:0}}};
 const item=await a.add(template);expect((await b.list())[0].textured).toBe(true);expect((await b.read(item.id))!.template).toEqual(template);
 const restored=createMaterialLibrary(new IDBFactory()),[summary]=await restored.restore(await b.backup());expect((await restored.read(summary.id))!.template).toEqual(template);
});
