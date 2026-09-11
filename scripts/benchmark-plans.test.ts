import {pageTextPanels} from '../src/lib/textPanels';
import {venueDimensions} from '../src/domain/venueDimensions';
import {pdfSignImages} from '../src/lib/pdfSignImages';
import type {Matrix6} from '../src/domain/pdfImagePlacements';
import {mergePdfFacilityOcr} from '../src/domain/hybridPlanLabels';
import {detectUnlabelledStairCandidates} from '../src/domain/unlabelledStairs';
import {shapeLabelRegions} from '../src/domain/shapeLabelRegions';
import {splitWallJunctions,peelOpenBranches,exteriorWallEdges} from '../src/domain/planarWalls';
import {assessPdfText} from '../src/lib/pdfTextQuality';
import {prepareConstrainedVenue} from '../src/domain/constrainedVenue';
import {createDimensionMap} from '../src/domain/dimensionMap';
import {readCeilingHeight} from '../src/domain/ceilingHeight';
import {numericOcrRegions} from '../src/domain/ocrRegions';
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
import {test,vi} from 'vitest';
import {readdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createCanvas} from '@napi-rs/canvas';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createWorker,OEM,PSM} from 'tesseract.js';
import {pdfPlanTexts} from '../src/lib/pdfPlanTexts';
import {detectPlanLabels} from '../src/domain/planLabels';
import {detectWallCandidates} from '../src/domain/wallCandidates';
import {buildAutomaticVenue,extractStructuralWalls} from '../src/domain/automaticVenue';
import type {PlanPage} from '../src/lib/planImport';

