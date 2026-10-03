import {expect,it} from 'vitest';
import {inspectGlb} from './glbPayload';
import {testGlb} from './glbTestFixture';
it('accepts embedded GLB and rejects truncated or invalid container data',()=>{
 expect(inspectGlb(testGlb()).asset.version).toBe('2.0');
 expect(()=>inspectGlb(testGlb().slice(0,25))).toThrow(/GLB/);
 expect(()=>inspectGlb(new ArrayBuffer(30))).toThrow(/GLB/);
});
it('rejects external geometry and image requests before the loader runs',()=>{
 expect(()=>inspectGlb(testGlb({buffers:[{uri:'https://example.com/data.bin'}]}))).toThrow(/外部|외부/);
 expect(()=>inspectGlb(testGlb({images:[{uri:'http://localhost/private'}]}))).toThrow(/텍스처/);
 expect(inspectGlb(testGlb({images:[{uri:'data:image/png;base64,YQ=='}]}))).toBeTruthy();
});
it('reports unsupported required compression instead of silently omitting geometry',()=>{
 expect(()=>inspectGlb(testGlb({extensionsRequired:['KHR_draco_mesh_compression']}))).toThrow(/압축/);
});
