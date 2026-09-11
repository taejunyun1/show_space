import {it,expect} from 'vitest';
import {cropRect,rotatedSize} from './planTransform';
it('normalizes backwards selections and clamps to image bounds',()=>{expect(cropRect({x:90,y:80},{x:-10,y:10},100,100)).toEqual({x:0,y:10,width:90,height:70});});
it('rejects tiny or nonfinite selections',()=>{expect(()=>cropRect({x:1,y:1},{x:2,y:2},100,100)).toThrow();expect(()=>cropRect({x:NaN,y:0},{x:10,y:10},100,100)).toThrow();});
it('swaps dimensions only for quarter turns',()=>{expect(rotatedSize(1200,800,90)).toEqual({width:800,height:1200});expect(rotatedSize(1200,800,180)).toEqual({width:1200,height:800});expect(()=>rotatedSize(1200,800,45)).toThrow();});

it('rotates actual colored pixels clockwise and crops in rotated coordinates',async()=>{
 const {createCanvas,Image}=await import('@napi-rs/canvas');const {vi}=await import('vitest');const {transformPlan}=await import('./planTransform');
 const src=createCanvas(40,20),ctx=src.getContext('2d');ctx.fillStyle='red';ctx.fillRect(0,0,20,20);ctx.fillStyle='blue';ctx.fillRect(20,0,20,20);
 vi.stubGlobal('Image',Image);vi.stubGlobal('document',{createElement:()=>createCanvas(1,1)});
 try{const result=await transformPlan({imageUrl:src.toDataURL('image/png'),widthPx:40,heightPx:20},90,{x:0,y:20,width:20,height:20});expect(result.widthPx).toBe(20);expect(result.heightPx).toBe(20);const output=new Image();output.src=result.imageUrl;await output.decode();const target=createCanvas(20,20);target.getContext('2d').drawImage(output,0,0);expect([...target.getContext('2d').getImageData(10,10,1,1).data]).toEqual([0,0,255,255]);}finally{vi.unstubAllGlobals();}
});
it('rejects out-of-bounds numeric crop before decoding',async()=>{
 const {transformPlan}=await import('./planTransform');
 await expect(transformPlan({imageUrl:'unused',widthPx:100,heightPx:100},0,{x:90,y:0,width:20,height:20})).rejects.toThrow('이미지 안');
 await expect(transformPlan({imageUrl:'unused',widthPx:100,heightPx:100},0,{x:0,y:0,width:-20,height:20})).rejects.toThrow();
});
