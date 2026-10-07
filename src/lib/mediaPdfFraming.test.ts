import {expect,it,vi} from 'vitest';
import {readFile,writeFile} from 'node:fs/promises';
import {createCanvas,type Canvas} from '@napi-rs/canvas';
import {createDemoProject} from '../domain/model';
import {appendSceneSnapshot} from '../domain/sceneSnapshot';
import {pdfSections,type PdfOptions} from './pdfLayout';
import {buildExhibitionPdf} from './pdfDocument';
import {framedVideoPoster,pdfArtworkImageKey} from './videoPoster';

it('renders actual PDF pages with different fitted posters for the same video in current and saved Scene layouts',async()=>{
 const source=createCanvas(640,360),ctx=source.getContext('2d');ctx.fillStyle='#ff0000';ctx.fillRect(0,0,140,360);ctx.fillStyle='#00ff00';ctx.fillRect(140,0,360,360);ctx.fillStyle='#0000ff';ctx.fillRect(500,0,140,360);
 const p=createDemoProject();p.artworks=[{...p.artworks[0],widthMm:1200,heightMm:1200,frame:'none',imageUrl:source.toDataURL('image/png'),video:{dataUrl:'data:video/mp4;base64,AAAAAGZ0eXBpc29t',widthPx:640,heightPx:360,durationSeconds:1,loop:true,fit:'contain'},note:'PRIVATE_NOTE'}];
 const cover=structuredClone(p);cover.artworks[0].video!.fit='cover';p.scenes=appendSceneSnapshot(p,cover,'가득 채운 Scene').scenes;
 const options:PdfOptions={current:true,sceneIds:[],threeD:false,plan:false,elevation:false,allWallFaces:false,includeSchedule:false,pages:[{id:'current',kind:'detail',artworkId:p.artworks[0].id},{id:'scene',kind:'detail',artworkId:p.artworks[0].id,sceneId:p.scenes[0].id}]},sections=pdfSections(p,options),images=new Map<string,Uint8Array>();
 vi.stubGlobal('document',{createElement:()=>createCanvas(1,1)});
 try{for(const section of sections){const a=section.artwork!,image=framedVideoPoster(source as unknown as CanvasImageSource,a.widthMm,a.heightMm,a.video!) as unknown as Canvas;images.set(pdfArtworkImageKey(a),new Uint8Array(image.toBuffer('image/png')));}}
 finally{vi.unstubAllGlobals();}
 expect(images.size).toBe(2);
 const bytes=await buildExhibitionPdf(sections,options,{fontBytes:new Uint8Array(await readFile('public/fonts/NotoSansKR-Regular.ttf')),images,previews:new Map()}),{getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs'),task=getDocument({data:bytes.slice(),useSystemFonts:false}),pdf=await task.promise;
 if(process.env.GONGGAN_MEDIA_PDF_PROOF==='1')await writeFile('/tmp/gonggan-video-fitted-poster-20261007.pdf',bytes);
 try{
  expect(pdf.numPages).toBe(2);
  for(let index=1;index<=2;index++){const page=await pdf.getPage(index),viewport=page.getViewport({scale:1}),canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));await page.render({canvas:canvas as unknown as HTMLCanvasElement,viewport}).promise;
   const pixel=(x:number,y:number)=>[...canvas.getContext('2d').getImageData(x,y,1,1).data];
   expect(pixel(284,333)).toEqual([0,255,0,255]);
   expect(pixel(284,175)).toEqual(index===1?[0,0,0,255]:[0,255,0,255]);
   expect(pixel(110,333)).toEqual(index===1?[255,0,0,255]:[0,255,0,255]);
   expect((await page.getTextContent()).items.filter(i=>'str' in i).map(i=>i.str).join(' ')).not.toContain('PRIVATE_NOTE');
   if(process.env.GONGGAN_MEDIA_PDF_PROOF==='1')await writeFile(`/tmp/gonggan-video-pdf-${index===1?'contain':'cover'}-20261007.png`,canvas.toBuffer('image/png'));
  }
 }finally{await task.destroy();}
 expect(p.artworks[0].video!.fit).toBe('contain');
},20000);
