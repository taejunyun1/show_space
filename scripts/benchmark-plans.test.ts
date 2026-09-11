import {wallAnnotationScale} from '../src/domain/wallAnnotationScale';
import {classifyAutomaticWalls} from '../src/domain/automaticWallTopology';
import {scorePlanSegments} from './scorePlanSegments';
import {resolvePlanOpenings} from '../src/domain/planOpenings';
import {detectFramedWindows} from '../src/domain/framedWindows';
import {detectStairRegions,stableStairRegions} from '../src/domain/stairRegions';
import {createHash} from 'node:crypto';
import {readPlanNumbers} from '../src/domain/planNumbers';
import {mergeOrientedPlanLabels,unrotateTextBox} from '../src/domain/orientedNumbers';
import {pageUnit} from '../src/domain/planUnits';
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
import {buildAutomaticVenue,extractStructuralWalls} from '../src/domain/automaticVenue';
import type {PlanPage} from '../src/lib/planImport';

test.skipIf(!process.env.PLAN_CORPUS_DIR)('reports local real-PDF recognition without claiming ground-truth accuracy',async()=>{
 const directory=process.env.PLAN_CORPUS_DIR!,report=[];
 const truth=JSON.parse(await readFile(resolve('docs/validation/espacio-selected-numbers.json'),'utf8'));
 const structureTruth=JSON.parse(await readFile(resolve('docs/validation/espacio-selected-structure.json'),'utf8'));
 let ocr:Awaited<ReturnType<typeof createWorker>>|undefined,numbersOcr:Awaited<ReturnType<typeof createWorker>>|undefined;
 try{
 for(const file of (await readdir(directory)).filter(f=>f.endsWith('.pdf')).sort()){
  const bytes=await readFile(resolve(directory,file)),sha256=createHash('sha256').update(bytes).digest('hex');
  const loading=getDocument({data:new Uint8Array(bytes),useSystemFonts:true,standardFontDataUrl:resolve('public/pdfjs/standard_fonts')+'/',wasmUrl:resolve('public/pdfjs/wasm')+'/'});const pdf=await loading.promise;
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
   const baselineLabels=structuredClone(labels);
   if(source==='ocr'){
    if(!numbersOcr){numbersOcr=await createWorker('eng',OEM.LSTM_ONLY,{langPath:resolve('public/ocr/lang'),cacheMethod:'none'});await numbersOcr.setParameters({tessedit_pageseg_mode:PSM.SPARSE_TEXT,preserve_interword_spaces:'1',user_defined_dpi:'150'});}
    for(const rotation of [90,180,270] as const){
     const scale=1.5,rotated=createCanvas(Math.round((rotation%180?canvas.height:canvas.width)*scale),Math.round((rotation%180?canvas.width:canvas.height)*scale)),ctx=rotated.getContext('2d');
     ctx.fillStyle='white';ctx.fillRect(0,0,rotated.width,rotated.height);
     if(rotation===90)ctx.translate(rotated.width,0);if(rotation===180)ctx.translate(rotated.width,rotated.height);if(rotation===270)ctx.translate(0,rotated.height);ctx.rotate(rotation*Math.PI/180);ctx.drawImage(canvas,0,0,canvas.width*scale,canvas.height*scale);
     const result=await numbersOcr.recognize(rotated.toBuffer('image/png'),{},{text:true,blocks:true});
     const extra=detectPlanLabels((result.data.blocks??[]).flatMap(b=>b.paragraphs.flatMap(p=>p.lines)).map(l=>({text:l.text,confidence:l.confidence,source:'ocr' as const,box:unrotateTextBox({x:l.bbox.x0/scale,y:l.bbox.y0/scale,width:(l.bbox.x1-l.bbox.x0)/scale,height:(l.bbox.y1-l.bbox.y0)/scale},canvas.width,canvas.height,rotation)}))).map(l=>({...l,id:`rotation-${rotation}-${l.id}`}));
     labels=mergeOrientedPlanLabels(labels,extra);
    }
   }
   const small=createCanvas(Math.round(canvas.width*1400/Math.max(canvas.width,canvas.height)),Math.round(canvas.height*1400/Math.max(canvas.width,canvas.height)));small.getContext('2d').drawImage(canvas,0,0,small.width,small.height);
   const pixels=small.getContext('2d').getImageData(0,0,small.width,small.height).data;
   const runs=[125,155,190].map(threshold=>{
    const lines=detectWallCandidates(pixels,small.width,small.height,{threshold,maxCandidates:500,minLengthPx:Math.max(10,Math.round(1400*.008)),minThicknessPx:1}).map(l=>({...l,start:{x:l.start.x*canvas.width/small.width,y:l.start.y*canvas.height/small.height},end:{x:l.end.x*canvas.width/small.width,y:l.end.y*canvas.height/small.height},thicknessPx:l.thicknessPx*Math.max(canvas.width/small.width,canvas.height/small.height),...(l.solidSupportThicknessPx===undefined?{}:{solidSupportThicknessPx:l.solidSupportThicknessPx*Math.max(canvas.width/small.width,canvas.height/small.height)})}));
    const input:PlanPage={imageUrl:'data:image/png;base64,AA==',widthPx:canvas.width,heightPx:canvas.height,labels,textSource:source,analysis:{lines,issues:[],numericCount:labels.filter(l=>l.kind==='dimension').length,textState:'complete',lineState:'complete'}};
    const structural=extractStructuralWalls(input);
    const structureScore=sha256===structureTruth.sha256&&file===structureTruth.file&&number===structureTruth.page&&canvas.width===structureTruth.widthPx&&canvas.height===structureTruth.heightPx?{scope:structureTruth.scope,tolerancePx:structureTruth.tolerancePx,raw:scorePlanSegments(structureTruth.segments,lines,structureTruth.tolerancePx),selected:scorePlanSegments(structureTruth.segments,structural.map(w=>({start:{x:w.start.x,y:w.start.z},end:{x:w.end.x,y:w.end.z}})),structureTruth.tolerancePx)}:undefined;
    const resolved=resolvePlanOpenings(structural,labels,Math.max(canvas.width,canvas.height)*.2,detectStairRegions(labels,lines));
    const topologyResolved=!!classifyAutomaticWalls([...resolved.structure,...resolved.gaps.map(g=>g.wall)]);
    const draft=buildAutomaticVenue(input);return {annotationScale:wallAnnotationScale(structural,labels),topologyResolved,structureScore,openingCandidates:resolvePlanOpenings(structural,labels,Math.max(canvas.width,canvas.height)*.2,detectStairRegions(labels,lines)).gaps,framedWindows:detectFramedWindows(structural,labels,Math.max(canvas.width,canvas.height)*.2),stairRegions:detectStairRegions(labels,lines),structural,threshold,lineCount:lines.length,wallCandidates:draft.wallCount,draftGenerated:!!draft.project,reasons:draft.reasons};
   });
   const score=(items:typeof labels)=>truth.regions.map((region:{value:number;box:{x:number;y:number;width:number;height:number}})=>({value:region.value,matched:items.some(l=>{const n=readPlanNumbers(l.text),x=l.box.x+l.box.width/2,y=l.box.y+l.box.height/2,b=region.box;return !l.numericConflict&&(l.confidence??0)>=90&&n.length===1&&n[0].values.length===1&&n[0].values[0]===region.value&&x>=b.x&&x<=b.x+b.width&&y>=b.y&&y<=b.y+b.height;})}));
   const selectedTruth=sha256===truth.sha256&&file===truth.file&&number===truth.page&&canvas.width===truth.widthPx&&canvas.height===truth.heightPx?{scope:truth.scope,baseline:score(baselineLabels),enhanced:score(labels)}:undefined;
   report.push({stableStairRegions:stableStairRegions(runs.map(r=>r.stairRegions),1),file,sha256,page:number,selectedTruth,source,declaredUnit:pageUnit(labels),baselineNumbers:baselineLabels.filter(l=>l.kind==='dimension').length,conflicts:labels.filter(l=>l.numericConflict).length,facilityEvidence:labels.filter(l=>!['dimension','unit'].includes(l.kind)).map(l=>({kind:l.kind,text:l.text,box:l.box,confidence:l.confidence})),numberEvidence:labels.filter(l=>l.kind==='dimension').map(l=>({text:l.text,box:l.box,confidence:l.confidence,conflict:l.numericConflict??false})),textItems:text.items.length,numericLabels:labels.filter(l=>l.kind==='dimension').length,sampleNumbers:labels.filter(l=>l.kind==='dimension').slice(0,8).map(l=>l.text),runs,elapsedMs:Date.now()-started});
   await writeFile(resolve(directory,`${file}-${number}.png`),canvas.toBuffer('image/png'));page.cleanup();
  }}finally{await loading.destroy();}
 }
 }finally{await ocr?.terminate();await numbersOcr?.terminate();}
 await writeFile(resolve(directory,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
},180000);
