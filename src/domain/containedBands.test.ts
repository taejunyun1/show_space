import {it,expect} from 'vitest';
import {removeContainedSolidBands} from './containedBands';
const long={id:'long',start:{x:10,y:27.5},end:{x:190,y:27.5},thicknessPx:1};
const short={id:'short',start:{x:10,y:23},end:{x:100,y:23},thicknessPx:6};
it('preserves the complete original stroke while removing its solid contained fragment',()=>{
 const ink=new Uint8Array(200*100);for(let x=10;x<190;x++)ink[27*200+x]=1;for(let y=20;y<28;y++)for(let x=10;x<100;x++)ink[y*200+x]=1;
 expect(removeContainedSolidBands([short,long],ink,200,100)).toEqual([{...long,solidSupportThicknessPx:6}]);
});
it('preserves genuinely separated parallel walls and partially overlapping strokes',()=>{
 const ink=new Uint8Array(200*100).fill(1);for(let x=10;x<100;x++)ink[26*200+x]=0;
 expect(removeContainedSolidBands([short,long],ink,200,100)).toEqual([short,long]);
 const overhang={...short,start:{x:0,y:23}};
 expect(removeContainedSolidBands([overhang,long],new Uint8Array(200*100).fill(1),200,100)).toEqual([overhang,long]);
});

it('preserves a thick wall when a collinear thin witness extends beyond it',()=>{
 const central={...long,start:{x:0,y:23},end:{x:190,y:23}};
 expect(removeContainedSolidBands([short,central],new Uint8Array(200*100).fill(1),200,100)).toEqual([short,central]);
});
