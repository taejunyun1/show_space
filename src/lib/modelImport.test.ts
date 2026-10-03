import {expect,it,vi} from 'vitest';
import {readModelFile} from './modelImport';
import {venueTestGlb} from './venueModelTestFixture';
import {artworkTestGltf} from './modelArtworkTestFixture';
import {packEmbeddedGltf} from './artworkModelPayload';
// Only FileReader's data URL transport is stubbed; glTF decoding and geometry remain real.
async function withFileReader(run:()=>Promise<void>){
 class Reader {result:unknown;onload?:()=>void;onerror?:()=>void;readAsDataURL(blob:Blob){void blob.arrayBuffer().then(bytes=>{this.result='data:model/gltf-binary;base64,'+Buffer.from(bytes).toString('base64');this.onload?.();});}}
 vi.stubGlobal('FileReader',Reader);try{await run();}finally{vi.unstubAllGlobals();}
}
it('imports an entire venue with actual source size and normalized floor origin',async()=>withFileReader(async()=>{
 const m=await readModelFile(new File([venueTestGlb()],'venue.glb'));expect(m.sizeMm).toEqual([expect.closeTo(12000),expect.closeTo(3000),expect.closeTo(8000)]);expect(m.sourceOffsetM).toEqual([expect.closeTo(-10),expect.closeTo(-2),expect.closeTo(-5)]);expect(m.visible).toBe(true);expect(m.scale).toBe(1);
}));
it('computes actual decoded vertices instead of trusting inaccurate accessor bounds',async()=>withFileReader(async()=>{
 const {doc}=artworkTestGltf();doc.accessors[0].min=[0,0,0];doc.accessors[0].max=[0,0,0];const m=await readModelFile(new File([packEmbeddedGltf(doc)],'bad-bounds.glb'));expect(m.sizeMm).toEqual([expect.closeTo(1200),expect.closeTo(2100),expect.closeTo(900)]);expect(m.sourceOffsetM).toEqual([expect.closeTo(-10),expect.closeTo(-2),expect.closeTo(-5)]);
}));
it('rejects broken inputs before creating a model',async()=>{
 await expect(readModelFile(new File([new Uint8Array([1,2,3])],'broken.glb'))).rejects.toThrow('GLB');
});
