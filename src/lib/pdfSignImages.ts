import type {PDFPageProxy} from 'pdfjs-dist';
import {pdfImagePlacements,imagePlacementBox,type Matrix6} from '../domain/pdfImagePlacements';
import {pageRasterProfile} from '../domain/pageRasterProfile';
interface PdfRasterImage {width:number;height:number;kind?:number;data?:Uint8Array;bitmap?:ImageBitmap}
export interface PdfSignImage {imageUrl:string;box:{x:number;y:number;width:number;height:number};widthPx:number;heightPx:number}
/** Recover native raster detail only for small colored signs visibly matching
 * the rendered page. Transform tracing alone does not establish visibility. */
export async function pdfSignImages(page:PDFPageProxy,viewport:Matrix6,rendered:HTMLCanvasElement,codes:Record<string,number>):Promise<PdfSignImage[]>{
 const ops=await page.getOperatorList(),placements=pdfImagePlacements(ops,codes,viewport),result:PdfSignImage[]=[];
 const visible=rendered.getContext('2d')!.getImageData(0,0,rendered.width,rendered.height).data;
 for(const {id,matrix:m} of placements){
  const box=imagePlacementBox(m);
  if(box.width<12||box.height<12||Math.max(box.width,box.height)>Math.max(rendered.width,rendered.height)*.15||box.x<0||box.y<0||box.x+box.width>rendered.width||box.y+box.height>rendered.height)continue;
  const objects=id.startsWith('g_')?page.commonObjs:page.objs;
  const raw=await new Promise<PdfRasterImage|undefined>(resolve=>{let timer:ReturnType<typeof setTimeout>;timer=setTimeout(()=>resolve(undefined),2000);objects.get(id,(value:PdfRasterImage)=>{clearTimeout(timer);resolve(value);});});
  if(!raw||raw.width<20||raw.height<20||raw.width>2048||raw.height>2048)continue;
  const source=document.createElement('canvas'),asset=document.createElement('canvas');
  try{
   source.width=raw.width;source.height=raw.height;const src=source.getContext('2d')!;
   if(raw.bitmap)src.drawImage(raw.bitmap,0,0);
   else if(raw.data&&(raw.kind===2||raw.kind===3)){
    const pixels=src.createImageData(raw.width,raw.height),channels=raw.kind===2?3:4;
    if(raw.data.length!==raw.width*raw.height*channels)continue;
    for(let i=0;i<raw.width*raw.height;i++){pixels.data.set(raw.data.subarray(i*channels,i*channels+3),i*4);pixels.data[i*4+3]=channels===4?raw.data[i*4+3]:255;}src.putImageData(pixels,0,0);
   }else continue;
   const scale=Math.min(2048/Math.max(box.width,box.height),Math.max(raw.width,raw.height)/Math.max(box.width,box.height));
   asset.width=Math.max(1,Math.round(box.width*scale));asset.height=Math.max(1,Math.round(box.height*scale));
   const ctx=asset.getContext('2d')!,sx=asset.width/box.width,sy=asset.height/box.height;
   ctx.fillStyle='white';ctx.fillRect(0,0,asset.width,asset.height);
   ctx.setTransform(m[0]/raw.width*sx,m[1]/raw.width*sy,-m[2]/raw.height*sx,-m[3]/raw.height*sy,(m[4]+m[2]-box.x)*sx,(m[5]+m[3]-box.y)*sy);ctx.drawImage(source,0,0);
   const pixels=ctx.getImageData(0,0,asset.width,asset.height).data;
   if(pageRasterProfile(pixels).coloredFraction<.2)continue;
   let agreed=0,total=0;
   for(let y=1;y<12;y++)for(let x=1;x<12;x++){
    const u=x/12,v=y/12,a=(Math.floor(v*asset.height)*asset.width+Math.floor(u*asset.width))*4,b=(Math.floor(box.y+v*box.height)*rendered.width+Math.floor(box.x+u*box.width))*4;
    if((Math.abs(pixels[a]-visible[b])+Math.abs(pixels[a+1]-visible[b+1])+Math.abs(pixels[a+2]-visible[b+2]))/3<70)agreed++;total++;
   }
   if(agreed/total<.9)continue;
   result.push({imageUrl:asset.toDataURL('image/png'),box,widthPx:asset.width,heightPx:asset.height});
   if(result.length===30)break;
  }finally{source.width=source.height=asset.width=asset.height=0;}
 }
 return result;
}
