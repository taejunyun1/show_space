import {readFile} from 'node:fs/promises';
import {expect,it} from 'vitest';
import {PDFDocument,PDFRawStream,decodePDFRawStream} from 'pdf-lib';
import {createDemoProject} from '../domain/model';
import {pdfSections} from './pdfLayout';
import {buildExhibitionPdf} from './pdfDocument';
it('creates searchable Korean PDF with vector plan/elevations and a complete embedded font',async()=>{
 const p=createDemoProject();p.walls[0].note='PRIVATE WALL';p.artworks[0].note='PRIVATE ART';p.artworks[4].wallSide='back';p.artworks[4].rotationDeg=30;p.artworks[0].frameSettings={widthMm:30,depthMm:70,material:'metal',matWidthMm:60,matColor:'#f5f4ef',cover:'glass'};
 const options={current:true,sceneIds:[],threeD:false,plan:true,elevation:true,allWallFaces:false,includeSchedule:true};
 const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64'));
 const bytes=await buildExhibitionPdf(pdfSections(p,options),options,{fontBytes:new Uint8Array(await readFile('public/fonts/NotoSansKR-Regular.ttf')),images:new Map(p.artworks.map(a=>[a.imageUrl,png])),previews:new Map()});
 const doc=await PDFDocument.load(bytes);expect(doc.getPageCount()).toBe(5);expect(doc.getPages().every(page=>Math.abs(page.getWidth()-841.89)<.1&&Math.abs(page.getHeight()-595.28)<.1)).toBe(true);expect(bytes.byteLength).toBeLessThan(7000000);
 const cmaps=doc.context.enumerateIndirectObjects().flatMap(([,object])=>object instanceof PDFRawStream?[new TextDecoder().decode(decodePDFRawStream(object).decode())]:[]).filter(value=>value.includes('begincmap'));
 expect(cmaps).toHaveLength(1);expect([...cmaps[0].matchAll(/(\d+) beginbfchar/g)].every(match=>Number(match[1])<=100)).toBe(true);
 const {getDocument,OPS}=await import('pdfjs-dist/legacy/build/pdf.mjs');const task=getDocument({data:bytes.slice(),useSystemFonts:false}),pdf=await task.promise;
 let text='';let pathCount=0;for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i);text+=(await page.getTextContent()).items.map(item=>'str' in item?item.str:'').join(' ');const list=await page.getOperatorList();pathCount+=list.fnArray.filter(n=>n===OPS.constructPath).length;}
 expect(text).toContain('여백의 기록');expect(text).toContain('8,000');expect(text).toContain('1,200');expect(text).toContain('고요한 면');expect(text).toContain('5. 여백');expect(text).toContain('30°');expect(text).toContain('액자 외곽 1,080×1,380×70 mm');expect(text).toContain('900×1,200×30 mm');expect(text).not.toContain('PRIVATE');expect(pathCount).toBeGreaterThan(0);await task.destroy();
},20000);

it('keeps dense elevation captions readable and inside the page while preserving full names in the schedule',async()=>{
 const p=createDemoProject(),original=p.artworks[0];p.artworks=Array.from({length:10},(_,i)=>({...original,id:`caption-${i}`,name:`작품 ${i+1} ${'긴 이름 '.repeat(10)}`,widthMm:400,heightMm:1200,wallId:'wall-a',alongMm:600+i*650,centerHeightMm:1500}));
 const options={current:true,sceneIds:[],threeD:false,plan:false,elevation:true,allWallFaces:false,includeSchedule:true};
 const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64'));
 const bytes=await buildExhibitionPdf(pdfSections(p,options),options,{fontBytes:new Uint8Array(await readFile('public/fonts/NotoSansKR-Regular.ttf')),images:new Map([[original.imageUrl,png]]),previews:new Map()});
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs'),task=getDocument({data:bytes.slice(),useSystemFonts:false}),pdf=await task.promise;
 const page=await pdf.getPage(1),items=(await page.getTextContent()).items.filter(item=>'str' in item),caption=items.find(item=>item.str.trim()&&Math.abs(item.transform[5]-74)<.1);
 expect(caption).toBeDefined();expect(caption!.str).toContain('…');expect(caption!.height).toBeGreaterThanOrEqual(8);expect(caption!.transform[4]+caption!.width).toBeLessThanOrEqual(841.89-52+.1);
 let schedule='';for(let i=2;i<=pdf.numPages;i++)schedule+=(await (await pdf.getPage(i)).getTextContent()).items.map(item=>'str' in item?item.str:'').join(' ');
 expect(schedule).toContain('작품 10');expect(schedule).not.toContain('…');await task.destroy();
},20000);

