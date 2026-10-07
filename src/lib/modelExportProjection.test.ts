import {expect,it,vi} from 'vitest';
import JSZip from 'jszip';
import {createDemoProject} from '../domain/model';
import {newLight} from '../domain/lighting';
import {DEFAULT_OUTDOOR,outdoorAppearance} from '../domain/outdoor';
import {projectorTestFixture} from './projectorTestFixture';
import {exportProjectGlb,exportProjectGltf} from './modelExport';
import {inspectGlb} from './glbPayload';
import {buildExportScene,disposeExportScene} from './exportScene';
import {projectionReceiverFixture} from './projectionReceiverFixture';
function reader(){vi.stubGlobal('FileReader',class{result:ArrayBuffer|string|null=null;onloadend:(()=>void)|null=null;readAsArrayBuffer(blob:Blob){void blob.arrayBuffer().then(b=>{this.result=b;this.onloadend?.();});}readAsDataURL(blob:Blob){void blob.arrayBuffer().then(b=>{this.result=`data:${blob.type||'application/octet-stream'};base64,${Buffer.from(b).toString('base64')}`;this.onloadend?.();});}});}
it('rejects an empty geometry export when all visible lights are unsupported projectors or an outdoor night has no sun',async()=>{
 const p=projectorTestFixture();p.walls=[];p.artworks=[];p.importedFloor=[];p.scenes=[];const before=JSON.stringify(p),scene=buildExportScene(p);expect(scene.children).toHaveLength(0);disposeExportScene(scene);await expect(exportProjectGlb(p)).rejects.toThrow('내보낼');await expect(exportProjectGltf(p)).rejects.toThrow('내보낼');expect(JSON.stringify(p)).toBe(before);
 const night=createDemoProject();night.walls=[];night.artworks=[];night.importedFloor=[];night.lights=[];night.outdoor={...DEFAULT_OUTDOOR,mode:'outdoor',time:'00:00'};expect(outdoorAppearance(night.outdoor)!.sunIntensity).toBe(0);await expect(exportProjectGlb(night)).rejects.toThrow('내보낼');
 // Ordinary Spot definitions remain in real geometry exports; a light-only file is not a usable model import.
 p.lights=[newLight(createDemoProject(),'spot')];const supported=buildExportScene(p);expect(supported.getObjectByName('emitter')).toBeDefined();disposeExportScene(supported);await expect(exportProjectGlb(p)).rejects.toThrow('내보낼');
});
it('embeds only visible unsupported-light counts in real GLB/glTF exports, with no ghost projector light or private source data',async()=>{
 reader();try{
  const p=projectionReceiverFixture(),before=JSON.stringify(p),doc=inspectGlb(await(await exportProjectGlb(p)).arrayBuffer()),report=doc.scenes[0].extras.gongganExport;
  expect(report).toEqual({version:1,units:'meter',omittedLights:{projectors:2,areaLights:1}});expect(doc.extensions.KHR_lights_punctual.lights).toHaveLength(1);expect(doc.extensions.KHR_lights_punctual.lights[0].type).toBe('spot');expect(doc.images??[]).toEqual([]);expect(JSON.stringify(doc)).not.toMatch(/PRIVATE|data:image|throwRatio|brightnessLumens|note/);
  const zip=await JSZip.loadAsync(await(await exportProjectGltf(p)).arrayBuffer(),{checkCRC32:true}),json=JSON.parse(await zip.file('scene.gltf')!.async('string')),manifest=JSON.parse(await zip.file('export-report.json')!.async('string'));
  expect(json.scenes[0].extras.gongganExport).toEqual(report);expect(manifest.omittedLights).toEqual(report.omittedLights);expect(json.extensions.KHR_lights_punctual.lights).toHaveLength(1);expect(JSON.stringify(p)).toBe(before);
  p.lights![0].visible=false;p.lights![2].visible=false;const hidden=inspectGlb(await(await exportProjectGlb(p)).arrayBuffer());expect(hidden.scenes[0].extras.gongganExport.omittedLights).toEqual({projectors:1,areaLights:0});
 }finally{vi.unstubAllGlobals();}
});
