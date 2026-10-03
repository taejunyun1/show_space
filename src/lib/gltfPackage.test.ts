import {expect,it} from 'vitest';
import JSZip from 'jszip';
import {createDemoProject} from '../domain/model';
import {createGltfFiles,zipGltfFiles} from './gltfPackage';

const binary='data:application/octet-stream;base64,AAECAw==',image='data:image/png;base64,AQIDBA==';
it('packages relative buffers and deduplicated images without mutating transforms or indices',()=>{
 const source={asset:{version:'2.0'},buffers:[{uri:binary,byteLength:4}],bufferViews:[{buffer:0,byteOffset:0,byteLength:4}],images:[{uri:image,mimeType:'image/png'},{uri:image}],textures:[{source:1}],nodes:[{name:'작품',translation:[1,2,3],rotation:[0,0,.5,.866],scale:[2,2,2]}],meshes:[{primitives:[]}],scenes:[{nodes:[0]}],scene:0};
 const before=structuredClone(source),files=createGltfFiles(source,createDemoProject()),doc=JSON.parse(new TextDecoder().decode(files.get('scene.gltf')));
 expect(source).toEqual(before);expect(doc.nodes).toEqual(source.nodes);expect(doc.bufferViews).toEqual(source.bufferViews);expect(doc.textures).toEqual(source.textures);expect(doc.buffers[0].uri).toBe('buffers/buffer-1.bin');expect([...files.get(doc.buffers[0].uri)!]).toEqual([0,1,2,3]);expect(doc.images.map((i:{uri:string})=>i.uri)).toEqual(['textures/image-1.png','textures/image-1.png']);expect(files.size).toBe(5);
 const report=JSON.parse(new TextDecoder().decode(files.get('export-report.json')));expect(report.units).toBe('meter');expect(report.counts.images).toBe(2);expect(report.files.every((f:{path:string;bytes:number})=>files.get(f.path)!.byteLength===f.bytes)).toBe(true);
});
it('retains valid embedded buffer-view images and separates multiple buffers',()=>{
 const files=createGltfFiles({asset:{version:'2.0'},buffers:[{uri:binary,byteLength:4},{uri:binary,byteLength:4}],images:[{bufferView:0,mimeType:'image/png'}]},createDemoProject());
 const doc=JSON.parse(new TextDecoder().decode(files.get('scene.gltf')));expect(doc.images[0]).toEqual({bufferView:0,mimeType:'image/png'});expect(files.has('buffers/buffer-2.bin')).toBe(true);
});
it('rejects missing, remote and corrupt resources instead of producing an incomplete archive',()=>{
 const p=createDemoProject();expect(()=>createGltfFiles({asset:{version:'1.0'}},p)).toThrow(/2.0/);
 for(const uri of ['https://example.com/model.bin','../secret','data:application/octet-stream;base64,A===',undefined])expect(()=>createGltfFiles({asset:{version:'2.0'},buffers:[{uri,byteLength:4}]},p)).toThrow();
 expect(()=>createGltfFiles({asset:{version:'2.0'},buffers:[{uri:binary,byteLength:5}]},p)).toThrow(/크기/);
 expect(()=>createGltfFiles({asset:{version:'2.0'},images:[{uri:image,mimeType:'image/jpeg'}]},p)).toThrow(/형식/);
 expect(()=>createGltfFiles({asset:{version:'2.0'},images:[{uri:'https://example.com/art.png'}]},p)).toThrow(/포함/);
});
it('produces a CRC-valid ZIP with every glTF resource and Korean instructions',async()=>{
 const files=createGltfFiles({asset:{version:'2.0'},buffers:[{uri:binary,byteLength:4}],images:[{uri:image}]},createDemoProject()),blob=await zipGltfFiles(files),zip=await JSZip.loadAsync(await blob.arrayBuffer(),{checkCRC32:true});
 for(const [name,bytes] of files)expect(await zip.file(name)!.async('uint8array')).toEqual(bytes);
 expect(await zip.file('읽어주세요.txt')!.async('string')).toContain('scene.gltf');expect(blob.type).toBe('application/octet-stream');
});
