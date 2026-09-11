import fs from 'node:fs/promises';
import {createCanvas,DOMMatrix,ImageData,Path2D} from '@napi-rs/canvas';
Object.assign(globalThis,{DOMMatrix,ImageData,Path2D});
const {getDocument,OPS}=await import('pdfjs-dist/legacy/build/pdf.mjs');
const root=process.argv[2]??'/tmp/gonggan-real-plans';
const task=getDocument({data:new Uint8Array(await fs.readFile(`${root}/jica-scan.pdf`)),wasmUrl:`${process.cwd()}/node_modules/pdfjs-dist/wasm/`});const doc=await task.promise;
const sheet=createCanvas(1200,Math.ceil(doc.numPages/6)*290),ctx=sheet.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,sheet.width,sheet.height);
for(let i=1;i<=doc.numPages;i++){const p=await doc.getPage(i),v=p.getViewport({scale:1});const vp=p.getViewport({scale:250/Math.max(v.width,v.height)}),c=createCanvas(Math.ceil(vp.width),Math.ceil(vp.height));await p.render({canvas:c,canvasContext:c.getContext('2d'),viewport:vp}).promise;const x=(i-1)%6*200,y=Math.floor((i-1)/6)*290;ctx.drawImage(c,x,y+20);ctx.fillStyle='black';ctx.font='16px sans-serif';ctx.fillText(String(i),x+5,y+16);p.cleanup();}
await fs.writeFile(`${root}/scan-contact.png`,sheet.toBuffer('image/png'));await task.destroy();
