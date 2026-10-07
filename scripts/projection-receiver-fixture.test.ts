import {expect,it,vi} from 'vitest';
import {mkdir,writeFile} from 'node:fs/promises';
import {projectionReceiverFixture} from '../src/lib/projectionReceiverFixture';
import {exportProjectGlb,exportProjectGltf} from '../src/lib/modelExport';
import {inspectGlb} from '../src/lib/glbPayload';
import JSZip from 'jszip';
it.skipIf(process.env.GONGGAN_PROJECTION_RECEIVER!=='1')('writes real app GLB/glTF files for independent projection omission checks',async()=>{
 vi.stubGlobal('FileReader',class{result:ArrayBuffer|string|null=null;onloadend:(()=>void)|null=null;readAsArrayBuffer(blob:Blob){void blob.arrayBuffer().then(b=>{this.result=b;this.onloadend?.();});}readAsDataURL(blob:Blob){void blob.arrayBuffer().then(b=>{this.result=`data:${blob.type||'application/octet-stream'};base64,${Buffer.from(b).toString('base64')}`;this.onloadend?.();});}});
 vi.stubGlobal('ProgressEvent',class{constructor(public type:string,public init:unknown){}});
 try{const p=projectionReceiverFixture(),before=JSON.stringify(p),bytes=await(await exportProjectGlb(p)).arrayBuffer(),doc=inspectGlb(bytes),zip=await JSZip.loadAsync(await(await exportProjectGltf(p)).arrayBuffer(),{checkCRC32:true});expect(JSON.stringify(p)).toBe(before);expect(doc.extensions.KHR_lights_punctual.lights).toHaveLength(1);
  const dir='/tmp/gonggan-projection-receiver-20261007';await mkdir(dir,{recursive:true});await writeFile(dir+'/project.json',JSON.stringify(p,null,2));await writeFile(dir+'/scene.glb',new Uint8Array(bytes));for(const [path,file] of Object.entries(zip.files))if(!file.dir){const {dirname}=await import('node:path');await mkdir(dirname(dir+'/'+path),{recursive:true});await writeFile(dir+'/'+path,await file.async('uint8array'));}
 }finally{vi.unstubAllGlobals();}
});
