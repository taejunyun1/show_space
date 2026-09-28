import {expect,it} from 'vitest';
import {panViewport} from './viewportPan';

it('moves the view in both screen axes without changing its size',()=>{
  const view={x:-700,z:-650,width:9400,height:5600};
  expect(panViewport(view,{x:120,y:-45},2)).toEqual({x:-760,z:-627.5,width:9400,height:5600});
  expect(view).toEqual({x:-700,z:-650,width:9400,height:5600});
});

it('ignores a non-finite or zero screen scale',()=>{
  expect(()=>panViewport({x:0,z:0,width:100,height:100},{x:10,y:10},0)).toThrow(/배율/);
});
