import {expect,it} from 'vitest';
import {localPresentationModelBytes} from './localPresentationModel';
import {testArtworkModel} from './modelArtworkTestFixture';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {modelAssetBounds} from './modelArtworkGeometry';
import {disposeModelAsset} from './modelAssetResources';
it('decodes the local GLB directly and preserves its actual mesh bounds',async()=>{
 const model=testArtworkModel(),bytes=localPresentationModelBytes(model.dataUrl),loaded=await new GLTFLoader().parseAsync(bytes,'');
 try{expect(modelAssetBounds(loaded.scene).sizeMm).toEqual(model.sizeMm.map(n=>expect.closeTo(n)));}finally{disposeModelAsset(loaded.scenes);}
});
it('rejects remote, malformed and non-GLB local model inputs before rendering',()=>{
 for(const value of ['https://example.com/a.glb','data:text/plain;base64,YQ==','data:model/gltf-binary;base64,YQ==','data:model/gltf-binary;base64,!!'])expect(()=>localPresentationModelBytes(value)).toThrow();
});