test.skipIf(!process.env.PLAN_CORPUS_DIR)('reports local real-PDF recognition without claiming ground-truth accuracy',async()=>{
 vi.stubGlobal('document',{createElement:()=>createCanvas(1,1)});
 const directory=process.env.PLAN_CORPUS_DIR!,report=[];
 const corpus=JSON.parse(await readFile(resolve('docs/validation/plan-corpus.json'),'utf8')) as {file:string;sha256:string;pages:number[]}[];
 const truth=JSON.parse(await readFile(resolve('docs/validation/espacio-selected-numbers.json'),'utf8'));
 const annotationTruth=JSON.parse(await readFile(resolve('docs/validation/espacio-selected-annotations.json'),'utf8'));
 const facilityTruth=JSON.parse(await readFile(resolve('docs/validation/paragon-selected-facilities.json'),'utf8'));
 const structureTruth=JSON.parse(await readFile(resolve('docs/validation/espacio-selected-structure.json'),'utf8'));
 let ocr:Awaited<ReturnType<typeof createWorker>>|undefined,numbersOcr:Awaited<ReturnType<typeof createWorker>>|undefined;
 try{
 for(const file of (await readdir(directory)).filter(f=>f.endsWith('.pdf')).sort()){
  const bytes=await readFile(resolve(directory,file)),sha256=createHash('sha256').update(bytes).digest('hex');
  const entry=corpus.find(c=>c.file===file);
  if(entry&&entry.sha256!==sha256)throw new Error(`Corpus source changed: ${file}`);
  const loading=getDocument({data:new Uint8Array(bytes),useSystemFonts:true,standardFontDataUrl:resolve('public/pdfjs/standard_fonts')+'/',wasmUrl:resolve('public/pdfjs/wasm')+'/'});const pdf=await loading.promise;
  const selectedPages=entry?.pages??Array.from({length:Math.min(pdf.numPages,4)},(_,i)=>i+1);
  try{for(const number of selectedPages){
   const started=Date.now(),page=await pdf.getPage(number),original=page.getViewport({scale:1}),viewport=page.getViewport({scale:2400/Math.max(original.width,original.height)});
   const canvas=createCanvas(Math.floor(viewport.width),Math.floor(viewport.height));
   await page.render({canvas:canvas as never,canvasContext:canvas.getContext('2d') as never,viewport,background:'#ffffff'}).promise;
   const text=await page.getTextContent();const nativeTexts=pdfPlanTexts(text.items,viewport.transform,canvas.width,canvas.height);let labels=detectPlanLabels(nativeTexts);let source:'ocr'|'pdf-text'='pdf-text';
   if(!assessPdfText(text.items).usable){
    source='ocr';if(!ocr){ocr=await createWorker('eng+kor',OEM.LSTM_ONLY,{langPath:resolve('public/ocr/lang'),cacheMethod:'none'});await ocr.setParameters({tessedit_pageseg_mode:PSM.SPARSE_TEXT,preserve_interword_spaces:'1',user_defined_dpi:'150'});}
    const result=await ocr.recognize(canvas.toBuffer('image/png'),{},{blocks:true,text:true});
    labels=detectPlanLabels((result.data.blocks??[]).flatMap(b=>b.paragraphs.flatMap(p=>p.lines)).map(l=>({text:l.text,confidence:l.confidence,source:'ocr' as const,box:{x:l.bbox.x0,y:l.bbox.y0,width:l.bbox.x1-l.bbox.x0,height:l.bbox.y1-l.bbox.y0}})));
   }
   const baselineLabels=structuredClone(labels);
   if(source==='pdf-text'){
    if(!ocr){ocr=await createWorker('eng+kor',OEM.LSTM_ONLY,{langPath:resolve('public/ocr/lang'),cacheMethod:'none'});await ocr.setParameters({tessedit_pageseg_mode:PSM.SPARSE_TEXT,preserve_interword_spaces:'1',user_defined_dpi:'150'});}
    const extra=await ocr.recognize(canvas.toBuffer('image/png'),{},{blocks:true});
    labels=mergePdfFacilityOcr(labels,(extra.data.blocks??[]).flatMap(b=>b.paragraphs.flatMap(p=>p.lines)).map(l=>({text:l.text,confidence:l.confidence,source:'ocr' as const,box:{x:l.bbox.x0,y:l.bbox.y0,width:l.bbox.x1-l.bbox.x0,height:l.bbox.y1-l.bbox.y0}})));
    for(const region of numericOcrRegions(canvas.width,canvas.height)){
     const scale=Math.min(2,3600/Math.max(region.width,region.height)),tile=createCanvas(Math.round(region.width*scale),Math.round(region.height*scale));
     tile.getContext('2d').drawImage(canvas,region.x,region.y,region.width,region.height,0,0,tile.width,tile.height);
     const pass=await ocr.recognize(tile.toBuffer('image/png'),{},{blocks:true});
     labels=mergePdfFacilityOcr(labels,(pass.data.blocks??[]).flatMap(b=>b.paragraphs.flatMap(p=>p.lines)).map(l=>({text:l.text,confidence:l.confidence,source:'ocr' as const,box:{x:region.x+l.bbox.x0*region.width/tile.width,y:region.y+l.bbox.y0*region.height/tile.height,width:(l.bbox.x1-l.bbox.x0)*region.width/tile.width,height:(l.bbox.y1-l.bbox.y0)*region.height/tile.height}})));
    }
   }
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
   if(source==='ocr'&&numbersOcr){
    const regions=numericOcrRegions(canvas.width,canvas.height);
    for(let i=0;i<regions.length;i++)for(const rotation of [0,90] as const){
     const region=regions[i],scale=Math.min(2,3600/Math.max(region.width,region.height));
     const tile=createCanvas(Math.round((rotation?region.height:region.width)*scale),Math.round((rotation?region.width:region.height)*scale)),ctx=tile.getContext('2d');
     ctx.fillStyle='white';ctx.fillRect(0,0,tile.width,tile.height);
     if(rotation){ctx.translate(tile.width,0);ctx.rotate(Math.PI/2);}
     ctx.drawImage(canvas,region.x,region.y,region.width,region.height,0,0,rotation?tile.height:tile.width,rotation?tile.width:tile.height);
     const result=await numbersOcr.recognize(tile.toBuffer('image/png'),{},{blocks:true});
     const sx=(rotation?region.height:region.width)/tile.width,sy=(rotation?region.width:region.height)/tile.height;
     const extra=detectPlanLabels((result.data.blocks??[]).flatMap(b=>b.paragraphs.flatMap(p=>p.lines)).map(l=>{
      const box=unrotateTextBox({x:l.bbox.x0*sx,y:l.bbox.y0*sy,width:(l.bbox.x1-l.bbox.x0)*sx,height:(l.bbox.y1-l.bbox.y0)*sy},region.width,region.height,rotation);
      return {text:l.text,confidence:l.confidence,source:'ocr' as const,box:{...box,x:box.x+region.x,y:box.y+region.y}};
     })).filter(l=>l.kind==='dimension'||l.kind==='furniture').map(l=>({...l,id:`region-${i}-${rotation}-${l.id}`}));
     labels=mergeOrientedPlanLabels(labels,extra);
    }
   }
   const small=createCanvas(Math.round(canvas.width*1400/Math.max(canvas.width,canvas.height)),Math.round(canvas.height*1400/Math.max(canvas.width,canvas.height)));small.getContext('2d').drawImage(canvas,0,0,small.width,small.height);
   const pixels=small.getContext('2d').getImageData(0,0,small.width,small.height).data;
   const shapeCrops=shapeLabelRegions(detectWallCandidates(pixels,small.width,small.height,{threshold:155,maxCandidates:500,minLengthPx:Math.max(10,Math.round(1400*.008)),minThicknessPx:1}).map(l=>({...l,start:{x:l.start.x*canvas.width/small.width,y:l.start.y*canvas.height/small.height},end:{x:l.end.x*canvas.width/small.width,y:l.end.y*canvas.height/small.height},thicknessPx:l.thicknessPx*Math.max(canvas.width/small.width,canvas.height/small.height)})),canvas.width,canvas.height);
   if(source==='ocr'&&numbersOcr)for(let i=0;i<shapeCrops.length;i++)for(const rotation of shapeCrops[i].rotations){
    const crop=shapeCrops[i],scale=2,tile=createCanvas(Math.round((rotation%180?crop.height:crop.width)*scale),Math.round((rotation%180?crop.width:crop.height)*scale)),ctx=tile.getContext('2d');
    ctx.fillStyle='white';ctx.fillRect(0,0,tile.width,tile.height);
    if(rotation===90)ctx.translate(tile.width,0);if(rotation===180)ctx.translate(tile.width,tile.height);if(rotation===270)ctx.translate(0,tile.height);ctx.rotate(rotation*Math.PI/180);
    ctx.drawImage(canvas,crop.x,crop.y,crop.width,crop.height,0,0,rotation%180?tile.height:tile.width,rotation%180?tile.width:tile.height);
    const result=await numbersOcr.recognize(tile.toBuffer('image/png'),{},{blocks:true});
    const sx=(rotation%180?crop.height:crop.width)/tile.width,sy=(rotation%180?crop.width:crop.height)/tile.height;
    const extra=detectPlanLabels((result.data.blocks??[]).flatMap(b=>b.paragraphs.flatMap(p=>p.lines)).map(l=>{
     const box=unrotateTextBox({x:l.bbox.x0*sx,y:l.bbox.y0*sy,width:(l.bbox.x1-l.bbox.x0)*sx,height:(l.bbox.y1-l.bbox.y0)*sy},crop.width,crop.height,rotation);
     return {text:l.text,confidence:l.confidence,source:'ocr' as const,box:{...box,x:box.x+crop.x,y:box.y+crop.y}};
    })).filter(l=>l.kind==='furniture').map(l=>({...l,id:`shape-${i}-${rotation}-${l.id}`}));labels=mergeOrientedPlanLabels(labels,extra);
   }
   const embeddedSigns=await pdfSignImages(page as never,viewport.transform as Matrix6,canvas as never,OPS);
   const nativeSignCache=new Map<string,import('../src/domain/planLabels').PlanText[]>();
   for(const sign of embeddedSigns){
    let texts=nativeSignCache.get(sign.imageUrl);
    if(!texts){
     if(!ocr){ocr=await createWorker('eng+kor',OEM.LSTM_ONLY,{langPath:resolve('public/ocr/lang'),cacheMethod:'none'});await ocr.setParameters({tessedit_pageseg_mode:PSM.SPARSE_TEXT,preserve_interword_spaces:'1',user_defined_dpi:'150'});}
     const native=await (await import('@napi-rs/canvas')).loadImage(sign.imageUrl),scaled=createCanvas(sign.widthPx*2,sign.heightPx*2);scaled.getContext('2d').drawImage(native,0,0,scaled.width,scaled.height);
     const reading=await ocr.recognize(scaled.toBuffer('image/png'),{},{blocks:true});
     texts=(reading.data.blocks??[]).flatMap(b=>b.paragraphs.flatMap(p=>p.lines)).map(l=>({text:l.text,confidence:l.confidence,source:'ocr' as const,box:{x:l.bbox.x0/2,y:l.bbox.y0/2,width:(l.bbox.x1-l.bbox.x0)/2,height:(l.bbox.y1-l.bbox.y0)/2}}));nativeSignCache.set(sign.imageUrl,texts);
    }
    labels=mergePdfFacilityOcr(labels,texts.map(t=>({...t,box:{x:sign.box.x+t.box.x*sign.box.width/sign.widthPx,y:sign.box.y+t.box.y*sign.box.height/sign.heightPx,width:t.box.width*sign.box.width/sign.widthPx,height:t.box.height*sign.box.height/sign.heightPx}})));
   }
   const textPanels=source==='pdf-text'?pageTextPanels(canvas as never,nativeTexts.map(t=>t.box),labels):[];
   const runs=[125,155,190].map(threshold=>{
    const lines=detectWallCandidates(pixels,small.width,small.height,{threshold,maxCandidates:500,minLengthPx:Math.max(10,Math.round(1400*.008)),minThicknessPx:1}).map(l=>({...l,start:{x:l.start.x*canvas.width/small.width,y:l.start.y*canvas.height/small.height},end:{x:l.end.x*canvas.width/small.width,y:l.end.y*canvas.height/small.height},thicknessPx:l.thicknessPx*Math.max(canvas.width/small.width,canvas.height/small.height),...(l.solidSupportThicknessPx===undefined?{}:{solidSupportThicknessPx:l.solidSupportThicknessPx*Math.max(canvas.width/small.width,canvas.height/small.height)})}));
    const input:PlanPage={imageUrl:'data:image/png;base64,AA==',widthPx:canvas.width,heightPx:canvas.height,labels,textSource:source,textPanels,textRegions:source==='pdf-text'?nativeTexts.map(t=>t.box):undefined,analysis:{lines,issues:[],numericCount:labels.filter(l=>l.kind==='dimension').length,textState:'complete',lineState:'complete'}};
    const structural=extractStructuralWalls(input);
    const structureScore=sha256===structureTruth.sha256&&file===structureTruth.file&&number===structureTruth.page&&canvas.width===structureTruth.widthPx&&canvas.height===structureTruth.heightPx?{scope:structureTruth.scope,tolerancePx:structureTruth.tolerancePx,raw:scorePlanSegments(structureTruth.segments,lines,structureTruth.tolerancePx),selected:scorePlanSegments(structureTruth.segments,structural.map(w=>({start:{x:w.start.x,y:w.start.z},end:{x:w.end.x,y:w.end.z}})),structureTruth.tolerancePx)}:undefined;
    const resolved=resolvePlanOpenings(structural,labels,Math.max(canvas.width,canvas.height)*.2,detectStairRegions(labels,lines));
    const split=splitWallJunctions([...resolved.structure,...resolved.gaps.map(g=>g.wall)]);
    const topologyDiagnostics={splitSucceeded:!!split,splitCount:split?.length,cyclicCoreCount:split?peelOpenBranches(split).size:undefined,exteriorEdgeCount:split?exteriorWallEdges(split)?.size:undefined};
    const topologyResolved=!!classifyAutomaticWalls([...resolved.structure,...resolved.gaps.map(g=>g.wall)]);
    const {measuredSpans,annotations,openingDimensions,solution:dimensionConstraints}=venueDimensions(input,structural,resolved.structure,resolved.gaps);
    const selectedAnnotationTruth=file===annotationTruth.file&&sha256===annotationTruth.sha256&&number===annotationTruth.page&&canvas.width===annotationTruth.widthPx&&canvas.height===annotationTruth.heightPx?annotationTruth.intervals.map((t:{id:string;mm:number;horizontal:boolean;from:number;to:number;cross:number})=>({id:t.id,matched:annotations.matches.some(m=>{
     const w=structural.find(w=>w.id===m.wallId);return w&&m.mm===t.mm&&m.horizontal===t.horizontal&&Math.abs(m.from-t.from)<=annotationTruth.tolerancePx&&Math.abs(m.to-t.to)<=annotationTruth.tolerancePx&&Math.abs((t.horizontal?w.start.z:w.start.x)-t.cross)<=annotationTruth.tolerancePx;
    })})):undefined;
    const draft=buildAutomaticVenue(input);return {textPanels,unlabelledStairCandidates:detectUnlabelledStairCandidates(lines,labels),topologyDiagnostics,constrainedVenueReady:!!prepareConstrainedVenue(input),dimensionMapReady:!!createDimensionMap(dimensionConstraints),openingDimensions,selectedAnnotationTruth,measuredSpans,dimensionConstraints,annotationScale:wallAnnotationScale(structural,labels),topologyResolved,structureScore,openingCandidates:resolvePlanOpenings(structural,labels,Math.max(canvas.width,canvas.height)*.2,detectStairRegions(labels,lines)).gaps,framedWindows:detectFramedWindows(structural,labels,Math.max(canvas.width,canvas.height)*.2),stairRegions:detectStairRegions(labels,lines),structural,threshold,lineCount:lines.length,wallCandidates:draft.wallCount,draftGenerated:!!draft.project,reasons:draft.reasons};
   });
   const score=(items:typeof labels)=>truth.regions.map((region:{value:number;box:{x:number;y:number;width:number;height:number}})=>({value:region.value,matched:items.some(l=>{const n=readPlanNumbers(l.text),x=l.box.x+l.box.width/2,y=l.box.y+l.box.height/2,b=region.box;return !l.numericConflict&&(l.confidence??0)>=90&&n.length===1&&n[0].values.length===1&&n[0].values[0]===region.value&&x>=b.x&&x<=b.x+b.width&&y>=b.y&&y<=b.y+b.height;})}));
   const selectedTruth=sha256===truth.sha256&&file===truth.file&&number===truth.page&&canvas.width===truth.widthPx&&canvas.height===truth.heightPx?{scope:truth.scope,baseline:score(baselineLabels),enhanced:score(labels)}:undefined;
   const facilityScore=(items:typeof labels)=>facilityTruth.regions.map((r:{id:string;kind:string;box:{x:number;y:number;width:number;height:number}})=>({id:r.id,matched:items.some(l=>{const cx=l.box.x+l.box.width/2,cy=l.box.y+l.box.height/2;return l.kind===r.kind&&cx>=r.box.x&&cx<=r.box.x+r.box.width&&cy>=r.box.y&&cy<=r.box.y+r.box.height;})}));
   const selectedFacilityTruth=file===facilityTruth.file&&sha256===facilityTruth.sha256&&number===facilityTruth.page?{scope:facilityTruth.scope,baseline:facilityScore(baselineLabels),enhanced:facilityScore(labels)}:undefined;
   report.push({embeddedSignCount:embeddedSigns.length,selectedFacilityTruth,shapeCrops,pdfTextQuality:assessPdfText(text.items),ceilingHeight:readCeilingHeight(labels),stableStairRegions:stableStairRegions(runs.map(r=>r.stairRegions),1),file,sha256,page:number,selectedTruth,source,declaredUnit:pageUnit(labels),baselineNumbers:baselineLabels.filter(l=>l.kind==='dimension').length,conflicts:labels.filter(l=>l.numericConflict).length,facilityEvidence:labels.filter(l=>!['dimension','unit'].includes(l.kind)).map(l=>({kind:l.kind,text:l.text,box:l.box,confidence:l.confidence})),numberEvidence:labels.filter(l=>l.kind==='dimension').map(l=>({text:l.text,box:l.box,confidence:l.confidence,conflict:l.numericConflict??false})),textItems:text.items.length,numericLabels:labels.filter(l=>l.kind==='dimension').length,sampleNumbers:labels.filter(l=>l.kind==='dimension').slice(0,8).map(l=>l.text),runs,elapsedMs:Date.now()-started});
   await writeFile(resolve(directory,`${file}-${number}.png`),canvas.toBuffer('image/png'));page.cleanup();
  }}finally{await loading.destroy();}
 }
 }finally{await ocr?.terminate();await numbersOcr?.terminate();vi.unstubAllGlobals();}
 await writeFile(resolve(directory,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
},180000);
