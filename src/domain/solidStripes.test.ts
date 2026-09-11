import {it,expect} from 'vitest';
import {mergeSolidStripes} from './solidStripes';
const lines=[{id:'a',start:{x:10,y:22},end:{x:180,y:22},thicknessPx:4},{id:'b',start:{x:10,y:26},end:{x:184,y:26},thicknessPx:4}];
it('merges split bands backed by a filled raster and preserves source candidates',()=>{const dark=new Uint8Array(200*100);for(let y=20;y<28;y++)for(let x=10;x<184;x++)dark[y*200+x]=1;const before=structuredClone(lines),result=mergeSolidStripes(lines,dark,200,100);expect(result).toMatchObject([{start:{x:10,y:24},end:{x:184,y:24},thicknessPx:8}]);expect(lines).toEqual(before);});
it('never merges parallel walls separated by unpainted pixels',()=>{const dark=new Uint8Array(200*100);for(let y=20;y<28;y++)for(let x=10;x<184;x++)if(y!==24)dark[y*200+x]=1;expect(mergeSolidStripes(lines,dark,200,100)).toEqual(lines);});
it('does not extend a short thick wall along a much longer thin unrelated line',()=>{const dark=new Uint8Array(200*100).fill(1);const input=[lines[0],{...lines[1],end:{x:80,y:26}}];expect(mergeSolidStripes(input,dark,200,100)).toEqual(input);});
