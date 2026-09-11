import{it,expect}from'vitest';
import{applyLinkedDimension}from'./linkedDimensions';
import{createDemoProject,wallLength,parseProject}from'./model';
import{detectPlanLabels}from'./planLabels';
import{fitPlan}from'./plan';
const fixture=(text='3.2 m')=>({...createDemoProject(),planImageUrl:'data:image/png;base64,AAAA',planReference:fitPlan(100,100,{x:0,z:0},1000),planLabels:detectPlanLabels([{text,source:'pdf-text' as const,box:{x:0,y:0,width:40,height:10}}]).map(l=>({...l,status:'confirmed' as const}))});
it('converts units, changes only chosen height and preserves evidence through save',()=>{
 const p=fixture(),next=applyLinkedDimension(p,'label-1','wall-a','height','m');
 expect(next.walls[0].heightMm).toBe(3200);expect(p.walls[0].note).toBe('');expect(next.walls[0].note).toContain('3.2 m');expect(next.walls[1]).toEqual(p.walls[1]);expect(parseProject(next)).toEqual(next);
});
it('resizes length along its direction and keeps the shared corner connected',()=>{
 const p=fixture('4000'),next=applyLinkedDimension(p,'label-1','wall-a','length','mm');
 expect(wallLength(next.walls[0])).toBe(4000);expect(next.walls[0].start).toEqual(p.walls[0].start);expect(next.walls[1].start).toEqual(next.walls[0].end);expect(next.planReference).toEqual(p.planReference);
});
it('blocks ambiguous or unconfirmed values, mismatched units and roles',()=>{
 for(const text of ['3,200','1200 2400','3.6 x 2.0 m','H=3200'])expect(()=>applyLinkedDimension(fixture(text),'label-1','wall-a','length','mm')).toThrow();
 expect(()=>applyLinkedDimension(fixture(),'label-1','wall-a','height','mm')).toThrow();
 const p=fixture();p.planLabels[0].status='unreviewed' as 'confirmed';expect(()=>applyLinkedDimension(p,'label-1','wall-a','height','m')).toThrow();
});
it('respects target and connected-wall locks and dimension bounds',()=>{
 const p=fixture('4000');p.walls[1].locked=true;expect(()=>applyLinkedDimension(p,'label-1','wall-a','length','mm')).toThrow(/잠긴/);
 p.walls[0].locked=true;expect(()=>applyLinkedDimension(p,'label-1','wall-a','height','mm')).toThrow(/잠긴/);
 expect(()=>applyLinkedDimension(fixture('9000'),'label-1','wall-a','thickness','mm')).toThrow();
});
