import {detectPlanLabels} from './planLabels';
import { describe, expect, it } from 'vitest';
import { calibratePlan, fitPlan } from './plan';
import { createDemoProject, parseProject } from './model';
describe('plan scale', () => {
 it('fits without stretching', () => { const p=fitPlan(1000,500,{x:-4000,z:-3000},8000); expect(p.heightPx*p.mmPerPixel).toBe(4000); });
 it('calibrates around first point without moving its world position', () => { const p=fitPlan(1000,500,{x:-4000,z:-3000},8000); const n=calibratePlan(p,{x:100,z:100},{x:600,z:100},2500); expect(n.mmPerPixel).toBe(5); expect(n.origin.x+100*5).toBe(-3200); expect(n.origin.z+100*5).toBe(-2200); });
 it('rejects zero distance, outside points and invalid real lengths', () => { const p=fitPlan(1000,500,{x:0,z:0},8000); for(const length of [0,-1,NaN,Infinity]) expect(()=>calibratePlan(p,{x:0,z:0},{x:100,z:0},length)).toThrow(); expect(()=>calibratePlan(p,{x:0,z:0},{x:0,z:0},100)).toThrow(); expect(()=>calibratePlan(p,{x:-1,z:0},{x:100,z:0},100)).toThrow(); });
 it('round trips reference and rejects malformed transforms', () => { const p={...createDemoProject(),planImageUrl:'data:image/png;base64,AAAA',planReference:fitPlan(1000,500,{x:0,z:0},8000)}; expect(parseProject(JSON.parse(JSON.stringify(p)))).toEqual(p); expect(()=>parseProject({...p,planReference:{...p.planReference,mmPerPixel:0}})).toThrow(); expect(()=>parseProject({...p,planReference:{...p.planReference,origin:{x:Infinity,z:0}}})).toThrow(); });
});

it('round trips reviewed labels without mutating input and rejects out-of-page evidence',()=>{
 const labels=detectPlanLabels([{text:'소화전',source:'ocr',confidence:72,box:{x:10,y:20,width:100,height:30}}]);
 labels[0].status='confirmed';
 const p={...createDemoProject(),planImageUrl:'data:image/png;base64,AAAA',planReference:fitPlan(1000,500,{x:0,z:0},8000),planLabels:labels};
 const original=p.planLabels;
 const restored=parseProject(p);
 expect(p.planLabels).toBe(original);
 expect(restored.planLabels).toEqual(labels);
 expect(restored.planLabels).not.toBe(original);
 expect(parseProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
 expect(()=>parseProject({...p,planLabels:[{...labels[0],box:{x:999,y:20,width:100,height:30}}]})).toThrow();
 expect(()=>parseProject({...p,planReference:undefined})).toThrow();
});
it('persists automatic analysis and rejects invalid cached line geometry',()=>{
 const p={...createDemoProject(),planImageUrl:'data:image/png;base64,AAAA',planReference:fitPlan(1000,500,{x:0,z:0},8000),planAnalysis:{lines:[{id:'a',start:{x:0,y:10},end:{x:100,y:10},thicknessPx:1}],issues:['축척 필요'],textState:'complete' as const,lineState:'complete' as const,numericCount:1}};
 expect(parseProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
 expect(()=>parseProject({...p,planReference:undefined})).toThrow();
 expect(()=>parseProject({...p,planAnalysis:{...p.planAnalysis,lines:[{...p.planAnalysis.lines[0],end:{x:1001,y:0}}]}})).toThrow();
});
