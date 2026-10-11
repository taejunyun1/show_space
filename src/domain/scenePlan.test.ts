import {afterEach,expect,it} from 'vitest';
import JSZip from 'jszip';
import {createCanvas} from '@napi-rs/canvas';
import {createDemoProject,parseProject} from './model';
import {appendSceneSnapshot} from './sceneSnapshot';
import {sceneProject} from './sceneProject';
import {buildEditablePlanDraft,calibrateEditableDraft} from './editablePlanDraft';
import {exportProjectPackage,importProjectPackage} from '../lib/projectPackage';
import {prepareSharePresentation} from '../lib/sharePresentation';
import {useEditor} from '../state/editor';
import type {Project} from './types';
import type {PlanPage} from '../lib/planImport';

function image(color:string){const c=createCanvas(2,2);c.getContext('2d').fillStyle=color;c.getContext('2d').fillRect(0,0,2,2);return c.toDataURL('image/png');}
const a=image('#fa320f'),b=image('#1749f0'),original=image('#51ac29');
const keys=['planImageUrl','planOpacity','planReference','planLabels','planAnalysis','sourcePlan','planDraft'] as const;
function plan(project:Project){return Object.fromEntries(keys.filter(k=>project[k]!==undefined).map(k=>[k,structuredClone(project[k])]));}
function venue(url=a):Project{
 const p=createDemoProject();p.artworks=[];p.scenes=[];
 return {...p,planImageUrl:url,planOpacity:.35,planReference:{widthPx:1000,heightPx:800,origin:{x:120,z:240},mmPerPixel:10,calibrated:true},planLabels:[{id:'door',text:'DOOR',kind:'door',status:'unreviewed',source:'pdf-text',note:'',box:{x:900,y:100,width:50,height:30}}],planAnalysis:{textState:'complete',lineState:'complete',numericCount:0,issues:[],lines:[{id:'wall',start:{x:0,y:0},end:{x:990,y:0},thicknessPx:8}]},sourcePlan:{imageUrl:original,widthPx:1000,heightPx:800,labels:[]}};
}
afterEach(()=>useEditor.getState().loadProject(createDemoProject()));

it('captures the source plan during thumbnail generation while keeping concurrent current input and metadata',()=>{
 const source=venue(),current={...venue(b),name:'Latest',note:'PRIVATE_LATEST',planReference:{...venue().planReference!,widthPx:1100,mmPerPixel:20}};
 const result=appendSceneSnapshot(current,source,'A'),detached=sceneProject(result,result.scenes[0]);
 expect(plan(result)).toEqual(plan(current));expect(plan(detached)).toEqual(plan(source));expect(result.name).toBe('Latest');expect(result.note).toBe('PRIVATE_LATEST');
 source.planLabels![0].text='changed';expect(detached.planLabels![0].text).toBe('DOOR');expect(result.scenes[0].structure!.plan!.planLabels![0].text).toBe('DOOR');
});

it('restores the matching image, scale, labels, source and walls with one Undo/Redo, retaining latest notes',()=>{
 const first=venue(),saved=appendSceneSnapshot(first,first,'A'),second={...saved,...plan(venue(b)),note:'LATEST_NOTE',walls:saved.walls.map((w,i)=>i? w:{...w,end:{...w.end,x:w.end.x+900}})};
 useEditor.getState().loadProject(second);useEditor.getState().restoreScene(saved.scenes[0].id);
 const restored=structuredClone(useEditor.getState().project);expect(plan(restored)).toEqual(plan(first));expect(restored.walls).toEqual(first.walls);expect(restored.note).toBe('LATEST_NOTE');expect(useEditor.getState().past).toHaveLength(1);
 useEditor.getState().undo();expect(useEditor.getState().project).toEqual(second);useEditor.getState().redo();expect(useEditor.getState().project).toEqual(restored);
});

it('clears later plan fields for a newly saved plan-free Scene but leaves legacy Scene policy unchanged',()=>{
 const empty={...createDemoProject(),scenes:[]},saved=appendSceneSnapshot(empty,empty,'Without a plan'),later={...venue(),scenes:saved.scenes};
 useEditor.getState().loadProject(later);useEditor.getState().restoreScene(saved.scenes[0].id);for(const k of keys)expect(useEditor.getState().project[k],k).toBeUndefined();
 const detached=sceneProject(later,saved.scenes[0]);for(const k of keys)expect(detached[k],k).toBeUndefined();expect(detached).not.toHaveProperty('plan');
 const legacy=structuredClone(saved.scenes[0]);delete legacy.structure!.plan;
 const legacyProject={...later,scenes:[legacy]};useEditor.getState().loadProject(legacyProject);useEditor.getState().restoreScene(legacy.id);expect(plan(useEditor.getState().project)).toEqual(plan(later));expect(plan(sceneProject(legacyProject,legacy))).toEqual(plan(later));
});

function draftPage(url=a):PlanPage{return {imageUrl:url,widthPx:1000,heightPx:800,labels:[],analysis:{textState:'complete',lineState:'complete',numericCount:0,issues:[],lines:[{id:'top',start:{x:100,y:100},end:{x:900,y:100},thicknessPx:8},{id:'side',start:{x:900,y:100},end:{x:900,y:700},thicknessPx:8}]}};}
it('returns to plan view when restoring an uncalibrated draft Scene from a normal 3D venue',()=>{
 const draft=buildEditablePlanDraft(draftPage()).project!,saved=appendSceneSnapshot(draft,draft,'Draft'),current={...venue(),id:draft.id,scenes:saved.scenes};
 useEditor.getState().loadProject(current);useEditor.getState().setView('3d');expect(useEditor.getState().view).toBe('3d');useEditor.getState().restoreScene(saved.scenes[0].id);
 expect(useEditor.getState().message).toBeNull();expect(plan(useEditor.getState().project)).toEqual(plan(draft));expect(useEditor.getState().view).toBe('plan');useEditor.getState().setView('3d');expect(useEditor.getState().view).toBe('plan');
});