it('exports frame/rotation-aware axis gaps and A/B-face installation schedules without private notes',async()=>{
 const p=createDemoProject();p.artworks=p.artworks.slice(0,4).map((a,i)=>({...a,name:`설치 검증 ${i+1}`,wallId:'wall-a',wallSide:i<2?'front':'back',widthMm:i===3?700:500,heightMm:i===3?900:600,alongMm:i<2?1000:i===2?4780:3600,centerHeightMm:i<2?800+i*1030:1600,rotationDeg:i<2?0:90,frame:'natural',frameSettings:{widthMm:30,depthMm:70,matWidthMm:60,matColor:'#ffffff',material:'metal',cover:'glass'},note:'PRIVATE NOTE'}));
 const before=JSON.stringify(p),options={current:true,sceneIds:[],threeD:false,plan:false,elevation:true,allWallFaces:false,includeSchedule:true};
 const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64'));
 const bytes=await buildExhibitionPdf(pdfSections(p,options),options,{fontBytes:new Uint8Array(await readFile('public/fonts/NotoSansKR-Regular.ttf')),images:new Map(p.artworks.map(a=>[a.imageUrl,png])),previews:new Map()});
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs'),task=getDocument({data:bytes.slice(),useSystemFonts:false}),pdf=await task.promise,texts=[];
 for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i);texts.push((await page.getTextContent()).items.map(item=>'str' in item?item.str:'').join(' '));}
 expect(texts[0]).toContain('A면 벽면도');expect(texts[0]).toContain('250 mm');expect(texts[1]).toContain('B면 벽면도');expect(texts[1]).toContain('250 mm');
 const text=texts.slice(2).join(' ');expect(text).toContain('작품 설치 치수');expect(text).toContain('바닥 410');expect(text).toContain('바닥 1,260');expect(text).toContain('벽 왼쪽 2,830');expect(text).toContain('벽 오른쪽 4,390');expect(text).toContain('외곽 세로 간격 250 mm');expect(text).toContain('외곽 가로 간격 250 mm');expect(text).not.toContain('PRIVATE NOTE');expect(JSON.stringify(p)).toBe(before);await task.destroy();
},20000);

it('wraps long installation names into readable schedule lines inside the page margins',async()=>{
 const p=createDemoProject();p.artworks=p.artworks.slice(0,2).map((a,i)=>({...a,name:'설치작품'.repeat(50),widthMm:500,heightMm:600,frame:'none',wallId:'wall-a',alongMm:1000+i*750,centerHeightMm:1500}));
 const options={current:true,sceneIds:[],threeD:false,plan:true,elevation:false,allWallFaces:false,includeSchedule:true},bytes=await buildExhibitionPdf(pdfSections(p,options),options,{fontBytes:new Uint8Array(await readFile('public/fonts/NotoSansKR-Regular.ttf')),images:new Map(),previews:new Map()});
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs'),task=getDocument({data:bytes.slice(),useSystemFonts:false}),pdf=await task.promise;let installation=false;
 for(let i=2;i<=pdf.numPages;i++){const page=await pdf.getPage(i),items=(await page.getTextContent()).items.filter(item=>'str' in item);for(const item of items){if(item.str.includes('외곽 가로 간격'))installation=true;expect(item.transform[4]).toBeGreaterThanOrEqual(36);expect(item.transform[4]+item.width).toBeLessThanOrEqual(841.89-35);}}
 expect(installation).toBe(true);await task.destroy();
},20000);
