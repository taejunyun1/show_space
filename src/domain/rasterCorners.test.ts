import {it,expect} from 'vitest';
import {alignRasterCorners} from './rasterCorners';
const h={id:'h',start:{x:100,y:100},end:{x:908,y:100},thicknessPx:16},v={id:'v',start:{x:900,y:92},end:{x:900,y:500},thicknessPx:16};
it('joins thick stroke caps at the axis-preserving centerline intersection',()=>{const result=alignRasterCorners([h,v]);expect(result[0].end).toEqual({x:900,y:100});expect(result[1].start).toEqual({x:900,y:100});expect(h.end.x).toBe(908);});
it('does not bridge doorway-sized gaps',()=>{const far={...v,start:{x:900,y:150}};expect(alignRasterCorners([h,far])).toEqual([h,far]);});
it('aligns a nearby diagonal corner while preserving its direction',()=>{const diagonal={...v,end:{x:950,y:500}},result=alignRasterCorners([h,diagonal]);expect(result[0].end).toEqual(result[1].start);expect(result[1].start.x).toBeCloseTo(900.980392);expect(result[1].start.y).toBe(100);});
it('leaves competing distinct corner locations unchanged',()=>{const alternative={...v,id:'other',start:{x:904,y:92},end:{x:904,y:500}};expect(alignRasterCorners([h,v,alternative])).toEqual([h,v,alternative]);});
