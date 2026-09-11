import {it,expect} from 'vitest';
import {alignRasterJunctions} from './rasterJunctions';
const trunk={id:'trunk',start:{x:100,y:0},end:{x:100,y:200},thicknessPx:8};
const branch={id:'branch',start:{x:103,y:100},end:{x:250,y:100},thicknessPx:5};
it('joins an offset branch to the interior of its supporting wall without moving that wall',()=>{
 const result=alignRasterJunctions([trunk,branch]);expect(result[0]).toEqual(trunk);expect(result[1].start).toEqual({x:100,y:100});expect(branch.start.x).toBe(103);
});
it('withholds competing intersections and real gaps',()=>{
 const other={...trunk,id:'other',start:{x:105,y:0},end:{x:105,y:200}};
 expect(alignRasterJunctions([trunk,other,branch])[2]).toEqual(branch);
 const far={...branch,start:{x:125,y:100}};expect(alignRasterJunctions([trunk,far])[1]).toEqual(far);
});
it('does not extrapolate beyond the supporting wall or use thin text strokes',()=>{
 const outside={...branch,start:{x:103,y:220},end:{x:250,y:220}};
 expect(alignRasterJunctions([trunk,outside])[1]).toEqual(outside);
 expect(alignRasterJunctions([{...trunk,thicknessPx:1},branch])[1]).toEqual(branch);
});
