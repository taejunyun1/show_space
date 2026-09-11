import {it,expect} from 'vitest';
import {createDemoProject,parseProject} from './model';
import {solveDimensionConstraints} from './dimensionConstraints';
import {createDimensionMap} from './dimensionMap';
import {prepareMappedVenue} from './mappedVenue';
import {installationZones} from './installationZones';
import {detectPlanLabels} from './planLabels';
const wall=(id:string,x:number,z:number,x2:number,z2:number)=>({...createDemoProject().walls[0],id,start:{x,z},end:{x:x2,z:z2}});
function fixture(){
 const walls=[wall('a',0,0,100,0),wall('b',100,0,300,0),wall('c',0,0,0,200)];
 const map=createDimensionMap(solveDimensionConstraints(walls,[{wallId:'a',labelId:'a',mm:1000,horizontal:true},{wallId:'b',labelId:'b',mm:1000,horizontal:true},{wallId:'c',labelId:'c',mm:4000,horizontal:false}]))!;
 const labels=detectPlanLabels([{text:'Stairs',source:'pdf-text',box:{x:100,y:50,width:40,height:20}}]);
 const lines=[60,80,100].map((y,i)=>({id:`t${i}`,start:{x:100,y},end:{x:140,y},thicknessPx:2}));
 const stairs=[{id:'stairs',kind:'stairs' as const,labelId:labels[0].id,lineIds:lines.map(l=>l.id),box:{x:100,y:60,width:40,height:40}}];
 return {walls,map,labels,lines,stairs,openings:[]};
}
it('keeps transformed stairs, evidence and project serialization in the same coordinates',()=>{
 const input=fixture(),prepared=prepareMappedVenue(input.map,input)!;
 const p=parseProject({...createDemoProject(),...prepared.layers,planImageUrl:'data:image/png;base64,AA==',artworks:[],planAnalysis:{lines:prepared.lines,stairRegions:prepared.stairs,issues:[],numericCount:0,textState:'complete',lineState:'complete'}});
 expect(installationZones(p)[0]).toMatchObject({x:1000,z:1200,width:200,depth:800});
 expect(prepared.cells).toHaveLength(2);expect(input.stairs[0].box.width).toBe(40);
});
it('remaps opening anchors to terminal wall pieces after a diagonal splits',()=>{
 const input=fixture(),diagonal=wall('diagonal',0,0,300,200);
 const prepared=prepareMappedVenue(input.map,{...input,walls:[...input.walls,diagonal],openings:[{id:'door',kind:'door',role:'boundary',note:'',start:{wallId:'diagonal',endpoint:'end'},end:{wallId:'b',endpoint:'end'}}]})!;
 expect(prepared.layers.openings![0].start.wallId).toBe('diagonal:mapped-2');
 expect(prepared.layers.walls.find(w=>w.id==='diagonal:mapped-2')!.end).toEqual({x:2000,z:4000});
});
it('returns out-of-range annotations but never silently drops an installation exclusion',()=>{
 const input=fixture(),outside={...input.labels[0],id:'outside',box:{x:400,y:10,width:20,height:20}};
 expect(prepareMappedVenue(input.map,{...input,labels:[...input.labels,outside]})!.outsideLabels).toEqual([outside]);
 expect(prepareMappedVenue(input.map,{...input,stairs:[{...input.stairs[0],box:{x:280,y:60,width:40,height:40}}]})).toBeUndefined();
 expect(prepareMappedVenue(input.map,{...input,lines:input.lines.slice(1)})).toBeUndefined();
});

it('preserves unlabelled stair candidates and rail references through mapping and installation exclusions',()=>{
 const input=fixture(),rails=[100,140].map(x=>({id:`rail-${x}`,start:{x,y:60},end:{x,y:100},thicknessPx:2}));
 const shape={...input.stairs[0],labelId:undefined,evidence:'shape' as const,railIds:rails.map(l=>l.id)};
 const prepared=prepareMappedVenue(input.map,{...input,labels:[],lines:[...input.lines,...rails],stairs:[shape]})!;
 const p=parseProject({...createDemoProject(),...prepared.layers,planImageUrl:'data:image/png;base64,AA==',artworks:[],planAnalysis:{lines:prepared.lines,stairRegions:prepared.stairs,issues:[],numericCount:0,textState:'complete',lineState:'complete'}});
 expect(p.planAnalysis!.stairRegions![0].evidence).toBe('shape');
 expect(installationZones(p)[0]).toMatchObject({x:1000,z:1200,width:200,depth:800});
 expect(prepareMappedVenue(input.map,{...input,labels:[],stairs:[shape]})).toBeUndefined();
});
it('maps observed door/window junctions and refuses points outside measured coordinates',()=>{
 const input=fixture();const opening={id:'glass',kind:'window' as const,role:'boundary' as const,note:'',start:{point:{x:150,z:100}},end:{wallId:'b',endpoint:'end' as const}};
 expect(prepareMappedVenue(input.map,{...input,openings:[opening]})!.layers.openings![0].start).toEqual({point:{x:1250,z:2000}});
 expect(prepareMappedVenue(input.map,{...input,openings:[{...opening,start:{point:{x:400,z:100}}}]})).toBeUndefined();
});
