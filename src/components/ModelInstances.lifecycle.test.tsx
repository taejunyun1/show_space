import {StrictMode,type ReactNode} from 'react';
import {mkdir,writeFile} from 'node:fs/promises';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act,create} from '@react-three/test-renderer';
import {renderToStaticMarkup} from 'react-dom/server';
import {Box3,BufferGeometry,Group,Material,Mesh,Object3D,Vector3,type Scene} from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {ModelArtworks3D} from './ModelArtworks3D';
import {PublicModelArtworks3D} from './PublicModelArtworks3D';
import {PublicReferenceModel3D} from './PublicReferenceModel3D';
import {ReferenceModel3D} from './ReferenceModel3D';
import {ReadonlyAssetsContext} from './ReadonlyAssets';
import {useEditor} from '../state/editor';
import {createDemoProject} from '../domain/model';
import {addModelArtwork} from '../domain/modelArtworks';
import {testArtworkModel,artworkTestGltf} from '../lib/modelArtworkTestFixture';
import {testVenueModel} from '../lib/venueModelTestFixture';
import {createPublicShare} from '../domain/publicShare';
import {readModelArtworkFiles} from '../lib/modelArtworkImport';
import {packEmbeddedGltf} from '../lib/artworkModelPayload';
import {modelAssetBounds} from '../lib/modelArtworkGeometry';
import {captureAssetsReady} from '../lib/captureAssets';

