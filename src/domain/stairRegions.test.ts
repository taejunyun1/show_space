import {createDemoProject,parseProject} from './model';
import {it,expect} from 'vitest';
import {detectPlanLabels} from './planLabels';
import {detectStairRegions,stairRegionsAgree,stableStairRegions,interiorStairTreadIds} from './stairRegions';
const label=detectPlanLabels([{text:'Stairs',source:'pdf-text',box:{x:80,y:50,width:15,height:40}}]);
const lines=Array.from({length:5},(_,i)=>({id:`t${i}`,start:{x:100+i*20,y:30},end:{x:100+i*20,y:150},thicknessPx:2}));
it('derives the region from regularly spaced treads beside a stair label',()=>{const region=detectStairRegions(label,lines)[0];expect(region.box).toEqual({x:100,y:30,width:80,height:120});expect(region.lineIds).toHaveLength(5);expect(region.box).not.toEqual(label[0].box);expect(stairRegionsAgree(region,{...region,box:{...region.box,x:102}})).toBe(true);});
it('rejects annotation-only, irregular and remotely located lines',()=>{expect(detectStairRegions(label,[])).toEqual([]);expect(detectStairRegions(label,lines.map((l,i)=>i===4?{...l,start:{x:240,y:30},end:{x:240,y:150}}:l))).toEqual([]);expect(detectStairRegions(label.map(l=>({...l,box:{x:600,y:600,width:20,height:20}})),lines)).toEqual([]);});
it('does not classify a set of lines as stairs without semantic evidence',()=>{expect(detectStairRegions([],lines)).toEqual([]);expect(detectStairRegions(label.map(l=>({...l,source:'ocr',confidence:70})),lines)).toEqual([]);});

it('requires independent agreement and vetoes a contradictory region',()=>{
 const region=detectStairRegions(label,lines)[0],shifted={...region,box:{...region.box,x:region.box.x+40}};
 expect(stableStairRegions([[region],[],[]],0)).toEqual([]);
 expect(stableStairRegions([[region],[region],[]],0)).toEqual([region]);
 expect(stableStairRegions([[region],[region],[shifted]],0)).toEqual([]);
});

it('round-trips detected regions and rejects missing geometry references and out-of-page bounds',()=>{
 const project={...createDemoProject(),planImageUrl:'data:image/png;base64,AA==',planReference:{widthPx:500,heightPx:500,origin:{x:0,z:0},mmPerPixel:10,calibrated:true},planLabels:label,planAnalysis:{lines,issues:[],numericCount:0,textState:'complete' as const,lineState:'complete' as const,stairRegions:detectStairRegions(label,lines)}};
 expect(parseProject(JSON.parse(JSON.stringify(project)))).toEqual(project);
 const invalid=structuredClone(project);invalid.planAnalysis.stairRegions[0].lineIds[0]='missing';
 expect(()=>parseProject(invalid)).toThrow(/계단/);
 const outside=structuredClone(project);outside.planAnalysis.stairRegions[0].box.width=1000;
 expect(()=>parseProject(outside)).toThrow(/계단/);
});

it('excludes only interior tread strokes while preserving enclosing walls and continuations',()=>{
 const regions=detectStairRegions(label,lines);
 expect([...interiorStairTreadIds(regions,lines)]).toEqual(['t1','t2','t3']);
 const extended=[...lines,{id:'wall-extension',start:{x:140,y:150},end:{x:140,y:300},thicknessPx:5}];
 expect([...interiorStairTreadIds(regions,extended)]).toEqual(['t1','t3']);
 expect(interiorStairTreadIds([],lines).size).toBe(0);
});

it('keeps unlabelled geometry provisional, requires cross-pass agreement and persists its rail evidence',()=>{
 const treads=Array.from({length:6},(_,i)=>({id:`shape-t${i}`,start:{x:100+i*20,y:30},end:{x:100+i*20,y:150},thicknessPx:2}));
 const rails=[30,150].map(y=>({id:`shape-r${y}`,start:{x:100,y},end:{x:200,y},thicknessPx:3}));
 const shapeLines=[...treads,...rails],regions=detectStairRegions([],shapeLines),region=regions[0];
 expect(region.evidence).toBe('shape');expect(region.labelId).toBeUndefined();
 expect(stableStairRegions([regions,[]],0)).toEqual([]);
 const other={...region,id:'other-pass',lineIds:region.lineIds.map(id=>id+'-pass'),box:{...region.box,x:102}};
 expect(stableStairRegions([regions,[other]],0)).toEqual(regions);
 expect(stableStairRegions([regions,[other],[{...other,box:{...other.box,x:130}}]],0)).toEqual([]);
 const project={...createDemoProject(),planImageUrl:'data:image/png;base64,AA==',planReference:{widthPx:500,heightPx:500,origin:{x:0,z:0},mmPerPixel:10,calibrated:true},planLabels:[],planAnalysis:{lines:shapeLines,issues:[],numericCount:0,textState:'complete' as const,lineState:'complete' as const,stairRegions:regions}};
 expect(parseProject(JSON.parse(JSON.stringify(project)))).toEqual(project);
 const missing=structuredClone(project);missing.planAnalysis.stairRegions[0].railIds=['missing','shape-r150'];
 expect(()=>parseProject(missing)).toThrow(/계단/);
});
