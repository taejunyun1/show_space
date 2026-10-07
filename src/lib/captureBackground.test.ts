import {expect,it,vi} from 'vitest';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {Color,Scene,Texture,SpotLight} from 'three';
import {beginCaptureBackground,captureBackgroundColor,capturePlanGridFill,paintCaptureBackground} from './captureBackground';
import {captureFit} from './captureSvg';

function renderer(){let color=new Color('#334455'),alpha=.35;return {getClearColor:(target:Color)=>target.copy(color),getClearAlpha:()=>alpha,setClearColor:(value:Color|string,a=1)=>{color=new Color(value);alpha=a;}};}
it('restores real Scene background/environment references and renderer clear state for all option combinations',()=>{
 for(const background of [new Color('#345678'),new Texture()])for(const transparentBackground of [false,true])for(const includeEnvironment of [false,true]){
  const scene=new Scene(),environment=new Texture(),light=new SpotLight();scene.background=background;scene.environment=environment;scene.environmentIntensity=.7;scene.add(light);const gl=renderer(),clearColor=gl.getClearColor(new Color()).getHex(),alpha=gl.getClearAlpha(),capture=beginCaptureBackground(scene,gl,{transparentBackground,includeEnvironment});
  expect(scene.background).toBe(transparentBackground||!includeEnvironment?null:background);expect(scene.environment).toBe(includeEnvironment?environment:null);expect(scene.environmentIntensity).toBe(.7);expect(scene.children).toEqual([light]);expect(gl.getClearAlpha()).toBe(transparentBackground?0:1);expect(capture.color).toBe(transparentBackground?null:includeEnvironment?background instanceof Color?'#345678':'#e9edf1':'#ffffff');
  try{throw new Error('PNG encoding failed');}catch{/* Same finally path as a failed capture. */}finally{capture.restore();capture.restore();}
  expect(scene.background).toBe(background);expect(scene.environment).toBe(environment);expect(gl.getClearColor(new Color()).getHex()).toBe(clearColor);expect(gl.getClearAlpha()).toBe(alpha);expect(environment.version).toBe(0);
 }
});
it('restores the scene even when renderer setup fails before capture can return a cleanup handler',()=>{
 const scene=new Scene(),background=new Color('#557799'),environment=new Texture();scene.background=background;scene.environment=environment;const gl=renderer(),original=gl.setClearColor;gl.setClearColor=vi.fn().mockImplementationOnce(()=>{throw new Error('lost context');}).mockImplementation(original);
 expect(()=>beginCaptureBackground(scene,gl,{transparentBackground:true,includeEnvironment:false})).toThrow('lost context');expect(scene.background).toBe(background);expect(scene.environment).toBe(environment);expect(gl.getClearAlpha()).toBe(.35);
});
it('retains alpha through a real PNG encode/decode including letterbox padding and semitransparent source pixels',async()=>{
 const source=createCanvas(100,100),s=source.getContext('2d');s.fillStyle='#ff0000';s.fillRect(20,20,20,20);s.fillStyle='rgba(0,0,255,0.5)';s.fillRect(60,60,20,20);
 for(const transparentBackground of [false,true]){
  const canvas=createCanvas(200,100),ctx=canvas.getContext('2d'),color=captureBackgroundColor({transparentBackground,includeEnvironment:false}),fit=captureFit({width:100,height:100},{width:200,height:100});ctx.fillStyle='green';ctx.fillRect(0,0,200,100);
  paintCaptureBackground(ctx as unknown as CanvasRenderingContext2D,200,100,color);ctx.drawImage(source,fit.x,fit.y,fit.width,fit.height);
  const png=canvas.toBuffer('image/png'),image=await loadImage(png),decoded=createCanvas(200,100),output=decoded.getContext('2d');output.drawImage(image,0,0);const pixel=(x:number,y:number)=>[...output.getImageData(x,y,1,1).data];
  expect([image.width,image.height]).toEqual([200,100]);expect(pixel(5,5)).toEqual(transparentBackground?[0,0,0,0]:[255,255,255,255]);expect(pixel(55,5)[3]).toBe(transparentBackground?0:255);expect(pixel(75,25)).toEqual([255,0,0,255]);expect(pixel(115,65)[3]).toBe(transparentBackground?127:255);
 }
});
it('keeps SVG grid pixels transparent when requested and preserves an opaque legacy default',async()=>{
 for(const includeGrid of [false,true])for(const transparentBackground of [false,true]){
  const fill=capturePlanGridFill({includeGrid,transparentBackground}),svg=`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><defs><pattern id="plan-grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M 50 0 L 0 0 0 50" fill="none" stroke="#123456" stroke-width="2"/></pattern></defs><rect width="100" height="100" fill="${fill}"/></svg>`,image=await loadImage(Buffer.from(svg)),canvas=createCanvas(100,100),ctx=canvas.getContext('2d');paintCaptureBackground(ctx as unknown as CanvasRenderingContext2D,100,100,transparentBackground?null:'#ffffff');ctx.drawImage(image,0,0);
  expect(ctx.getImageData(25,25,1,1).data[3]).toBe(transparentBackground?0:255);if(includeGrid)expect(ctx.getImageData(0,25,1,1).data[3]).toBe(255);
 }
 expect(capturePlanGridFill({includeGrid:false})).toBe('#ffffff');expect(captureBackgroundColor({})).toBe('#e9edf1');
});
