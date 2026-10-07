import {expect,it,vi} from 'vitest';
import JSZip from 'jszip';
import {createDemoProject} from '../domain/model';
import type {Project,ReferenceModel} from '../domain/types';
import {testGlb} from './glbTestFixture';
import {exportProjectPackage,importProjectPackage,projectImageUrls,PROJECT_PACKAGE_MAX_BYTES} from './projectPackage';
import {appendSceneSnapshot} from '../domain/sceneSnapshot';

const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=';
const model:ReferenceModel={name:'원본.glb',dataUrl:'data:model/gltf-binary;base64,'+btoa(String.fromCharCode(...new Uint8Array(testGlb()))),visible:false,sizeMm:[12000,3000,8000],sourceOffsetM:[-6,0,-4],positionMm:[100,0,200],rotationDeg:90,scale:1.5};
function fixture():Project{
 const p=createDemoProject();p.name='백업 · 실측 5,200';p.id='backup-test';p.artworks=p.artworks.slice(0,2).map((a,i)=>({...a,imageUrl:png,note:'비공개 메모 gonggan-asset:그대로',wallSide:i?'back':'front',rotationDeg:i?30:0,visible:!i,locked:!!i}));
 const {wallId:_,...unplaced}=p.artworks[0];p.unplacedArtworks=[{...unplaced,id:'waiting',name:'미배치'}];
 p.walls[0].note='벽 메모';p.walls[1].locked=true;p.referenceModel=model;
 p.planImageUrl=png;p.planReference={widthPx:1,heightPx:1,origin:{x:0,z:0},mmPerPixel:20,calibrated:true};p.planOpacity=.4;p.sourcePlan={imageUrl:png,widthPx:1,heightPx:1,labels:[]};
 p.importedFloor=[[{x:0,z:0},{x:6000,z:0},{x:6000,z:4000},{x:0,z:4000}],[{x:1000,z:1000},{x:2000,z:1000},{x:2000,z:2000},{x:1000,z:2000}]];
 p.dimensions=[{id:'dimension-1',view:'plan',start:{kind:'wall',wallId:'wall-a',t:0,heightRatio:0,offsetMm:0,fallback:{x:-4000,y:0,z:-3000}},end:{kind:'fixed',fallback:{x:1200,y:0,z:-3000}},offsetMm:200}];
 p.scenes=[{id:'old-room',name:'이전 전시',artworks:structuredClone(p.artworks),wallVisibility:Object.fromEntries(p.walls.map(w=>[w.id,w.visible])),cameraView:{position:[10,8,10],target:[0,1,0],zoom:1},structure:{walls:structuredClone(p.walls),importedFloor:p.importedFloor,referenceModel:{...model,visible:true,rotationDeg:0},unplacedArtworks:structuredClone(p.unplacedArtworks),dimensions:structuredClone(p.dimensions),openings:[]}}];return p;
}
const sample=vi.fn(async()=>png);
async function packed(p=fixture()){return (await exportProjectPackage(p,sample)).arrayBuffer();}
async function edited(edit:(zip:JSZip)=>Promise<void>|void){const zip=await JSZip.loadAsync(await packed());await edit(zip);return zip.generateAsync({type:'arraybuffer'});}
async function updateProject(zip:JSZip,edit:(p:Project)=>void){const p=JSON.parse(await zip.file('project.json')!.async('string'));edit(p);const text=JSON.stringify(p),bytes=new TextEncoder().encode(text),manifest=JSON.parse(await zip.file('manifest.json')!.async('string'));manifest.project.bytes=bytes.length;manifest.project.sha256=Buffer.from(await crypto.subtle.digest('SHA-256',bytes)).toString('hex');zip.file('project.json',text);zip.file('manifest.json',JSON.stringify(manifest));}

