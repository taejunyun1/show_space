import {expect,it} from 'vitest';
import {adoptPlanDraft,buildEditablePlanDraft,calibrateEditableDraft,refreshPlanEvidence,draftEditSummary} from './editablePlanDraft';
import {createDemoProject,parseProject} from './model';
import {updateWallEndpoint} from './wallEditing';
import type {PlanPage} from '../lib/planImport';

const image='data:image/png;base64,AA==';
const line=(id:string,x:number,y:number,x2:number,y2:number)=>({id,start:{x,y},end:{x:x2,y:y2},thicknessPx:5});
function partialPage():PlanPage{return {imageUrl:image,widthPx:1000,heightPx:800,labels:[],analysis:{textState:'complete',lineState:'complete',numericCount:0,issues:[],selfCheck:{status:'withheld',attempts:2},lines:[line('top',100,100,900,100),line('right',900,100,900,700)]}};}

it('replaces venue contents while preserving project identity, units and private project notes',()=>{
 const current={...createDemoProject(),id:'my-existing-project',name:'나의 전시',venue:'기존 전시장',displayUnit:'m' as const,note:'프로젝트 전체 준비 메모'};
 const draft=buildEditablePlanDraft(partialPage()).project!,before=structuredClone(current);
 const next=adoptPlanDraft(current,draft);
 expect(next).toMatchObject({id:current.id,name:current.name,venue:current.venue,displayUnit:'m',note:current.note});
 expect(next.walls).toEqual(draft.walls);expect(next.artworks).toEqual([]);expect(next.scenes).toEqual([]);
 expect(next.planDraft).toEqual(draft.planDraft);expect(next.planImageUrl).toBe(image);
 expect(parseProject(next)).toMatchObject({id:current.id,name:current.name});
 next.walls[0].start.x=999;expect(draft.walls[0].start.x).not.toBe(999);expect(current).toEqual(before);
});

it('opens a withheld, incomplete drawing as editable walls without inventing scale or floor',()=>{
 const page=partialPage(),before=structuredClone(page),result=buildEditablePlanDraft(page);
 expect(result.kind).toBe('partial');expect(result.project?.walls).toHaveLength(2);
 expect(result.project?.walls.every(w=>w.role==='partition')).toBe(true);
 expect(result.project?.planReference).toMatchObject({calibrated:false,mmPerPixel:1});
 expect(result.project?.planDraft?.originalWalls).toEqual(result.project?.walls);
 expect(result.project?.planImageUrl).toBe(image);
 expect(parseProject(result.project)).toEqual(result.project);
 expect(page).toEqual(before);
});

it('does not make a wall draft when there is no structural line',()=>{
 const page=partialPage();page.analysis!.lines=[];
 expect(buildEditablePlanDraft(page).project).toBeUndefined();
});

it('keeps every user edit and the original reference when the same drawing is reanalyzed',()=>{
 const page=partialPage(),base=buildEditablePlanDraft(page).project!;
 const edited=updateWallEndpoint(base,base.walls[0].id,'end',{x:750,z:100},false);
 const revised=partialPage();revised.analysis!.lines.push(line('new',100,700,900,700));
 const next=refreshPlanEvidence(edited,revised);
 expect(next.walls).toEqual(edited.walls);expect(next.artworks).toEqual(edited.artworks);
 expect(next.planReference).toEqual(edited.planReference);
 expect(next.planDraft).toEqual(edited.planDraft);
 expect(next.planAnalysis).toEqual(revised.analysis);
 expect(draftEditSummary(next).modified).toBe(1);
 expect(parseProject(next)).toEqual(next);
});

it('calibrates the whole partial geometry around the chosen anchor and keeps provenance comparable',()=>{
 const base=buildEditablePlanDraft(partialPage()).project!;
 const edited=updateWallEndpoint(base,base.walls[0].id,'end',{x:750,z:100},false);
 const next=calibrateEditableDraft(edited,{x:100,z:100},{x:200,z:100},1000);
 expect(next.planReference).toMatchObject({calibrated:true,mmPerPixel:10});
 expect(next.walls[0].start).toEqual({x:100,z:100});
 expect(next.walls[0].end).toEqual({x:6600,z:100});
 expect(next.planDraft?.originalWalls[0].end).toEqual({x:8100,z:100});
 expect(next.walls[0].note).toContain('축척 보정됨');
 expect(draftEditSummary(next).modified).toBe(1);
 expect(parseProject(next)).toEqual(next);
});

it('keeps draft walls aligned with the drawing when a known length is corrected later',()=>{
 const base=buildEditablePlanDraft(partialPage()).project!;
 const first=calibrateEditableDraft(base,{x:100,z:100},{x:200,z:100},1000);
 const corrected=calibrateEditableDraft(first,{x:100,z:100},{x:200,z:100},1200);
 const reference=corrected.planReference!;
 expect(reference.mmPerPixel).toBe(12);
 expect(corrected.walls[0].start.x).toBeCloseTo(reference.origin.x+100*12);
 expect(corrected.walls[0].end.x).toBeCloseTo(reference.origin.x+900*12);
 expect(parseProject(corrected)).toEqual(corrected);
});

it('converts saved pixel measurements with the edited draft',()=>{
 const base=buildEditablePlanDraft(partialPage()).project!;
 base.dimensions=[{id:'span',view:'plan',start:{kind:'fixed',fallback:{x:100,y:0,z:100}},end:{kind:'fixed',fallback:{x:900,y:0,z:100}},offsetMm:20}];
 const next=calibrateEditableDraft(base,{x:100,z:100},{x:200,z:100},1000);
 expect(next.dimensions?.[0].start.fallback.x).toBe(100);
 expect(next.dimensions?.[0].end.fallback.x).toBe(8100);
 expect(next.dimensions?.[0].offsetMm).toBe(200);
 expect(parseProject(next)).toEqual(next);
});

it('converts saved Scene structure with the same drawing scale',()=>{
 const base=buildEditablePlanDraft(partialPage()).project!;
 const span={id:'span',view:'plan' as const,start:{kind:'fixed' as const,fallback:{x:100,y:0,z:100}},end:{kind:'fixed' as const,fallback:{x:900,y:0,z:100}},offsetMm:20};
 const {wallId:_,...unplaced}=createDemoProject().artworks[0];
 base.scenes=[{id:'scene-1',name:'픽셀 배치안',artworks:[],wallVisibility:Object.fromEntries(base.walls.map(w=>[w.id,w.visible])),structure:{walls:structuredClone(base.walls),openings:[{id:'door-a',kind:'door',role:'partition',start:{wallId:base.walls[0].id,endpoint:'end'},end:{point:{x:500,z:100}},note:''},{id:'door-b',kind:'door',role:'partition',start:{point:{x:500,z:100}},end:{wallId:base.walls[1].id,endpoint:'end'},note:''}],dimensions:[span],unplacedArtworks:[{...unplaced,alongMm:500}]}}];
 const next=calibrateEditableDraft(base,{x:100,z:100},{x:200,z:100},1000);
 expect(next.scenes[0].structure?.walls[0].end.x).toBe(8100);
 expect(next.scenes[0].structure?.dimensions[0].end.fallback.x).toBe(8100);
 expect(next.scenes[0].structure?.openings[0].end.point?.x).toBe(4100);
 expect(next.scenes[0].structure?.unplacedArtworks[0].alongMm).toBe(5000);
 expect(parseProject(next)).toEqual(next);
});
