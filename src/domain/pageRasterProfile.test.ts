import {it,expect} from 'vitest';
import {pageRasterProfile} from './pageRasterProfile';
it('separates light line drawings from midtone color pages while compositing transparency',()=>{
 expect(pageRasterProfile(new Uint8ClampedArray([255,255,255,255,0,0,0,255]))).toEqual({lightFraction:.5,midToneFraction:0,coloredFraction:0});
 expect(pageRasterProfile(new Uint8ClampedArray([150,100,60,255]))).toEqual({lightFraction:0,midToneFraction:1,coloredFraction:1});
 expect(pageRasterProfile(new Uint8ClampedArray([0,0,0,0]))).toEqual({lightFraction:1,midToneFraction:0,coloredFraction:0});
});
