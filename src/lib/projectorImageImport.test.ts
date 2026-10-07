import {afterEach,expect,it,vi} from 'vitest';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {readProjectorImage} from './projectorImageImport';
import {projectorTestFixture} from './projectorTestFixture';
import {exportProjectPackage,importProjectPackage} from './projectPackage';
import {prepareSharePresentation} from './sharePresentation';

afterEach(()=>vi.unstubAllGlobals());
function decoder(){
 const closed=vi.fn();
 vi.stubGlobal('createImageBitmap',async(file:Blob)=>{
  const image=await loadImage(Buffer.from(await file.arrayBuffer()));
  return {width:image.width,height:image.height,close:closed};
 });
 return closed;
}
it('keeps uploaded portrait PNG bytes exactly through the projector, ZIP and selected Scene sharing',async()=>{
 const canvas=createCanvas(360,640),ctx=canvas.getContext('2d');ctx.fillStyle='#e52a17';ctx.fillRect(0,0,360,320);ctx.fillStyle='#1734e5';ctx.fillRect(0,320,360,320);
 const bytes=canvas.toBuffer('image/png'),file=new File([new Uint8Array(bytes)],'portrait.png',{type:'image/png'}),closed=decoder();
 const result=await readProjectorImage(file),expected=`data:image/png;base64,${bytes.toString('base64')}`;
 expect(result).toEqual({imageUrl:expected,optimized:false});expect(closed).toHaveBeenCalledOnce();
 const p=projectorTestFixture();p.lights![0].projection!.imageUrl=result.imageUrl;p.scenes[0].structure!.lights![0].projection!.imageUrl=result.imageUrl;
 const zip=await exportProjectPackage(p,async()=>{throw new Error('Unexpected external image');}),restored=await importProjectPackage(await zip.arrayBuffer());expect(restored.lights![0].projection!.imageUrl).toBe(expected);
 const share=await prepareSharePresentation(restored,{includeDimensions:false,sceneIds:[p.scenes[0].id]});expect(share.uploads).toHaveLength(1);expect(share.uploads[0].sourceUrl).toBe(expected);
});
it('rejects mislabeled, truncated and oversized files before decoding them',async()=>{
 const decode=vi.fn();vi.stubGlobal('createImageBitmap',decode);
 for(const file of [new File(['not an image'],'broken.jpg',{type:'image/jpeg'}),new File([Uint8Array.of(137,80,78,71)],'truncated.png',{type:'image/png'}),new File([new Uint8Array(20*1024*1024+1)],'huge.png',{type:'image/png'}),new File(['svg'],'drawing.svg',{type:'image/svg+xml'})])await expect(readProjectorImage(file)).rejects.toThrow();
 expect(decode).not.toHaveBeenCalled();
});
it('preserves actual JPG and WebP sources without re-encoding them',async()=>{
 const canvas=createCanvas(40,24),ctx=canvas.getContext('2d');ctx.fillStyle='#fa154b';ctx.fillRect(0,0,40,24);decoder();
 for(const type of ['image/jpeg','image/webp'] as const){const bytes=canvas.toBuffer(type),result=await readProjectorImage(new File([new Uint8Array(bytes)],'image',{type}));expect(result).toEqual({imageUrl:`data:${type};base64,${bytes.toString('base64')}`,optimized:false});}
});
it('cancels a pending decode and closes its bitmap before any image can be applied to another selection',async()=>{
 const file=new File([new Uint8Array(createCanvas(2,2).toBuffer('image/png'))],'image.png',{type:'image/png'}),controller=new AbortController(),close=vi.fn();
 let finish:((value:{width:number;height:number;close:()=>void})=>void)|undefined;
 vi.stubGlobal('createImageBitmap',()=>new Promise(resolve=>{finish=resolve;}));
 const pending=readProjectorImage(file,controller.signal),rejected=expect(pending).rejects.toMatchObject({name:'AbortError'});
 await vi.waitFor(()=>expect(finish).toBeDefined());controller.abort();finish!({width:2,height:2,close});await rejected;expect(close).toHaveBeenCalledOnce();
 const decode=vi.fn();vi.stubGlobal('createImageBitmap',decode);await expect(readProjectorImage(file,controller.signal)).rejects.toMatchObject({name:'AbortError'});expect(decode).not.toHaveBeenCalled();
});
it('rejects undecodable and excessive dimensions without leaving decoded bitmap resources alive',async()=>{
 const bytes=createCanvas(1,1).toBuffer('image/png'),file=new File([new Uint8Array(bytes)],'image.png',{type:'image/png'});
 decoder();const broken=new Uint8Array(bytes);broken.fill(0,33);await expect(readProjectorImage(new File([broken],'broken.png',{type:'image/png'}))).rejects.toThrow(/읽지 못/);
 for(const size of [[0,1],[10000,10000]]){const close=vi.fn();vi.stubGlobal('createImageBitmap',async()=>({width:size[0],height:size[1],close}));await expect(readProjectorImage(file)).rejects.toThrow(/픽셀/);expect(close).toHaveBeenCalledOnce();}
});
it('optimizes sources above the actual 5,000,000-byte public share limit while accepting the 20MiB input budget',async()=>{
 const canvas=createCanvas(32,16),ctx=canvas.getContext('2d');ctx.fillStyle='#ed2312';ctx.fillRect(0,0,32,16);
 const original=canvas.toBuffer('image/png'),bytes=new Uint8Array(5_000_001);bytes.set(original);
 const close=vi.fn();vi.stubGlobal('createImageBitmap',async()=>Object.assign(canvas,{close}));
 vi.stubGlobal('document',{createElement:()=>createCanvas(1,1)});
 const result=await readProjectorImage(new File([bytes],'large.png',{type:'image/png'}));expect(result.optimized).toBe(true);expect(result.imageUrl).toMatch(/^data:image\/webp;base64,/);expect(result.imageUrl.length).toBeLessThan(7_000_000);expect(close).toHaveBeenCalledOnce();
 const image=await loadImage(result.imageUrl);expect([image.width,image.height]).toEqual([32,16]);
});
