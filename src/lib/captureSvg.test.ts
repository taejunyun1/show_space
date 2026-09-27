import {expect,it} from 'vitest';
import {capturePixelSize} from './captureSvg';

it('preserves the drawing aspect ratio at the requested long edge',()=>{
 expect(capturePixelSize(8000,6000,3840)).toEqual({width:3840,height:2880});
 expect(capturePixelSize(3200,6400,1920)).toEqual({width:960,height:1920});
});

it('rejects invalid or excessive capture dimensions',()=>{
 expect(()=>capturePixelSize(0,6000,1920)).toThrow();
 expect(()=>capturePixelSize(6000,4000,20000)).toThrow();
});
