import {it,expect} from 'vitest';
import {pairWallEdges} from './pairWallEdges';
const l=(id:string,x:number,y:number,x2:number,y2:number)=>({id,start:{x,y},end:{x:x2,y:y2},thicknessPx:1});
const outline=()=>[l('a',10,20,210,20),l('b',10,40,210,40),l('c',10,20,10,40),l('d',210,20,210,40)];
it('reduces a capped double outline to one centerline while preserving input',()=>{const a=outline(),before=structuredClone(a);expect(pairWallEdges(a)).toMatchObject([{start:{x:10,y:30},end:{x:210,y:30},thicknessPx:21}]);expect(a).toEqual(before);});
it('supports vertical outlines and reversed endpoints',()=>{const a=outline().map(w=>({...w,start:{x:w.end.y,y:w.end.x},end:{x:w.start.y,y:w.start.x}}));expect(pairWallEdges(a)).toMatchObject([{start:{x:30,y:10},end:{x:30,y:210}}]);});
it('never merges uncapped parallels, corridor-width gaps or one-ended outlines',()=>{for(const a of [outline().slice(0,2),outline().slice(0,3),[l('a',0,0,1000,0),l('b',0,200,1000,200),l('c',0,0,0,200),l('d',1000,0,1000,200)]])expect(pairWallEdges(a)).toEqual(a);});
it('rejects inconsistent end caps and duplicate competing evidence',()=>{const a=outline();a.push({...a[2],id:'duplicate'});expect(pairWallEdges(a)).toEqual(a);});

const rotate=(angle:number)=>({x,y}:{x:number;y:number})=>({x:500+x*Math.cos(angle)-y*Math.sin(angle),y:700+x*Math.sin(angle)+y*Math.cos(angle)});
it('recovers capped diagonal outlines at arbitrary angles and endpoint directions',()=>{
 for(const angle of [Math.PI/6,Math.PI/4,Math.PI*2/3,-Math.PI/7])for(const reverse of [false,true]){
  const point=rotate(angle),input=outline().map(w=>({...w,start:point(reverse?w.end:w.start),end:point(reverse?w.start:w.end)}));
  const before=structuredClone(input),result=pairWallEdges(input);
  expect(result).toHaveLength(1);expect(result[0].thicknessPx).toBeCloseTo(21);
  const expected=[point({x:10,y:30}),point({x:210,y:30})];
  for(const p of [result[0].start,result[0].end])expect(Math.min(...expected.map(q=>Math.hypot(p.x-q.x,p.y-q.y)))).toBeLessThan(1e-8);
  expect(input).toEqual(before);
 }
});
it('preserves diagonal open gaps, tapering edges and ambiguous caps',()=>{
 const tapered=outline();tapered[1].end.y+=5;tapered[3].end.y+=5;
 for(const source of [outline().slice(0,3),tapered,[...outline(),{...outline()[2],id:'duplicate'}]]){
  const point=rotate(Math.PI/5),input=source.map(w=>({...w,start:point(w.start),end:point(w.end)}));
  expect(pairWallEdges(input)).toEqual(input);
 }
});
