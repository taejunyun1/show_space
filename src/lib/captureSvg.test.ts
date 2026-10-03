import {expect,it} from 'vitest';
import {captureFit,capturePixelSize} from './captureSvg';

it('preserves the drawing aspect ratio at the requested long edge',()=>{
 expect(capturePixelSize(8000,6000,3840)).toEqual({width:3840,height:2880});
 expect(capturePixelSize(3200,6400,1920)).toEqual({width:960,height:1920});
});

it.each([[1920,1080],[2560,1440],[3840,2160]])('exports exact 16:9 dimensions at long edge %i', (width,height)=>{
 expect(capturePixelSize(743,901,width,{width:16,height:9})).toEqual({width,height});
 expect(capturePixelSize(901,743,width,{width:9,height:16})).toEqual({width:height,height:width});
});

it('supports square and custom aspect ratios independently of the source',()=>{
 expect(capturePixelSize(743,901,2560,{width:1,height:1})).toEqual({width:2560,height:2560});
 expect(capturePixelSize(901,743,1920,{width:2.4,height:1})).toEqual({width:1920,height:800});
 expect(capturePixelSize(901,743,1920,{width:10000,height:1})).toEqual({width:1920,height:1});
});

it.each([{width:NaN,height:1},{width:16,height:0},{width:Infinity,height:9},{width:10001,height:1}])('rejects invalid custom ratio %o',ratio=>{
 expect(()=>capturePixelSize(800,600,1920,ratio)).toThrow();
});

it.each([
 [{width:743,height:901},{width:1920,height:1080}],
 [{width:901,height:743},{width:1080,height:1920}],
 [{width:8000,height:6000},{width:2560,height:2560}],
 [{width:901,height:743},{width:1920,height:1583}],
])('contains all four source corners and keeps proportions %o', (source,target)=>{
 const fit=captureFit(source,target);
 expect(fit.x).toBeGreaterThanOrEqual(0);expect(fit.y).toBeGreaterThanOrEqual(0);
 expect(fit.x+fit.width).toBeLessThanOrEqual(target.width+1e-8);
 expect(fit.y+fit.height).toBeLessThanOrEqual(target.height+1e-8);
 expect(fit.width/fit.height).toBeCloseTo(source.width/source.height,10);
 expect(fit.x*2+fit.width).toBeCloseTo(target.width,10);
 expect(fit.y*2+fit.height).toBeCloseTo(target.height,10);
 expect(Math.min(fit.x,fit.y)).toBeCloseTo(0,10);
});

it('rejects invalid source or output sizes before composing',()=>{
 expect(()=>captureFit({width:0,height:600},{width:1920,height:1080})).toThrow();
 expect(()=>captureFit({width:800,height:600},{width:NaN,height:1080})).toThrow();
 expect(()=>capturePixelSize(0,600,1920,{width:16,height:9})).toThrow();
});

it('rejects invalid or excessive capture dimensions',()=>{
 expect(()=>capturePixelSize(0,6000,1920)).toThrow();
 expect(()=>capturePixelSize(6000,4000,20000)).toThrow();
});
