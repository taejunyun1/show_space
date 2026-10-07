import {expect,it,vi} from 'vitest';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createDemoProject,parseProject} from '../src/domain/model';
import {addModelArtwork,patchModelArtwork} from '../src/domain/modelArtworks';
import {testArtworkModel} from '../src/lib/modelArtworkTestFixture';
import {exportProjectGlb} from '../src/lib/modelExport';
import {newLight} from '../src/domain/lighting';

/** Own synthetic geometry exported by the real app path; never reads browser state. */
it.skipIf(process.env.GONGGAN_RECEIVER_FIXTURE!=='1')('exports a complete receiver fixture for independent Blender checks',async()=>{
 vi.stubGlobal('FileReader',class {result:ArrayBuffer|string|null=null;onloadend:(()=>void)|null=null;readAsArrayBuffer(blob:Blob){void blob.arrayBuffer().then(b=>{this.result=b;this.onloadend?.();});}readAsDataURL(blob:Blob){void blob.arrayBuffer().then(b=>{this.result=`data:${blob.type||'application/octet-stream'};base64,${Buffer.from(b).toString('base64')}`;this.onloadend?.();});}});
 vi.stubGlobal('ProgressEvent',class {constructor(public type:string,public init:unknown){}});
 try{
  let p=createDemoProject();p.id='synthetic-receiver-20261007';p.name='전체 형상 수신 검증';p.artworks=[];p.scenes=[];p.walls=[];
  const vertices=[[0,0],[2500,0],[3500,0],[6000,0],[6000,5000],[0,5000]];
  for(const [a,b] of [[0,1],[2,3],[3,4],[4,5],[5,0]])p.walls.push({id:`wall-${p.walls.length+1}`,name:'검증 벽',start:{x:vertices[a][0],z:vertices[a][1]},end:{x:vertices[b][0],z:vertices[b][1]},heightMm:2800,thicknessMm:140,visible:true,locked:false,color:'#e8e8e8',note:'PRIVATE_WALL_NOTE',role:'boundary'});
  p.openings=[{id:'entry',kind:'door',role:'boundary',start:{wallId:'wall-1',endpoint:'end'},end:{wallId:'wall-2',endpoint:'start'},note:'PRIVATE_ENTRY_NOTE'}];
  p.importedFloor=[[[0,0],[6000,0],[6000,5000],[0,5000]],[[2000,1800],[3000,1800],[3000,3800],[2000,3800]]].map(loop=>loop.map(([x,z])=>({x,z})));
  p.referenceModel={...testArtworkModel(),name:'reference-space',positionMm:[-1500,250,7000],rotationDeg:-30,scale:2};
  const added=addModelArtwork(p,testArtworkModel());p=patchModelArtwork(added.project,added.artwork.id,{widthMm:1800,heightMm:1400,depthMm:600,position:{x:4400,y:120,z:3200},rotation:{x:17,y:37,z:-13},artist:'합성 작가',year:'2026',note:'PRIVATE_MODEL_NOTE'});
  p.modelArtworks!.push({...p.modelArtworks![0],id:'hidden-model',visible:false});
  p.lights=[{...newLight(p,'spot'),position:{x:1200,y:2400,z:1600},target:{x:4400,y:1000,z:3200},intensity:85,beamDeg:46,penumbra:.25}];p.lights.push(newLight(p,'projector'));
  p=parseProject(p);const before=JSON.stringify(p),blob=await exportProjectGlb(p),bytes=new Uint8Array(await blob.arrayBuffer());
  expect(JSON.stringify(p)).toBe(before);expect(new TextDecoder().decode(bytes)).not.toContain('PRIVATE_');
  const dir='/tmp/gonggan-full-receiver-20261007';await mkdir(dir,{recursive:true});await writeFile(join(dir,'project.json'),JSON.stringify(p,null,2));await writeFile(join(dir,'scene.glb'),bytes);
 }finally{vi.unstubAllGlobals();}
});
