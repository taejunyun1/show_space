/** Opt-in local corpus runner: PLAN_CORPUS_DIR=/tmp/... npx vitest run scripts/benchmark-plans.test.ts */
import {test} from 'vitest';
import {readdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createCanvas} from '@napi-rs/canvas';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createWorker,OEM,PSM} from 'tesseract.js';
import {pdfPlanTexts} from '../src/lib/pdfPlanTexts';
import {detectPlanLabels} from '../src/domain/planLabels';
import {detectWallCandidates} from '../src/domain/wallCandidates';
import {buildAutomaticVenue} from '../src/domain/automaticVenue';
import type {PlanPage} from '../src/lib/planImport';

test.skipIf(!process.env.PLAN_CORPUS_DIR)('reports local real-PDF recognition without claiming ground-truth accuracy',async()=>{
 const directory=process.env.PLAN_CORPUS_DIR!,report=[];
 let ocr:Awaited<ReturnType<typeof createWorker>>|undefined;
 try{
 for(const file of (await readdir(directory)).filter(f=>f.endsWith('.pdf')).sort()){
  const loading=getDocument({data:new Uint8Array(await readFile(resolve(directory,file))),useSystemFonts:true,standardFontDataUrl:resolve('public/pdfjs/standard_fonts')+'/',wasmUrl:resolve('public/pdfjs/wasm')+'/'});const pdf=await loading.promise;
  try{for(let number=1;number<=Math.min(pdf.numPages,4);number++){
   const started=Date.now(),page=await pdf.getPage(number),original=page.getViewport({scale:1}),viewport=page.getViewport({scale:2400/Math.max(original.width,original.height)});
   const canvas=createCanvas(Math.floor(viewport.width),Math.floor(viewport.height));
   await page.render({canvas:canvas as never,canvasContext:canvas.getContext('2d') as never,viewport,background:'#ffffff'}).promise;
   const text=await page.getTextContent();let labels=detectPlanLabels(pdfPlanTexts(text.items,viewport.transform,canvas.width,canvas.height));let source:'ocr'|'pdf-text'='pdf-text';
   if(!text.items.some(i=>'str' in i&&i.str.trim())){
    source='ocr';if(!ocr){ocr=await createWorker('eng+kor',OEM.LSTM_ONLY,{langPath:resolve('public/ocr/lang'),cacheMethod:'none'});await ocr.setParameters({tessedit_pageseg_mode:PSM.SPARSE_TEXT,preserve_interword_spaces:'1',user_defined_dpi:'150'});}
    const result=await ocr.recognize(canvas.toBuffer('image/png'),{},{blocks:true,text:true});
    labels=detectPlanLabels((result.data.blocks??[]).flatMap(b=>b.paragraphs.flatMap(p=>p.lines)).map(l=>({text:l.text,confidence:l.confidence,source:'ocr' as const,box:{x:l.bbox.x0,y:l.bbox.y0,width:l.bbox.x1-l.bbox.x0,height:l.bbox.y1-l.bbox.y0}})));
   }
   const small=createCanvas(Math.round(canvas.width*1400/Math.max(canvas.width,canvas.height)),Math.round(canvas.height*1400/Math.max(canvas.width,canvas.height)));small.getContext('2d').drawImage(canvas,0,0,small.width,small.height);
   const pixels=small.getContext('2d').getImageData(0,0,small.width,small.height).data;
   const runs=[125,155,190].map(threshold=>{
    const lines=detectWallCandidates(pixels,small.width,small.height,{threshold,minLengthPx:Math.max(10,Math.round(1400*.008)),minThicknessPx:1}).map(l=>({...l,start:{x:l.start.x*canvas.width/small.width,y:l.start.y*canvas.height/small.height},end:{x:l.end.x*canvas.width/small.width,y:l.end.y*canvas.height/small.height},thicknessPx:l.thicknessPx*Math.max(canvas.width/small.width,canvas.height/small.height)}));
    const input:PlanPage={imageUrl:'data:image/png;base64,AA==',widthPx:canvas.width,heightPx:canvas.height,labels,textSource:source,analysis:{lines,issues:[],numericCount:labels.filter(l=>l.kind==='dimension').length,textState:'complete',lineState:'complete'}};
    const draft=buildAutomaticVenue(input);return {threshold,lineCount:lines.length,wallCandidates:draft.wallCount,draftGenerated:!!draft.project,reasons:draft.reasons};
   });
   report.push({file,page:number,source,textItems:text.items.length,numericLabels:labels.filter(l=>l.kind==='dimension').length,sampleNumbers:labels.filter(l=>l.kind==='dimension').slice(0,8).map(l=>l.text),runs,elapsedMs:Date.now()-started});
   await writeFile(resolve(directory,`${file}-${number}.png`),canvas.toBuffer('image/png'));page.cleanup();
  }}finally{await loading.destroy();}
 }
 }finally{await ocr?.terminate();}
 await writeFile(resolve(directory,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
},180000);
