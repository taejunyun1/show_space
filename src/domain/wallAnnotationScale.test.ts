import {it,expect} from 'vitest';
import {wallAnnotationScale} from './wallAnnotationScale';
import {createDemoProject} from './model';
import {detectPlanLabels} from './planLabels';
const wall=(id:string,x:number,z:number,x2:number,z2:number)=>({...createDemoProject().walls[0],id,start:{x,z},end:{x:x2,z:z2}});
const walls=[wall('top',100,100,900,100),wall('left',100,100,100,700),wall('right',900,100,900,700)];
const labels=detectPlanLabels([{text:'8000 mm',source:'pdf-text',box:{x:450,y:60,width:100,height:20}},{text:'6000 mm',source:'pdf-text',box:{x:60,y:350,width:20,height:100}},{text:'6000 mm',source:'pdf-text',box:{x:920,y:350,width:20,height:100}}]);
it('derives a scale only from at least three unique annotations on both axes',()=>{
 expect(wallAnnotationScale(walls,labels).scale).toBe(10);expect(wallAnnotationScale(walls,labels.slice(0,2)).scale).toBeUndefined();
});
it('withholds inconsistent annotated drawing proportions and ambiguous wall targets',()=>{
 const inconsistent=labels.map((l,i)=>i===1?{...l,text:'5000 mm'}:l);
 expect(wallAnnotationScale(walls,inconsistent).conflict).toBe(true);expect(wallAnnotationScale(walls,inconsistent).scale).toBeUndefined();
 expect(wallAnnotationScale([...walls,{...walls[0],id:'other-top'}],labels).scale).toBeUndefined();
});
it('rejects uncertain readings, height notes and missing units',()=>{
 for(const patch of [{numericConflict:true},{source:'ocr' as const,confidence:60},{text:'HEIGHT 6000 mm'},{text:'6000'}])expect(wallAnnotationScale(walls,labels.map(l=>({...l,...patch}))).scale).toBeUndefined();
});
it('matches a portion bounded by an actual T-junction, without assigning the full wall length',()=>{
 const input=[wall('bottom',0,100,1000,100),wall('divider',400,0,400,100)];
 const text=detectPlanLabels([{text:'3860 mm',source:'pdf-text',box:{x:170,y:120,width:60,height:20}}]);
 expect(wallAnnotationScale(input,text).matches).toMatchObject([{wallId:'bottom',from:0,to:400,mm:3860,lengthPx:400}]);
 expect(wallAnnotationScale([input[0],{...input[1],end:{x:400,z:95}}],text).matches).toEqual([]);
});
it('withholds a label when both whole and junction-bounded portion are plausible',()=>{
 const input=[wall('bottom',0,100,1000,100),wall('divider',600,0,600,100)];
 const text=detectPlanLabels([{text:'3860 mm',source:'pdf-text',box:{x:330,y:120,width:60,height:20}}]);
 expect(wallAnnotationScale(input,text).matches).toEqual([]);
});
it('assigns opposite-face labels to the nearest visible wall despite slight raster endpoint drift',()=>{
 const input=[wall('inside',200,100,200,500),wall('outside',198.5,150,200,500)];
 const text=detectPlanLabels([{text:'1750 mm',source:'pdf-text',box:{x:150,y:280,width:20,height:60}},{text:'1800 mm',source:'pdf-text',box:{x:220,y:280,width:20,height:60}}]);
 expect(wallAnnotationScale(input,text).allMatches.map(m=>[m.wallId,m.mm,m.from,m.to])).toEqual([['outside',1750,150,500],['inside',1800,100,500]]);
});
it('does not connect through a closer parallel wall or accept a materially slanted wall',()=>{
 const text=detectPlanLabels([{text:'2000 mm',source:'pdf-text',box:{x:100,y:200,width:20,height:60}}]);
 expect(wallAnnotationScale([wall('far',160,0,160,500),wall('near',130,180,130,280)],text).allMatches.every(m=>m.wallId!=='far')).toBe(true);
 expect(wallAnnotationScale([wall('slanted',150,0,160,500)],text).matches).toEqual([]);
});

it('does not assign a whole boundary when a nearby disconnected return suggests a partial dimension',()=>{
 const input=[wall('bottom',0,100,1000,100),wall('left',300,0,300,100),wall('near-right',700,0,700,95)];
 const text=detectPlanLabels([{text:'2850 mm',source:'pdf-text',box:{x:470,y:120,width:60,height:20}}]);
 expect(wallAnnotationScale(input,text).allMatches).toEqual([]);
});
it('does not bind one value from a windowsill size pair to a wall length',()=>{
 const input=[wall('sill-edge',100,100,500,100)];
 const text=detectPlanLabels([{text:'Window sill: 2,68 x 0,38m',source:'pdf-text',box:{x:160,y:60,width:280,height:20}}]);
 expect(wallAnnotationScale(input,text).allMatches).toEqual([]);
});
it('binds an upright identifier only to explicitly door-split spans',()=>{
 const text=detectPlanLabels([{text:'B3 = 3,05m',source:'pdf-text',box:{x:135,y:390,width:120,height:24}}]);
 const spans=[wall('before',100,0,100,500),wall('after',100,650,100,900)];
 expect(wallAnnotationScale(spans,text).matches).toEqual([]);
 expect(wallAnnotationScale(spans,text,spans,new Set(['before','after'])).matches).toMatchObject([{wallId:'before',horizontal:false,mm:3050,from:0,to:500}]);
});
it('withholds upright identifiers across a return, closer wall or opening',()=>{
 const text=detectPlanLabels([{text:'B3 = 3,05m',source:'pdf-text',box:{x:135,y:390,width:120,height:24}}]);
 const base=wall('before',100,0,100,500),allowed=new Set(['before']);
 const branched=[base,wall('return',100,200,300,200)];expect(wallAnnotationScale(branched,text,branched,allowed).matches).toEqual([]);
 const crossingReturn=[base,wall('cross-return',80,200,300,200)];expect(wallAnnotationScale(crossingReturn,text,crossingReturn,allowed).matches).toEqual([]);
 const hidden=[base,wall('near',120,0,120,500)];expect(wallAnnotationScale(hidden,text,hidden,allowed).matches).toEqual([]);
 const crossing=detectPlanLabels([{text:'B3 = 3,05m',source:'pdf-text',box:{x:135,y:490,width:120,height:24}}]);expect(wallAnnotationScale([base],crossing,[base],allowed).matches).toEqual([]);
});
