import{it,expect}from'vitest';
import{createDemoProject}from'./model';
import{detectPlanLabels}from'./planLabels';
import{fitPlan}from'./plan';
import{suggestDimensionWalls}from'./dimensionSuggestions';
const label=(x=350,y=10)=>detectPlanLabels([{text:'3200',source:'pdf-text',box:{x,y,width:100,height:20}}])[0];
const project=()=>({...createDemoProject(),planImageUrl:'data:image/png;base64,AAAA',planReference:{...fitPlan(800,600,{x:-4000,z:-3000},8000),calibrated:true}});
it('ranks nearby walls in original drawing pixels without changing the project',()=>{
 const p=project(),before=structuredClone(p),result=suggestDimensionWalls(p,label());
 expect(result.candidates.map(c=>c.wallId)).toEqual(['wall-a']);expect(result.candidates[0].distancePx).toBe(20);expect(p).toEqual(before);
});
it('abstains without calibration, for ambiguous numbers and distant labels',()=>{
 const p=project();p.planReference.calibrated=false;expect(suggestDimensionWalls(p,label()).candidates).toEqual([]);
 p.planReference.calibrated=true;expect(suggestDimensionWalls(p,{...label(),text:'3,200'}).candidates).toEqual([]);expect(suggestDimensionWalls(p,label(350,290)).candidates).toEqual([]);
});
it('reports corner ambiguity and excludes hidden or out-of-page walls',()=>{
 const p=project();expect(suggestDimensionWalls(p,{...label(),box:{x:0,y:30,width:80,height:20}}).message).toContain('여러');
 p.walls[0].visible=false;expect(suggestDimensionWalls(p,label()).candidates).toEqual([]);
 p.walls[0].visible=true;p.walls[0].start.x=-4100;expect(suggestDimensionWalls(p,label()).candidates).toEqual([]);
});
it('supports diagonal walls and rejects an extension beyond their endpoints',()=>{
 const p=project();p.walls=[{...p.walls[0],start:{x:-3000,z:-2000},end:{x:1000,z:2000}}];
 expect(suggestDimensionWalls(p,label(200,240)).candidates).toHaveLength(1);
 expect(suggestDimensionWalls(p,label(460,510)).candidates).toHaveLength(0);
});