it('restores every stored asset and editing field without a web path or input mutation',async()=>{
 const p=fixture(),before=structuredClone(p),blob=await exportProjectPackage(p,sample),zip=await JSZip.loadAsync(await blob.arrayBuffer(),{checkCRC32:true}),manifest=JSON.parse(await zip.file('manifest.json')!.async('string'));
 expect(blob.type).toBe('application/octet-stream');expect(manifest.assets).toHaveLength(2);expect(Object.keys(zip.files)).toHaveLength(5);expect(manifest.assets.map((a:{mime:string})=>a.mime).sort()).toEqual(['image/png','model/gltf-binary']);
 expect(await importProjectPackage(await blob.arrayBuffer())).toEqual(p);expect(p).toEqual(before);expect(projectImageUrls(p)).toEqual([png]);expect(await zip.file('README.txt')!.async('string')).toContain('내부 메모');
 const stored=await zip.file('project.json')!.async('string');expect(stored).not.toContain('data:image');expect(stored).toContain('비공개 메모 gonggan-asset:그대로');
});
it('packs Scene thumbnails as verified image assets and restores their view metadata',async()=>{
 const source=createDemoProject(),p=appendSceneSnapshot(source,source,'Preview',undefined,{imageUrl:png,widthPx:1,heightPx:1,view:'plan'});
 const blob=await exportProjectPackage(p,sample),zip=await JSZip.loadAsync(await blob.arrayBuffer()),stored=JSON.parse(await zip.file('project.json')!.async('string'));
 expect(stored.scenes[0].thumbnail.imageUrl).toMatch(/^gonggan-asset:/);expect(stored.scenes[0].thumbnail.view).toBe('plan');
 const restored=await importProjectPackage(await blob.arrayBuffer());expect(restored.scenes[0].thumbnail).toEqual(p.scenes[0].thumbnail);expect(projectImageUrls(restored)).toContain(png);
 const corrupt=await edited(zip=>updateProject(zip,p=>{p.scenes[0].thumbnail={imageUrl:'gonggan-asset:missing',widthPx:1,heightPx:1,view:'3d'};}));await expect(importProjectPackage(corrupt)).rejects.toThrow(/자산|참조/);
});
it('embeds sample panels once per unique source and deduplicates identical asset bytes',async()=>{
 const resolve=vi.fn(async()=>png),p=createDemoProject();p.scenes=[{id:'scene',name:'예제',artworks:structuredClone(p.artworks),wallVisibility:{}}];
 const blob=await exportProjectPackage(p,resolve),zip=await JSZip.loadAsync(await blob.arrayBuffer()),manifest=JSON.parse(await zip.file('manifest.json')!.async('string')),restored=await importProjectPackage(await blob.arrayBuffer());
 expect(resolve).toHaveBeenCalledTimes(5);expect(manifest.assets).toHaveLength(1);expect(projectImageUrls(restored)).toEqual([png]);expect(p.artworks[0].imageUrl).toBe('/artworks/artwork-1.png');expect(restored.scenes[0].artworks.every(a=>a.imageUrl===png)).toBe(true);
});
it('rejects tampered project, asset hashes and missing assets before returning a project',async()=>{
 await expect(importProjectPackage(await edited(zip=>{zip.file('project.json','{}');}))).rejects.toThrow(/크기|해시/);
 await expect(importProjectPackage(await edited(async zip=>{const manifest=JSON.parse(await zip.file('manifest.json')!.async('string')),path=manifest.assets[0].path,bytes=await zip.file(path)!.async('uint8array');bytes[bytes.length-1]^=1;zip.file(path,bytes,{createFolders:false});}))).rejects.toThrow(/해시/);
 await expect(importProjectPackage(await edited(async zip=>{const m=JSON.parse(await zip.file('manifest.json')!.async('string'));zip.remove(m.assets[0].path);}))).rejects.toThrow(/자산/);
});
it('rejects version, glTF ZIP, external references, orphan assets and invalid editing geometry',async()=>{
 await expect(importProjectPackage(await edited(async zip=>{const m=JSON.parse(await zip.file('manifest.json')!.async('string'));m.version=2;zip.file('manifest.json',JSON.stringify(m));}))).rejects.toThrow(/지원/);
 await expect(importProjectPackage(await edited(zip=>updateProject(zip,p=>{p.artworks[0].imageUrl='https://example.com/image.png';})))).rejects.toThrow(/참조/);
 await expect(importProjectPackage(await edited(zip=>updateProject(zip,p=>{p.walls[0].heightMm=-1;})))).rejects.toThrow(/벽 높이/);
 await expect(importProjectPackage(await edited(zip=>updateProject(zip,p=>{p.referenceModel=undefined;p.scenes[0].structure!.referenceModel=undefined;})))).rejects.toThrow(/참조되지/);
 const gltf=new JSZip();gltf.file('scene.gltf','{}');gltf.file('export-report.json','{}');gltf.file('README.txt','test');await expect(importProjectPackage(await gltf.generateAsync({type:'arraybuffer'}))).rejects.toThrow(/경로|프로젝트 백업/);
});
it('rejects traversal, duplicate filenames, encrypted and oversized expansion declarations',async()=>{
 await expect(importProjectPackage(await edited(zip=>{zip.file('../manifest.json','{}',{createFolders:false});}))).rejects.toThrow(/경로/);
 const original=new Uint8Array(await packed());
 const central=[];for(let i=0;i<original.length-46;i++)if(new DataView(original.buffer).getUint32(i,true)===0x02014b50)central.push(i);
 const oversized=original.slice(),view=new DataView(oversized.buffer);view.setUint32(central[0]+24,PROJECT_PACKAGE_MAX_BYTES+1,true);await expect(importProjectPackage(oversized.buffer)).rejects.toThrow(/크기/);
 const encrypted=original.slice();new DataView(encrypted.buffer).setUint16(central[0]+8,1,true);await expect(importProjectPackage(encrypted.buffer)).rejects.toThrow(/암호화/);
 const duplicate=original.slice(),dv=new DataView(duplicate.buffer),a=central[1],b=central[2],nameA=dv.getUint16(a+28,true),nameB=dv.getUint16(b+28,true);
 // project.json and README.txt differ in length; use two equal-length content hashes.
 expect(nameA).not.toBe(0);expect(nameB).not.toBe(0);
 const paths=central.filter(i=>dv.getUint16(i+28,true)>70),source=paths[0],target=paths[1];
 // images/<hash>.png and models/<hash>.glb have the same path length.
 expect(dv.getUint16(source+28,true)).toBe(dv.getUint16(target+28,true));duplicate.set(duplicate.subarray(source+46,source+46+dv.getUint16(source+28,true)),target+46);
 await expect(importProjectPackage(duplicate.buffer)).rejects.toThrow(/중복|헤더|경로/);
});
it('bounds actual decompression even when central directory sizes are forged smaller',async()=>{
 const bytes=new Uint8Array(await packed()),view=new DataView(bytes.buffer);for(let i=0;i<bytes.length-46;i++)if(view.getUint32(i,true)===0x02014b50){const length=view.getUint16(i+28,true),name=new TextDecoder().decode(bytes.subarray(i+46,i+46+length));if(name==='manifest.json')view.setUint32(i+24,1,true);}
 await expect(importProjectPackage(bytes.buffer)).rejects.toThrow(/manifest/);
});
it('fails sample loading and mismatched file signatures without creating a partial backup',async()=>{
 await expect(exportProjectPackage(createDemoProject(),async()=>{throw new Error('missing sample');})).rejects.toThrow('missing sample');
 const p=fixture();p.artworks[0].imageUrl='data:image/png;base64,AQIDBA==';await expect(exportProjectPackage(p,sample)).rejects.toThrow(/형식/);
});
