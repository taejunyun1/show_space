import {it,expect} from 'vitest';
import {createDemoProject} from './model';
import {detectPlanLabels} from './planLabels';
import {detectGlassFronts} from './glassFronts';
import {anchorOpeningPoint} from './openingAnchors';
const wall=(id:string,x:number,z:number,x2:number,z2:number)=>({...createDemoProject().walls[0],id,start:{x,z},end:{x:x2,z:z2}});
function fixture(){return {walls:[wall('glass',300,100,300,500),wall('return',0,500,300,500)],labels:detectPlanLabels([{text:'Glass Front Window',source:'ocr',confidence:96,box:{x:265,y:180,width:25,height:240}}]),lines:[{id:'thin',start:{x:300,y:100},end:{x:300,y:500},thicknessPx:3},{id:'solid',start:{x:0,y:500},end:{x:300,y:500},thicknessPx:12}],doors:[{kind:'door',wall:wall('door',300,0,300,100)}]};}
it('separates labelled thin glazing with a door junction and heavier return',()=>{const f=fixture(),g=detectGlassFronts(f.walls,f.labels,f.lines,f.doors);expect(g).toHaveLength(1);expect(g[0].frameIds).toEqual(['glass']);expect(g[0].wall.start).toEqual({x:300,z:100});expect(anchorOpeningPoint(g[0].wall.start,[f.walls[1]],[...g,...f.doors])).toEqual({point:{x:300,z:100}});expect(anchorOpeningPoint(g[0].wall.start,[f.walls[1]],[...g,...f.doors],10)).toEqual({point:{x:3000,z:1000}});});
it('does not infer a window from a label alone, thick wall, weak OCR, or partial span',()=>{const f=fixture();expect(detectGlassFronts(f.walls,f.labels,[],f.doors)).toEqual([]);expect(detectGlassFronts(f.walls,f.labels,f.lines,[])).toEqual([]);expect(detectGlassFronts(f.walls,f.labels,f.lines.map(l=>({...l,thicknessPx:12})),f.doors)).toEqual([]);expect(detectGlassFronts(f.walls,f.labels.map(l=>({...l,confidence:70})),f.lines,f.doors)).toEqual([]);expect(detectGlassFronts(f.walls,f.labels.map(l=>({...l,box:{...l.box,height:30}})),f.lines,f.doors)).toEqual([]);});
it('preserves branching walls and rejects ambiguous duplicate labels or missing anchors',()=>{const f=fixture();expect(detectGlassFronts([...f.walls,wall('branch',200,300,300,300)],f.labels,f.lines,f.doors)).toEqual([]);expect(detectGlassFronts(f.walls,[...f.labels,{...f.labels[0],id:'duplicate'}],f.lines,f.doors)).toEqual([]);expect(anchorOpeningPoint({x:300,z:100},[],f.doors)).toBeUndefined();});
it('resolves adjacent door/glass geometry into a closed floor with three solid walls',async()=>{
 const {resolvePlanOpenings}=await import('./planOpenings'),{floorWithOpenings}=await import('./openings'),{parseProject}=await import('./model');
 const f=fixture(),walls=[...f.walls,wall('top',0,0,300,0),wall('left',0,0,0,500)];
 const labels=[...f.labels,...detectPlanLabels([{text:'Front Door',source:'pdf-text',box:{x:260,y:15,width:25,height:65}}]).map(l=>({...l,id:'front-door'}))];
 const result=resolvePlanOpenings(walls,labels,200,[],f.lines);
 expect(result.gaps.map(g=>g.kind)).toEqual(['door','window']);expect(result.structure).toHaveLength(3);
 const openings=result.gaps.map(g=>({id:g.wall.id,kind:g.kind,role:'boundary' as const,note:g.wall.note,start:anchorOpeningPoint(g.wall.start,result.structure,result.gaps)!,end:anchorOpeningPoint(g.wall.end,result.structure,result.gaps)!}));
 const project=parseProject({...createDemoProject(),walls:result.structure,openings,artworks:[],scenes:[]});
 expect(floorWithOpenings(project).areaMm2).toBe(150000);expect(openings.flatMap(o=>[o.start,o.end]).filter(r=>r.point)).toHaveLength(2);
});