// Actual React/R3F reconciler, model cache, GLTFLoader, node transforms and disposal.
// Only annotation/gizmo portals and test renderer WebGL transport are adapted;
// these tests do not measure GPU pixels, FPS or real-device input latency.
vi.mock('@react-three/drei',()=>({Html:({children}:{children:ReactNode})=><group userData={{label:renderToStaticMarkup(children)}}/>,Line:()=>null,PivotControls:()=>null}));
let renderer:Awaited<ReturnType<typeof create>>;
beforeEach(async()=>{(globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;renderer=await create(<group/>);vi.stubGlobal('window',new EventTarget());const p=createDemoProject();p.artworks=[];p.walls=p.walls.map(w=>({...w,visible:false}));p.scenes=[];p.lights=[];p.modelArtworks=[];useEditor.getState().loadProject(p);});
afterEach(async()=>{await renderer.unmount();await new Promise(resolve=>setTimeout(resolve,5));vi.restoreAllMocks();vi.unstubAllGlobals();});
const scene=()=>renderer.scene.instance as Scene;
const firstModel=()=>{const marker=scene().getObjectByName('capture-model-artwork-'+useEditor.getState().project.modelArtworks![0].id)!;return marker.getObjectByName('model-artwork-'+useEditor.getState().project.modelArtworks![0].id)!;};
const meshes=(root:Object3D)=>{const result:Mesh[]=[];root.traverse(o=>{if(o instanceof Mesh)result.push(o);});return result;};
async function ready(){await vi.waitFor(()=>expect(captureAssetsReady(scene(),useEditor.getState().previewProject??useEditor.getState().project)).toBe(true));}
async function add(){const s=useEditor.getState(),added=addModelArtwork(s.project,testArtworkModel());await act(async()=>s.loadProject(added.project));return added.artwork.id;}
const assets=(models:Map<string,string>)=>({images:new Map<string,string>(),models});

it('retains the same rendered model hierarchy while moving, resizing, rotating and editing information',async()=>{
 const id=await add();await renderer.update(<ModelArtworks3D/>);await ready();const root=firstModel(),parts=meshes(root),geometry=parts.map(p=>p.geometry),materials=parts.map(p=>p.material);
 await act(async()=>useEditor.getState().patchModelArtwork(id,{widthMm:2400,heightMm:1050,depthMm:450,position:{x:3000,y:100,z:-2000},rotation:{x:0,y:90,z:0},artist:'작가',name:'수정된 3D 작품'}));await ready();
 const current=firstModel();expect(current).toBe(root);expect(meshes(current)).toEqual(parts);expect(meshes(current).map(p=>p.geometry)).toEqual(geometry);expect(meshes(current).map(p=>p.material)).toEqual(materials);
 const bounds=new Box3().setFromObject(current,true);expect(bounds.getSize(new Vector3()).toArray()).toEqual([expect.closeTo(.45),expect.closeTo(1.05),expect.closeTo(2.4)]);expect(bounds.min.toArray()).toEqual([expect.closeTo(2.775),expect.closeTo(.1),expect.closeTo(-3.2)]);expect(current.userData.gonggan).toMatchObject({id,name:'수정된 3D 작품',artist:'작가',widthMm:2400});
 await act(async()=>useEditor.getState().undo());await ready();expect(firstModel()).toBe(root);expect(new Box3().setFromObject(root,true).getSize(new Vector3()).toArray()).toEqual([expect.closeTo(1.2),expect.closeTo(2.1),expect.closeTo(.9)]);
});

it('reuses fifty multipart instances through repeated gesture previews and cancellation',async()=>{
 const {doc}=artworkTestGltf();const nodes=Array.from({length:100},(_,i)=>({mesh:0,translation:[10+(i%10),2,5+Math.floor(i/10)]}));const bytes=packEmbeddedGltf({...doc,nodes,scenes:[{nodes:nodes.map((_,i)=>i)}]});
 const model=await readModelArtworkFiles([new File([bytes],'multipart-grid.glb')]),p=useEditor.getState().project;let added=addModelArtwork(p,model);const first=added.artwork;
 for(let i=1;i<50;i++)added=addModelArtwork(added.project,model);await act(async()=>useEditor.getState().loadProject(added.project));const load=vi.spyOn(GLTFLoader.prototype,'parseAsync');await renderer.update(<ModelArtworks3D/>);await ready();expect(load).toHaveBeenCalledTimes(1);
 const roots=added.project.modelArtworks!.map(a=>scene().getObjectByName('model-artwork-'+a.id)!),parts=roots.map(meshes);expect(parts.every(p=>p.length===100)).toBe(true);expect(new Set(parts.flat().map(p=>p.geometry)).size).toBe(1);
 const clone=vi.spyOn(Group.prototype,'clone');await act(async()=>useEditor.getState().beginModelArtworkTransform(first.id));for(let i=1;i<=12;i++)await act(async()=>useEditor.getState().updateModelArtworkTransform({x:i*100,y:50,z:-i*50},{x:0,y:i*15,z:0}));
 expect(clone).not.toHaveBeenCalled();roots.forEach((root,i)=>{expect(scene().getObjectByName('model-artwork-'+added.project.modelArtworks![i].id)!).toBe(root);expect(meshes(root)).toEqual(parts[i]);});expect(roots[0].position.toArray()).toEqual([1.2,.05,-.6]);
 await act(async()=>useEditor.getState().finishModelArtworkTransform(true));expect(useEditor.getState().previewProject).toBeNull();expect(roots[0].position.toArray()).toEqual([first.position.x/1000,first.position.y/1000,first.position.z/1000]);expect(load).toHaveBeenCalledTimes(1);
 if(process.env.GONGGAN_MODEL_INSTANCE_PROOF==='1'){await mkdir('docs/validation/model-instances-2026-10-11',{recursive:true});await writeFile('docs/validation/model-instances-2026-10-11/input.glb',new Uint8Array(bytes));await writeFile('docs/validation/model-instances-2026-10-11/project.json',JSON.stringify(useEditor.getState().project,null,2)+'\n');await writeFile('docs/validation/model-instances-2026-10-11/instance-checks.json',JSON.stringify({sourceNodes:100,artworkInstances:50,meshObjects:parts.flat().length,uniqueGeometry:new Set(parts.flat().map(p=>p.geometry)).size,loaderParses:load.mock.calls.length,gesturePreviews:12,sourceClonesDuringPreviews:clone.mock.calls.length,allInstanceNodesRetained:true,cancellationRestored:true,gpuMeasured:false},null,2)+'\n');}
});

it('keeps a duplicate asset alive when one instance disappears, and releases shared resources once after the last',async()=>{
 const id=await add(),s=useEditor.getState(),p=s.project,second={...p.modelArtworks![0],id:crypto.randomUUID()};await act(async()=>s.loadProject({...p,modelArtworks:[p.modelArtworks![0],second]}));await renderer.update(<StrictMode><ModelArtworks3D/></StrictMode>);await ready();const parts=meshes(firstModel());const geo=vi.spyOn(BufferGeometry.prototype,'dispose'),mat=vi.spyOn(Material.prototype,'dispose');
 await act(async()=>useEditor.getState().patchModelArtwork(id,{visible:false}));await new Promise(resolve=>setTimeout(resolve,5));expect(geo.mock.contexts).not.toContain(parts[0].geometry);expect(scene().getObjectByName('capture-model-artwork-'+second.id)).toBeDefined();
 await renderer.update(<group/>);await new Promise(resolve=>setTimeout(resolve,5));for(const g of new Set(parts.map(p=>p.geometry)))expect(geo.mock.contexts.filter(x=>x===g)).toHaveLength(1);for(const m of new Set(parts.flatMap(p=>Array.isArray(p.material)?p.material:[p.material])))expect(mat.mock.contexts.filter(x=>x===m)).toHaveLength(1);
});

it('keeps public artwork nodes stable when the same model changes pose between Scenes',async()=>{
 const p=addModelArtwork(useEditor.getState().project,testArtworkModel()).project,pub=createPublicShare(p,{includeDimensions:true,modelAssetIds:new Map(p.modelArtworks?.map(a=>[a.id,'a'.repeat(64)])),referenceAssetId:p.referenceModel?'b'.repeat(64):undefined}).snapshot,models=assets(new Map([[pub.modelArtworks![0].modelId,p.modelArtworks![0].model.dataUrl]]));
 const draw=(snapshot:typeof pub)=><ReadonlyAssetsContext.Provider value={models}><PublicModelArtworks3D artworks={snapshot.modelArtworks!} shareId="presentation" selectedId={null} onSelect={()=>{}} measuring={false} onMeasure={()=>{}}/></ReadonlyAssetsContext.Provider>;
 await renderer.update(draw(pub));await vi.waitFor(()=>expect(meshes(scene())).toHaveLength(3));const before=meshes(scene()),next={...pub,modelArtworks:[{...pub.modelArtworks![0],widthMm:2400,heightMm:1050,depthMm:450,position:{x:3000,y:100,z:-2000},rotation:{x:0,y:90,z:0}}]};await renderer.update(draw(next));await vi.waitFor(()=>expect(meshes(scene())).toHaveLength(3));expect(meshes(scene())).toEqual(before);const box=new Box3().setFromObject(scene(),true);expect(box.getSize(new Vector3()).toArray()).toEqual([expect.closeTo(.45),expect.closeTo(1.05),expect.closeTo(2.4)]);expect(box.min.y).toBeCloseTo(.1);
});

it('keeps a public whole-venue hierarchy stable when its placement changes',async()=>{
 const p=useEditor.getState().project;p.referenceModel=testVenueModel();const pub=createPublicShare(p,{includeDimensions:true,modelAssetIds:new Map(p.modelArtworks?.map(a=>[a.id,'a'.repeat(64)])),referenceAssetId:p.referenceModel?'b'.repeat(64):undefined}).snapshot,models=assets(new Map([[pub.referenceModel!.modelId,p.referenceModel.dataUrl]]));const draw=(model:NonNullable<typeof pub.referenceModel>)=><ReadonlyAssetsContext.Provider value={models}><PublicReferenceModel3D model={model} shareId="presentation" selected={false} onSelect={()=>{}} measuring={false} onMeasure={()=>{}}/></ReadonlyAssetsContext.Provider>;
 await renderer.update(draw(pub.referenceModel!));await vi.waitFor(()=>expect(meshes(scene())).toHaveLength(15));const before=meshes(scene());await renderer.update(draw({...pub.referenceModel!,positionMm:[2000,100,-4000],rotationDeg:90,scale:2}));await vi.waitFor(()=>expect(meshes(scene())).toHaveLength(15));expect(meshes(scene())).toEqual(before);const box=new Box3().setFromObject(scene(),true);expect(box.getSize(new Vector3()).toArray()).toEqual([expect.closeTo(16),expect.closeTo(6),expect.closeTo(24)]);expect(box.min.toArray()).toEqual([expect.closeTo(-6),expect.closeTo(.1),expect.closeTo(-16)]);
});

it('preserves the loaded venue source coordinates while rendering its origin correction',async()=>{
 const p=useEditor.getState().project;p.referenceModel=testVenueModel();const loaded:Group[]=[];const parse=GLTFLoader.prototype.parseAsync;vi.spyOn(GLTFLoader.prototype,'parseAsync').mockImplementation(async function(this:GLTFLoader,...args){const gltf=await parse.apply(this,args);loaded.push(gltf.scene);return gltf;});
 await renderer.update(<ReferenceModel3D model={p.referenceModel}/>);await vi.waitFor(()=>expect(captureAssetsReady(scene(),p)).toBe(true));expect(loaded).toHaveLength(1);expect(modelAssetBounds(loaded[0],true).sourceOffsetM).toEqual([expect.closeTo(-10),expect.closeTo(-2),expect.closeTo(-5)]);const rendered=scene().getObjectByName('capture-reference-model')!;expect(new Box3().setFromObject(rendered,true).min.y).toBeCloseTo(0);
});

it('hides a public model when its saved bounds fail and recovers when the valid bounds return',async()=>{
 const p=addModelArtwork(useEditor.getState().project,testArtworkModel()).project,hash='c'.repeat(64),pub=createPublicShare(p,{includeDimensions:true,modelAssetIds:new Map([[p.modelArtworks![0].id,hash]])}).snapshot;
 const draw=(sizeMm:[number,number,number])=><ReadonlyAssetsContext.Provider value={assets(new Map([[hash,p.modelArtworks![0].model.dataUrl]]))}><PublicModelArtworks3D artworks={[{...pub.modelArtworks![0],sizeMm}]} shareId="presentation-bounds" selectedId={null} onSelect={()=>{}} measuring={false} onMeasure={()=>{}}/></ReadonlyAssetsContext.Provider>;
 await renderer.update(draw(pub.modelArtworks![0].sizeMm));await vi.waitFor(()=>expect(meshes(scene())).toHaveLength(3));await renderer.update(draw([20000,2100,900]));expect(meshes(scene())).toHaveLength(0);expect(scene().children.some(o=>String(o.userData.label).includes('일치하지'))).toBe(true);
 await renderer.update(draw(pub.modelArtworks![0].sizeMm));await vi.waitFor(()=>expect(meshes(scene())).toHaveLength(3));expect(scene().children.some(o=>String(o.userData.label).includes('일치하지'))).toBe(false);
});

it('reuses local model nodes when only the presentation asset container changes',async()=>{
 const p=addModelArtwork(useEditor.getState().project,testArtworkModel()).project,hash='d'.repeat(64),pub=createPublicShare(p,{includeDimensions:true,modelAssetIds:new Map([[p.modelArtworks![0].id,hash]])}).snapshot;
 const draw=()=> <ReadonlyAssetsContext.Provider value={assets(new Map([[hash,p.modelArtworks![0].model.dataUrl]]))}><PublicModelArtworks3D artworks={pub.modelArtworks!} shareId="presentation-assets" selectedId={null} onSelect={()=>{}} measuring={false} onMeasure={()=>{}}/></ReadonlyAssetsContext.Provider>;
 await renderer.update(draw());await vi.waitFor(()=>expect(meshes(scene())).toHaveLength(3));const before=meshes(scene()),clone=vi.spyOn(Group.prototype,'clone');await renderer.update(draw());expect(meshes(scene())).toEqual(before);expect(clone).not.toHaveBeenCalled();
});
