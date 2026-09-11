import {expect,it} from 'vitest';
import {numericOcrRegions} from './ocrRegions';
it('covers image corners and overlaps the tile seams without exceeding source bounds',()=>{
 for(const [width,height] of [[2400,1696],[10,20],[777,1234]]){
  const r=numericOcrRegions(width,height);expect(r).toHaveLength(4);
  expect(r.every(b=>b.x>=0&&b.y>=0&&b.x+b.width<=width&&b.y+b.height<=height)).toBe(true);
  for(const x of [0,width/2,width])for(const y of [0,height/2,height])expect(r.some(b=>x>=b.x&&x<=b.x+b.width&&y>=b.y&&y<=b.y+b.height)).toBe(true);
  expect(r[0].x+r[0].width).toBeGreaterThan(r[1].x);
 }
 expect(numericOcrRegions(NaN,100)).toEqual([]);expect(numericOcrRegions(0,100)).toEqual([]);
});
