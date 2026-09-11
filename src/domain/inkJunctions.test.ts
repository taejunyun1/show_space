import {expect,it} from 'vitest';
import {recoverInkJunctions} from './inkJunctions';
import type {WallCandidate} from './wallCandidates';
const lines:WallCandidate[]=[{id:'vertical',start:{x:50.5,y:10},end:{x:50.5,y:76},thicknessPx:3},{id:'bottom',start:{x:10,y:80.5},end:{x:90,y:80.5},thicknessPx:3}];
const ink=()=>{const data=new Uint8Array(10000);for(let y=10;y<=80;y++)data[y*100+50]=1;return data;};
it('recovers an observed continuous junction without moving its supporting wall',()=>{
 const before=structuredClone(lines),result=recoverInkJunctions(lines,ink(),100,100);
 expect(result[0].end).toEqual({x:50.5,y:80.5});expect(result[1]).toEqual(lines[1]);expect(lines).toEqual(before);
});
it('preserves even a one-pixel opening and rejects a competing parallel target',()=>{
 const data=ink();data[78*100+50]=0;
 expect(recoverInkJunctions(lines,data,100,100)).toEqual(lines);
 const competing={...lines[1],id:'parallel',start:{x:10,y:79.5},end:{x:90,y:79.5}};
 expect(recoverInkJunctions([...lines,competing],ink(),100,100)[0]).toEqual(lines[0]);
});
it('does not bridge a long gap or extrapolate beyond a supporting segment',()=>{
 expect(recoverInkJunctions([{...lines[0],end:{x:50.5,y:70}},lines[1]],ink(),100,100)[0].end.y).toBe(70);
 expect(recoverInkJunctions([lines[0],{...lines[1],start:{x:60,y:80.5}}],ink(),100,100)[0]).toEqual(lines[0]);
});
