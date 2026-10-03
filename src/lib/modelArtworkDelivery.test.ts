import {it,expect,vi} from 'vitest';
import {Box3,Vector3,Mesh} from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import JSZip from 'jszip';
import {createDemoProject} from '../domain/model';
import {addModelArtwork,patchModelArtwork} from '../domain/modelArtworks';
import {testArtworkModel} from './modelArtworkTestFixture';
import {exportProjectPackage,importProjectPackage} from './projectPackage';
import {exportProjectGlb,exportProjectGltf} from './modelExport';
import {disposeModelAsset} from './modelAssetResources';
import {artworkModelBytes} from './modelArtworkImport';
import {pdfSections} from './pdfLayout';
function fixture(){const p=createDemoProject();p.artworks=[];const added=addModelArtwork(p,testArtworkModel());return patchModelArtwork(added.project,added.artwork.id,{widthMm:2400,heightMm:1050,depthMm:450,position:{x:3000,y:100,z:-2000},rotation:{x:0,y:90,z:0},note:'PRIVATE_INTERNAL_3D_NOTE',artist:'작가',year:'2026'});}
it('backs up one canonical model asset reused by duplicate and Scene and restores exact bytes and private notes',async()=>{
 const p=fixture(),a=p.modelArtworks![0];p.modelArtworks!.push({...a,id:'another',visible:false});p.scenes=[{id:'saved',name:'saved',artworks:[],wallVisibility:{},structure:{walls:p.walls,openings:[],dimensions:[],unplacedArtworks:[],modelArtworks:[a]}}];const before=structuredClone(p),blob=await exportProjectPackage(p,async()=>{throw new Error('no images expected');}),zip=await JSZip.loadAsync(await blob.arrayBuffer(),{checkCRC32:true}),manifest=JSON.parse(await zip.file('manifest.json')!.async('string'));expect(manifest.assets).toHaveLength(1);expect(manifest.assets[0].mime).toBe('model/gltf-binary');expect(await importProjectPackage(await blob.arrayBuffer())).toEqual(before);expect(p).toEqual(before);expect(await zip.file('project.json')!.async('string')).not.toContain('data:model');
});
it('roundtrips actual multipart artwork geometry and physical transforms through both GLB and glTF ZIP',async()=>{
 vi.stubGlobal('FileReader',class {result:string|ArrayBuffer|null=null;onloadend:(()=>void)|null=null;readAsArrayBuffer(blob:Blob){void blob.arrayBuffer().then(b=>{this.result=b;this.onloadend?.();});}readAsDataURL(blob:Blob){void blob.arrayBuffer().then(b=>{this.result=`data:${blob.type||'application/octet-stream'};base64,${Buffer.from(b).toString('base64')}`;this.onloadend?.();});}});vi.stubGlobal('ProgressEvent',class {constructor(public type:string,public init:unknown){}});
 try{const p=fixture(),before=structuredClone(p),glb=await exportProjectGlb(p),gltf=await new GLTFLoader().parseAsync(await glb.arrayBuffer(),'');try{const root=gltf.scene.getObjectByName('model-artwork-'+p.modelArtworks![0].id)!;expect(root).toBeDefined();const box=new Box3().setFromObject(root,true);expect(box.getSize(new Vector3()).toArray()).toEqual([expect.closeTo(.45),expect.closeTo(1.05),expect.closeTo(2.4)]);expect(box.min.toArray()).toEqual([expect.closeTo(2.775),expect.closeTo(.1),expect.closeTo(-3.2)]);const parts:Mesh[]=[];root.traverse(o=>{if(o instanceof Mesh)parts.push(o);});expect(parts).toHaveLength(3);expect(parts.map(p=>Array.isArray(p.material)?p.material[0].name:p.material.name)).toEqual(['brown metal','brown metal','blue cap']);expect(root.userData.gonggan.artist).toBe('작가');}finally{disposeModelAsset(gltf.scenes);}const zipBlob=await exportProjectGltf(p),zip=await JSZip.loadAsync(await zipBlob.arrayBuffer(),{checkCRC32:true}),json=await zip.file('scene.gltf')!.async('string');expect(json).not.toContain('PRIVATE_INTERNAL_3D_NOTE');expect(new TextDecoder().decode(new Uint8Array(await glb.arrayBuffer()))).not.toContain('PRIVATE_INTERNAL_3D_NOTE');const {bytes}=await artworkModelBytes([new File([await zipBlob.arrayBuffer()],'delivered.zip')]);const second=await new GLTFLoader().parseAsync(bytes,'');try{expect(second.scene.getObjectByName('model-artwork-'+p.modelArtworks![0].id)).toBeDefined();}finally{disposeModelAsset(second.scenes);}expect(p).toEqual(before);}finally{vi.unstubAllGlobals();}
});
it('uses stored 3D model lists for PDF Scene output, including explicit empty snapshots',()=>{
 const p=fixture();p.scenes=[{id:'empty',name:'empty',artworks:[],wallVisibility:{},structure:{walls:p.walls,openings:[],dimensions:[],unplacedArtworks:[],modelArtworks:[]}}];const sections=pdfSections(p,{current:true,sceneIds:['empty'],threeD:true,plan:true,elevation:false,allWallFaces:false});expect(sections[0].project.modelArtworks).toHaveLength(1);expect(sections[2].project.modelArtworks).toEqual([]);
});
