import fs from 'node:fs/promises';
import {createCanvas,DOMMatrix,ImageData,Path2D} from '@napi-rs/canvas';
Object.assign(globalThis,{DOMMatrix,ImageData,Path2D});
const {getDocument,OPS}=await import('pdfjs-dist/legacy/build/pdf.mjs');
const root=process.argv[2]??'/tmp/gonggan-real-plans';
const results=[];
for(const name of ['japan-foundation','nelson','jica-scan']){
 const data=new Uint8Array(await fs.readFile(`${root}/${name}.pdf`));
 const bytes=data.length;const task=getDocument({data,useSystemFonts:true,wasmUrl:`${process.cwd()}/node_modules/pdfjs-dist/wasm/`,cMapUrl:`${process.cwd()}/node_modules/pdfjs-dist/cmaps/`,standardFontDataUrl:`${process.cwd()}/node_modules/pdfjs-dist/standard_fonts/`,stopAtErrors:true});const doc=await task.promise;
 const pages=[];
 for(let i=1;i<=doc.numPages;i++){
  const page=await doc.getPage(i),text=await page.getTextContent(),ops=await page.getOperatorList();
  const v=page.getViewport({scale:1});const scale=2400/Math.max(v.width,v.height);
  pages.push({page:i,width:v.width,height:v.height,textItems:text.items.filter(t=>t.str?.trim()).length,smallTextItems:text.items.filter(t=>t.str?.trim()&&t.height*scale<9).length,rasterOperations:ops.fnArray.filter(f=>[OPS.paintImageXObject,OPS.paintInlineImageXObject,OPS.paintImageMaskXObject].includes(f)).length});
  if(i<=2||name==='japan-foundation'&&i===6||name==='jica-scan'&&i===doc.numPages){const vp=page.getViewport({scale});const canvas=createCanvas(Math.ceil(vp.width),Math.ceil(vp.height));await page.render({canvas,canvasContext:canvas.getContext('2d'),viewport:vp}).promise;await fs.writeFile(`${root}/${name}-p${i}.png`,canvas.toBuffer('image/png'));}
  page.cleanup();
 }
 results.push({name,bytes,pages});await task.destroy();
}

console.log(JSON.stringify(results,null,2));