const corruptions:Array<[string,(p:Record<string,any>)=>void]>=[
 ['missing image',p=>{delete p.planImageUrl;}],['scale',p=>{p.planReference.mmPerPixel=Infinity;}],['origin',p=>{p.planReference.origin.x=NaN;}],['label bounds',p=>{p.planLabels[0].box.x=1500;}],['line bounds',p=>{p.planAnalysis.lines[0].end.x=1500;}],['analysis status',p=>{p.planAnalysis.lineState='pending';}],['opacity',p=>{p.planOpacity=2;}],['source dimensions',p=>{p.sourcePlan.widthPx=0;}],['source URL',p=>{p.sourcePlan.imageUrl='javascript:alert(1)';}],['unknown field',p=>{p.note='INJECTED';}],['duplicate draft walls',p=>{p.planDraft={kind:'partial',sourceEvidenceHash:'12345678',originalWalls:[venue().walls[0],venue().walls[0]]};}]
];
it.each(corruptions)('rejects malformed Scene plan %s even when the current root plan is valid',(_label,mutate)=>{
 const p=venue(),saved=appendSceneSnapshot(p,p,'A');saved.scenes[0].structure!.plan=plan(p);mutate(saved.scenes[0].structure!.plan!);expect(()=>parseProject(saved)).toThrow();
});

it('validates Scene evidence against its own image dimensions rather than the newer root image',()=>{
 const p=venue(),saved=appendSceneSnapshot(p,p,'A');saved.planLabels=[];saved.planAnalysis=undefined;saved.planReference={...p.planReference!,widthPx:400};
 const parsed=parseProject(JSON.parse(JSON.stringify(saved))),detached=sceneProject(parsed,parsed.scenes[0]);expect(detached.planReference?.widthPx).toBe(1000);expect(detached.planLabels![0].box.x).toBe(900);expect(parseProject(detached)).toEqual(detached);
});

it('calibrates matching draft Scenes and their plan references while keeping other saved plans untouched',()=>{
 const draft=buildEditablePlanDraft(draftPage()).project!,saved=appendSceneSnapshot(draft,draft,'Matching');
 const other=buildEditablePlanDraft(draftPage(b)).project!,withOther=appendSceneSnapshot(saved,{...other,id:draft.id},'Other');
 const without=appendSceneSnapshot(withOther,{...createDemoProject(),id:draft.id,scenes:[]},'No plan');
 const before=structuredClone(without),next=calibrateEditableDraft(without,{x:100,z:100},{x:200,z:100},1000),matching=sceneProject(next,next.scenes[0]);
 expect(matching.planReference).toEqual(next.planReference);expect(matching.planDraft).toEqual(next.planDraft);expect(matching.walls).toEqual(next.walls);expect(next.scenes.slice(1)).toEqual(before.scenes.slice(1));expect(parseProject(next)).toEqual(next);
 const corrected=calibrateEditableDraft(next,{x:100,z:100},{x:200,z:100},1200);expect(sceneProject(corrected,corrected.scenes[0]).planReference).toEqual(corrected.planReference);expect(corrected.scenes.slice(1)).toEqual(before.scenes.slice(1));
});

it('packages Scene-only plan/source images as hashed assets and restores the entire project exactly',async()=>{
 const first=venue(),saved=appendSceneSnapshot(first,first,'A'),second=appendSceneSnapshot({...saved,...plan(venue(b))},{...saved,...plan(venue(b))},'B');
 delete second.planImageUrl;delete second.planReference;delete second.planLabels;delete second.planAnalysis;delete second.sourcePlan;delete second.planOpacity;
 const blob=await exportProjectPackage(second,async()=>{throw new Error('unexpected external asset');}),zip=await JSZip.loadAsync(await blob.arrayBuffer(),{checkCRC32:true}),packed=JSON.parse(await zip.file('project.json')!.async('string')),manifest=JSON.parse(await zip.file('manifest.json')!.async('string'));
 expect(manifest.assets).toHaveLength(3);expect(packed.scenes[0].structure.plan.planImageUrl).toMatch(/^gonggan-asset:assets\/images\//);expect(packed.scenes[0].structure.plan.sourcePlan.imageUrl).toMatch(/^gonggan-asset:/);expect(JSON.stringify(packed)).not.toContain('data:image');
 const restored=await importProjectPackage(await blob.arrayBuffer());expect(restored).toEqual(second);expect(plan(sceneProject(restored,restored.scenes[0]))).toEqual(plan(first));
});

it('keeps saved plan images, labels and source data private when publishing the selected Scene geometry',async()=>{
 const p=venue();p.note='PRIVATE_PLAN_NOTE';p.planLabels![0].text='PRIVATE_DOOR_LABEL';
 const saved=appendSceneSnapshot(p,p,'Public layout'),result=await prepareSharePresentation(saved,{includeDimensions:true,includeArtworkDetails:true,sceneIds:[saved.scenes[0].id]});
 expect(result.snapshot.scenes).toHaveLength(1);expect(result.snapshot.scenes![0].snapshot.walls).toHaveLength(p.walls.length);expect(result.uploads).toHaveLength(0);
 const text=JSON.stringify(result.snapshot);for(const value of [a,b,original,'PRIVATE_PLAN_NOTE','PRIVATE_DOOR_LABEL','planReference','planDraft','sourcePlan'])expect(text).not.toContain(value);
 expect(plan(saved)).toEqual(plan(p));
});
