import {expect,it,vi} from 'vitest';
import {createCanvas,type Canvas} from '@napi-rs/canvas';
import {Texture} from 'three';
import {framedVideoPoster} from './videoPoster';
import {framedProjectorTexture} from './projectorLighting';
import type {VideoArtwork} from '../domain/mediaArtwork';

/** Real Canvas pixels, using the PDF dependency's raster backend; no browser state or UI automation. */
it('bakes PDF video contain bars and cover crop with actual pixels, including downsampled poster coordinates',()=>{
 vi.stubGlobal('document',{createElement:()=>createCanvas(1,1)});
 try{
  const source=createCanvas(640,360),ctx=source.getContext('2d');ctx.fillStyle='#ff0000';ctx.fillRect(0,0,140,360);ctx.fillStyle='#00ff00';ctx.fillRect(140,0,360,360);ctx.fillStyle='#0000ff';ctx.fillRect(500,0,140,360);
  const video:VideoArtwork={dataUrl:'PRIVATE',widthPx:1280,heightPx:720,durationSeconds:1,loop:true,fit:'contain'};
  const contain=framedVideoPoster(source as unknown as CanvasImageSource,1200,1200,video) as unknown as Canvas,cover=framedVideoPoster(source as unknown as CanvasImageSource,1200,1200,{...video,fit:'cover'}) as unknown as Canvas;
  const pixel=(canvas:typeof source,x:number,y:number)=>[...canvas.getContext('2d').getImageData(x,y,1,1).data];
  expect([contain.width,contain.height]).toEqual([2048,2048]);expect(pixel(contain,1024,200)).toEqual([0,0,0,255]);expect(pixel(contain,32,1024)).toEqual([255,0,0,255]);expect(pixel(contain,1024,1024)).toEqual([0,255,0,255]);expect(pixel(contain,2000,1024)).toEqual([0,0,255,255]);
  expect(pixel(cover,32,32)).toEqual([0,255,0,255]);expect(pixel(cover,2016,2016)).toEqual([0,255,0,255]);expect(pixel(source,32,32)).toEqual([255,0,0,255]);
 }finally{vi.unstubAllGlobals();}
});

it('creates independent bounded projector maps that preserve portrait pixels or crop vertically without altering the pooled source',()=>{
 vi.stubGlobal('document',{createElement:()=>createCanvas(1,1)});
 try{
  const source=createCanvas(360,640),ctx=source.getContext('2d');ctx.fillStyle='#ff0000';ctx.fillRect(0,0,360,210);ctx.fillStyle='#00ff00';ctx.fillRect(0,210,360,220);ctx.fillStyle='#0000ff';ctx.fillRect(0,430,360,210);
  const texture=new Texture(source as unknown as HTMLCanvasElement),settings={throwRatio:1.5,aspectRatio:16/9,brightnessLumens:1500,fit:'contain' as const};
  const contain=framedProjectorTexture(texture,settings),cover=framedProjectorTexture(texture,{...settings,fit:'cover'}),pixel=(map:Texture,x:number,y:number)=>[...(map.image as typeof source).getContext('2d').getImageData(x,y,1,1).data];
  expect([contain.image.width,contain.image.height]).toEqual([1024,576]);expect(pixel(contain,20,288)).toEqual([0,0,0,255]);expect(pixel(contain,512,20)).toEqual([255,0,0,255]);expect(pixel(contain,512,288)).toEqual([0,255,0,255]);expect(pixel(contain,512,550)).toEqual([0,0,255,255]);
  expect(pixel(cover,20,20)).toEqual([0,255,0,255]);expect(pixel(cover,1000,550)).toEqual([0,255,0,255]);expect(texture.repeat.toArray()).toEqual([1,1]);expect(texture.offset.toArray()).toEqual([0,0]);expect(texture.image).toBe(source);expect(contain).not.toBe(cover);
  contain.dispose();cover.dispose();texture.dispose();
 }finally{vi.unstubAllGlobals();}
});
