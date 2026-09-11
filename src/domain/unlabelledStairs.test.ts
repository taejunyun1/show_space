import {it,expect} from 'vitest';
import {detectUnlabelledStairCandidates} from './unlabelledStairs';
import {detectPlanLabels} from './planLabels';
const treads=Array.from({length:6},(_,i)=>({id:`t${i}`,start:{x:100+i*20,y:30},end:{x:100+i*20,y:150},thicknessPx:2}));
const rails=[30,150].map(y=>({id:`r${y}`,start:{x:100,y},end:{x:200,y},thicknessPx:3}));
it('finds a bounded regular run without requiring a text label',()=>{
 expect(detectUnlabelledStairCandidates([...treads,...rails])).toEqual([{box:{x:100,y:30,width:100,height:120},lineIds:treads.map(l=>l.id),railIds:rails.map(l=>l.id)}]);
});
it('rejects unsupported repetition, irregular spacing, grids and explicitly labelled furniture',()=>{
 expect(detectUnlabelledStairCandidates(treads)).toEqual([]);
 expect(detectUnlabelledStairCandidates([...treads.slice(0,4),...rails])).toEqual([]);
 expect(detectUnlabelledStairCandidates([...treads.filter((_,i)=>i!==2),...rails])).toEqual([]);
 expect(detectUnlabelledStairCandidates([...treads,...rails,{...rails[0],id:'grid',start:{x:100,y:90},end:{x:200,y:90}}])).toEqual([]);
 const labels=detectPlanLabels([{text:'CABINET',source:'pdf-text',box:{x:120,y:70,width:50,height:15}}]);
 expect(detectUnlabelledStairCandidates([...treads,...rails],labels)).toEqual([]);
});
