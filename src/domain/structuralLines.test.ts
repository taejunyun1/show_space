import {extractStructuralWalls} from './automaticVenue';
import {it,expect} from 'vitest';
import {selectStructuralLines} from './structuralLines';
const line=(id:string,x:number,y:number,x2:number,y2:number)=>({id,start:{x,y},end:{x:x2,y:y2},thicknessPx:5});
it('restores short stepped connectors between long walls',()=>{const input=[line('a',0,0,200,0),line('b',200,0,200,30),line('c',200,30,230,30),line('d',230,30,230,0),line('e',230,0,430,0)];expect(selectStructuralLines(input,100,[])).toHaveLength(5);});
it('does not keep dangling ticks or detached glyph loops',()=>{const input=[line('a',0,0,200,0),line('tick',100,0,100,20),line('g1',50,50,70,50),line('g2',70,50,70,70),line('g3',70,70,50,70),line('g4',50,70,50,50)];expect(selectStructuralLines(input,100,[]).map(l=>l.id)).toEqual(['a']);});
it('excludes strokes contained in recognized text boxes without cutting other lines',()=>{const lines=[line('text',0,0,200,0),line('wall',0,50,200,50)];expect(selectStructuralLines(lines,100,[{id:'t',text:'1234',source:'pdf-text',kind:'dimension',status:'unreviewed',note:'',box:{x:0,y:0,width:200,height:15}}]).map(l=>l.id)).toEqual(['wall']);});

it('retains a thin boundary segment directly joining two thick walls',()=>{
 const input=[line('left',0,0,0,200),line('right',300,0,300,200),{...line('bottom',0,200,300,200),thicknessPx:1.5}];
 expect(selectStructuralLines(input,100,[]).map(l=>l.id)).toContain('bottom');
});
it('does not promote detached thin lines or dimension witnesses into a structure',()=>{
 const input=[line('wall',0,0,300,0),{...line('dimension',0,-20,300,-20),thicknessPx:1.5},{...line('w1',0,-30,0,5),thicknessPx:1.5},{...line('w2',300,-30,300,5),thicknessPx:1.5}];
 expect(selectStructuralLines(input,100,[]).map(l=>l.id)).toEqual(['wall']);
});

it('retains sub-ten-pixel thick connectors only between distinct supporting walls',()=>{
 const input=[line('left',0,0,200,0),line('step',200,0,200,6),line('middle',200,6,235,6),line('rise',235,6,235,-90),line('right',235,-90,450,-90)];
 expect(selectStructuralLines(input,100,[]).map(l=>l.id)).toEqual(input.map(l=>l.id));
 const detached=[line('left',0,0,200,0),line('tick',100,0,100,3),line('floating',210,1,210,7)];
 expect(selectStructuralLines(detached,100,[]).map(l=>l.id)).toEqual(['left']);
});

it('preserves the observed Espacio upper notch through the full structural pipeline',()=>{
 const raw=[line('left',253,301.5,625,301.5),{...line('right',653,251.5,1017,251.5),thicknessPx:9},line('rise',655.5,247,655.5,310),{...line('step',622,307,658,307),thicknessPx:6},{...line('tiny',623.5,298,623.5,310),thicknessPx:3}];
 const lines=raw.map(l=>({...l,start:{x:l.start.x*2400/1400,y:l.start.y*1696/989},end:{x:l.end.x*2400/1400,y:l.end.y*1696/989},thicknessPx:l.thicknessPx*2400/1400}));
 const walls=extractStructuralWalls({imageUrl:'data:image/png;base64,AA==',widthPx:2400,heightPx:1696,labels:[],analysis:{lines,issues:[],numericCount:0,textState:'complete',lineState:'complete'}});
 expect(walls).toHaveLength(5);
 const tiny=walls.find(w=>Math.hypot(w.end.x-w.start.x,w.end.z-w.start.z)<10);
 expect(tiny).toBeDefined();
 for(const endpoint of [tiny!.start,tiny!.end])expect(walls.some(w=>w!==tiny&&[w.start,w.end].some(p=>Math.hypot(p.x-endpoint.x,p.z-endpoint.z)<.01))).toBe(true);
});

it('restores the observed brighter-threshold notch by trimming a real crossing cap',()=>{
 const raw=[line('left',82,303.5,625,303.5),{...line('right',653,251.5,1017,251.5),thicknessPx:9},line('rise',655.5,247,655.5,310),{...line('step',621.833333,307,658,307),thicknessPx:6},{...line('tiny',623.5,298,623.5,310),thicknessPx:3}];
 const lines=raw.map(l=>({...l,start:{x:l.start.x*2400/1400,y:l.start.y*1696/989},end:{x:l.end.x*2400/1400,y:l.end.y*1696/989},thicknessPx:l.thicknessPx*2400/1400}));
 const walls=extractStructuralWalls({imageUrl:'data:image/png;base64,AA==',widthPx:2400,heightPx:1696,labels:[],analysis:{lines,issues:[],numericCount:0,textState:'complete',lineState:'complete'}});
 expect(walls).toHaveLength(5);
 expect(walls.some(w=>Math.abs(w.end.z-w.start.z)>5&&Math.abs(w.end.z-w.start.z)<7)).toBe(true);
});
