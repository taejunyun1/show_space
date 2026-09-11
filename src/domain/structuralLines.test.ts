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
