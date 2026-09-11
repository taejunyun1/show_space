import {pageRasterProfile} from '../src/domain/pageRasterProfile';
import {test} from 'vitest';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createCanvas} from '@napi-rs/canvas';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {detectWallCandidates} from '../src/domain/wallCandidates';
import {scorePlanPageEvidence} from '../src/lib/selectPlanPage';
import {detectPlanLabels} from '../src/domain/planLabels';
import {assessPdfText} from '../src/lib/pdfTextQuality';
import {pdfPlanTexts} from '../src/lib/pdfPlanTexts';
/** Real-file preview ordering only. No OCR, semantic page truth or venue claim. */
test.skipIf(!process.env.PLAN_CORPUS_DIR)('reports all-page preview ranking for the real corpus',async()=>{
 const root=process.env.PLAN_CORPUS_DIR!,report=[];
 const entries=JSON.parse(await readFile('docs/validation/plan-corpus.json','utf8')) as {file:string;sha256:string}[];
 for(const entry of entries){
  const bytes=await readFile(resolve(root,entry.file));if(createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw new Error('Corpus source changed');
  const loading=getDocument({data:new Uint8Array(bytes),useSystemFonts:true,standardFontDataUrl:resolve('public/pdfjs/standard_fonts')+'/',wasmUrl:resolve('public/pdfjs/wasm')+'/'}),pdf=await loading.promise,started=Date.now(),pages=[];
  try{for(let number=1;number<=pdf.numPages;number++){
   const page=await pdf.getPage(number),original=page.getViewport({scale:1}),viewport=page.getViewport({scale:900/Math.max(original.width,original.height)}),canvas=createCanvas(Math.floor(viewport.width),Math.floor(viewport.height));
   try{
    await page.render({canvas:canvas as never,canvasContext:canvas.getContext('2d') as never,viewport,background:'#ffffff'}).promise;
    if(entry.file==='coningsby.pdf'&&[1,4,7].includes(number))await writeFile(resolve(root,`preview-${number}.png`),canvas.toBuffer('image/png'));
    const text=await page.getTextContent(),labels=assessPdfText(text.items).usable?detectPlanLabels(pdfPlanTexts(text.items,viewport.transform,canvas.width,canvas.height)):[];
    const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data,rasterProfile=pageRasterProfile(data);
    const lines=detectWallCandidates(data,canvas.width,canvas.height,{threshold:155,minLengthPx:Math.max(10,Math.round(Math.max(canvas.width,canvas.height)*.02)),minThicknessPx:1,maxCandidates:150});
    pages.push({pageNumber:number,rasterProfile,score:scorePlanPageEvidence({imageUrl:'',labels,diagnostics:{warnings:[],rasterProfile},widthPx:canvas.width,heightPx:canvas.height,analysis:{lines,issues:[],numericCount:labels.filter(l=>l.kind==='dimension').length,textState:'complete',lineState:'complete'}})});
   }finally{page.cleanup();}
  }}finally{await loading.destroy();}
  report.push({file:entry.file,sha256:entry.sha256,pageCount:pages.length,elapsedMs:Date.now()-started,ranking:pages.sort((a,b)=>b.score-a.score||a.pageNumber-b.pageNumber)});
 }
 await writeFile(resolve(root,'page-preview-report.json'),JSON.stringify(report,null,2));
},120000);
