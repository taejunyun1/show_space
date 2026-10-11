import {afterEach,expect,it,vi} from 'vitest';
import {Mesh} from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {artworkTestGlb,artworkTestGltf} from './modelArtworkTestFixture';
import {inspectStaticArtworkDocument as inspectDocument,modelDataUrl,packEmbeddedGltf} from './artworkModelPayload';
import {loadStaticModel} from './loadStaticModel';
import {disposeModelAsset} from './modelAssetResources';
import {modelAssetBounds} from './modelArtworkGeometry';
import {venueTestGlb} from './venueModelTestFixture';
import {readModelFile} from './modelImport';

afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
// Assemble malformed real GLBs without calling the validator under test.
function rewrite(change:(doc:any)=>void,bytes=artworkTestGlb()){
 const view=new DataView(bytes),length=view.getUint32(12,true),doc=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,length)));change(doc);
 const json=new TextEncoder().encode(JSON.stringify(doc)),padded=Math.ceil(json.length/4)*4,tail=new Uint8Array(bytes,20+length),out=new Uint8Array(20+padded+tail.length),header=new DataView(out.buffer);
 out.set(new Uint8Array(bytes,0,12));header.setUint32(8,out.length,true);header.setUint32(12,padded,true);header.setUint32(16,0x4e4f534a,true);out.fill(32,20,20+padded);out.set(json,20);out.set(tail,20+padded);return out.buffer;
}
async function rejectedBeforeLoader(change:(doc:any)=>void,message:string){
 const bytes=rewrite(change),parse=vi.spyOn(GLTFLoader.prototype,'parseAsync');
 await expect(loadStaticModel(bytes)).rejects.toThrow(message);expect(parse).not.toHaveBeenCalled();
}
it('rejects a truncated vertex span before allocating loader buffers',()=>rejectedBeforeLoader(d=>d.accessors[0].count++,'정점 버퍼'));
it('rejects mismatching normal counts before loading a partial model',()=>rejectedBeforeLoader(d=>d.accessors[1].count--,'정점 속성'));
it('rejects missing attribute accessors before the loader starts',()=>rejectedBeforeLoader(d=>d.meshes[0].primitives[0].attributes.NORMAL=999,'정점 속성'));
it.each([8,14,256])('rejects an invalid vertex stride of %i before loading',stride=>rejectedBeforeLoader(d=>d.bufferViews[0].byteStride=stride,'정점 버퍼'));
it('rejects misaligned float offsets before loading',()=>rejectedBeforeLoader(d=>d.accessors[0].byteOffset=2,'정점 버퍼'));
function hierarchy(d:any,edges:number,backwards:boolean){
 d.nodes=Array.from({length:edges+1},(_,i)=>backwards?(i?{children:[i-1]}:{mesh:0}):(i===edges?{mesh:0}:{children:[i+1]}));d.scenes=[{nodes:[backwards?edges:0]}];
}
it.each([true,false])('rejects too-deep groups regardless of node ordering (%s)',backwards=>rejectedBeforeLoader(d=>hierarchy(d,61,backwards),'계층'));
it.each([true,false])('loads valid groups at the existing depth limit (%s)',async backwards=>{
 const bytes=rewrite(d=>hierarchy(d,60,backwards)),gltf=await loadStaticModel(bytes);
 try{expect(modelAssetBounds(gltf.scene).sizeMm).toEqual([1000,1000,1000]);let count=0;gltf.scene.traverse(o=>{if(o instanceof Mesh)count++;});expect(count).toBe(1);}finally{disposeModelAsset(gltf.scenes);}
});
it.each([false,true])('preserves interleaved positions and normals with optional last-row padding (%s)',omitPadding=>{
 return interleavedModel(omitPadding);
});
async function interleavedModel(omitPadding:boolean){
 const {doc}=artworkTestGltf(),raw=new Uint8Array(Buffer.from(doc.buffers[0].uri.split(',')[1],'base64')),interleaved=new Uint8Array(raw.length);
 for(let i=0;i<24;i++){interleaved.set(raw.subarray(i*12,i*12+12),i*32);interleaved.set(raw.subarray(288+i*12,288+i*12+12),i*32+12);interleaved.set(raw.subarray(576+i*8,576+i*8+8),i*32+24);}
 doc.buffers[0].uri=modelDataUrl(interleaved.buffer).replace('model/gltf-binary','application/octet-stream');Object.assign(doc.bufferViews[0],{byteLength:raw.length,byteStride:32});Object.assign(doc.accessors[1],{bufferView:0,byteOffset:12});Object.assign(doc.accessors[3],{bufferView:0,byteOffset:24});
 if(omitPadding){doc.bufferViews[0].byteLength-=8;Object.assign(doc.accessors[3],{bufferView:3,byteOffset:0});for(const mesh of doc.meshes)delete (mesh.primitives[0].attributes as Record<string,number>).TEXCOORD_0;}
 const gltf=await loadStaticModel(packEmbeddedGltf(doc));try{let mesh:Mesh|undefined;gltf.scene.traverse(o=>{if(o instanceof Mesh)mesh=o;});expect(mesh).toBeTruthy();const data=new DataView(raw.buffer);for(const [key,start,size] of [['position',0,3],['normal',288,3],['uv',576,2]] as const){if(omitPadding&&key==='uv')continue;const a=mesh!.geometry.getAttribute(key);for(let i=0;i<24;i++)for(let j=0;j<size;j++)expect(a.getComponent(i,j)).toBe(data.getFloat32(start+(i*size+j)*4,true));}}finally{disposeModelAsset(gltf.scenes);}
}
it('imports a 30-room whole-venue fixture with 450 meshes and preserves its actual bounds',async()=>{
 const bytes=rewrite(d=>{const original=d.nodes.slice(0,-1);d.nodes=[];const roots=[];for(let row=0;row<5;row++)for(let col=0;col<6;col++){const start=d.nodes.length;d.nodes.push(...structuredClone(original));const root=d.nodes.length;d.nodes.push({translation:[10+12*col,2,5+8*row],children:original.map((_:unknown,i:number)=>start+i)});roots.push(root);}d.nodes.push({children:roots});d.scenes=[{nodes:[d.nodes.length-1]}];},venueTestGlb());
 vi.stubGlobal('FileReader',class{result:unknown;onload?:()=>void;readAsDataURL(blob:Blob){void blob.arrayBuffer().then(b=>{this.result='data:model/gltf-binary;base64,'+Buffer.from(b).toString('base64');this.onload?.();});}});
 const input=new File([bytes],'owned-30-room-venue.glb'),model=await readModelFile(input),gltf=await loadStaticModel(bytes);
 try{expect(model.sizeMm).toEqual([expect.closeTo(72000),expect.closeTo(3000),expect.closeTo(40000)]);expect(model.sourceOffsetM).toEqual([expect.closeTo(-40),expect.closeTo(-2),expect.closeTo(-21)]);const geometries=new Set(),meshes:Mesh[]=[];gltf.scene.traverse(o=>{if(o instanceof Mesh){meshes.push(o);geometries.add(o.geometry);}});expect(meshes).toHaveLength(450);expect(geometries.size).toBeLessThanOrEqual(4);expect(Buffer.from(model.dataUrl.split(',')[1],'base64').equals(Buffer.from(bytes))).toBe(true);
 if(process.env.GONGGAN_PREFLIGHT_PROOF==='1'){const {mkdir,writeFile}=await import('node:fs/promises');await mkdir('docs/validation/model-preflight-2026-10-11',{recursive:true});await writeFile('docs/validation/model-preflight-2026-10-11/venue.glb',new Uint8Array(bytes));await writeFile('docs/validation/model-preflight-2026-10-11/venue.json',JSON.stringify({rooms:30,meshes:450,geometryResources:geometries.size,bytes:bytes.byteLength,sizeMm:model.sizeMm,sourceOffsetM:model.sourceOffsetM,originalBytesPreserved:true,gpuMeasured:false},null,2)+'\n');}
 }finally{disposeModelAsset(gltf.scenes);}
});
it('bounds copies of overlapping vertex views even when the file and triangles fit',()=>{
 const bytes=rewrite(d=>{
  // 22 views of the same 2.4MB span require >48MiB of GLTFLoader copies.
  const raw=new Uint8Array(2_400_000);d.buffers=[{byteLength:raw.length}];d.bufferViews=Array.from({length:22},()=>({buffer:0,byteOffset:0,byteLength:raw.length}));d.accessors=d.bufferViews.map((_:unknown,i:number)=>({bufferView:i,componentType:5126,count:200000,type:'VEC3',min:[0,0,0],max:[0,0,0]}));
  const attributes=Object.fromEntries(d.accessors.map((_:unknown,i:number)=>[i?'_CUSTOM_'+i:'POSITION',i]));d.meshes=[{primitives:[{attributes,mode:0}]}];d.nodes=[{mesh:0}];d.scenes=[{nodes:[0]}];
 });
 // Inspect document metadata directly, so the old-code comparison never asks
 // Three to allocate the intentionally duplicated buffers.
 const v=new DataView(bytes),doc=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,v.getUint32(12,true))));
 // GLB contents above deliberately retain the tiny original BIN: this test is
 // about preflight copied-view demand, independently of the container check.
 expect(()=>inspectDocument(doc)).toThrow('정점 자산');
});
