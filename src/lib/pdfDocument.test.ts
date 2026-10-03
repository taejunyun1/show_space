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
 const doc=await PDFDocument.load(bytes);expect(doc.getPageCount()).toBe(4);expect(doc.getPages().every(page=>Math.abs(page.getWidth()-841.89)<.1&&Math.abs(page.getHeight()-595.28)<.1)).toBe(true);expect(bytes.byteLength).toBeLessThan(7000000);
 const cmaps=doc.context.enumerateIndirectObjects().flatMap(([,object])=>object instanceof PDFRawStream?[new TextDecoder().decode(decodePDFRawStream(object).decode())]:[]).filter(value=>value.includes('begincmap'));
 expect(cmaps).toHaveLength(1);expect([...cmaps[0].matchAll(/(\d+) beginbfchar/g)].every(match=>Number(match[1])<=100)).toBe(true);
 const {getDocument,OPS}=await import('pdfjs-dist/legacy/build/pdf.mjs');const task=getDocument({data:bytes.slice(),useSystemFonts:false}),pdf=await task.promise;
 let text='';let pathCount=0;for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i);text+=(await page.getTextContent()).items.map(item=>'str' in item?item.str:'').join(' ');const list=await page.getOperatorList();pathCount+=list.fnArray.filter(n=>n===OPS.constructPath).length;}
 expect(text).toContain('여백의 기록');expect(text).toContain('8,000');expect(text).toContain('1,200');expect(text).toContain('고요한 면');expect(text).toContain('5. 여백');expect(text).toContain('30°');expect(text).toContain('액자 외곽 1,080×1,380×70 mm');expect(text).toContain('900×1,200×30 mm');expect(text).not.toContain('PRIVATE');expect(pathCount).toBeGreaterThan(0);await task.destroy();
},20000);
