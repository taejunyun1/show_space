import {it,expect} from 'vitest';
import {pairWallEdges} from './pairWallEdges';
const l=(id:string,x:number,y:number,x2:number,y2:number)=>({id,start:{x,y},end:{x:x2,y:y2},thicknessPx:1});
const outline=()=>[l('a',10,20,210,20),l('b',10,40,210,40),l('c',10,20,10,40),l('d',210,20,210,40)];
it('reduces a capped double outline to one centerline while preserving input',()=>{const a=outline(),before=structuredClone(a);expect(pairWallEdges(a)).toMatchObject([{start:{x:10,y:30},end:{x:210,y:30},thicknessPx:21}]);expect(a).toEqual(before);});
it('supports vertical outlines and reversed endpoints',()=>{const a=outline().map(w=>({...w,start:{x:w.end.y,y:w.end.x},end:{x:w.start.y,y:w.start.x}}));expect(pairWallEdges(a)).toMatchObject([{start:{x:30,y:10},end:{x:30,y:210}}]);});
it('never merges uncapped parallels, corridor-width gaps or one-ended outlines',()=>{for(const a of [outline().slice(0,2),outline().slice(0,3),[l('a',0,0,1000,0),l('b',0,200,1000,200),l('c',0,0,0,200),l('d',1000,0,1000,200)]])expect(pairWallEdges(a)).toEqual(a);});
it('rejects inconsistent end caps and duplicate competing evidence',()=>{const a=outline();a.push({...a[2],id:'duplicate'});expect(pairWallEdges(a)).toEqual(a);});
