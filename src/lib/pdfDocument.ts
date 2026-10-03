import {artworkPresentation,frameColors} from '../domain/artworkPresentation';
import {modelArtworkFootprint} from '../domain/modelArtworks';
import fontkit from '@pdf-lib/fontkit';
import {PDFDocument,PDFDict,PDFName,PDFRawStream,PDFRef,decodePDFRawStream,degrees,rgb,type PDFFont,type PDFImage,type PDFPage} from 'pdf-lib';
import {wallLength} from '../domain/model';
import {floorWithOpenings,openingSegments} from '../domain/openings';
import {resolveMeasurement} from '../domain/measurements';
import {installationZones} from '../domain/installationZones';
import {elevationArtPlacement,fitPdfDrawing,type PdfOptions,type PdfSection} from './pdfLayout';
import type {Point,Project} from '../domain/types';

export interface PdfAssets {fontBytes:Uint8Array;images:Map<string,Uint8Array>;previews:Map<number,Uint8Array>}
const W=841.89,H=595.28,ink=rgb(.14,.19,.25),muted=rgb(.36,.42,.49),blue=rgb(.21,.36,.8),light=rgb(.78,.82,.87);
const mm=(n:number)=>Math.round(n).toLocaleString('en-US');
const color=(hex:string)=>{const m=/^#([0-9a-f]{6})$/i.exec(hex);return m?rgb(parseInt(m[1].slice(0,2),16)/255,parseInt(m[1].slice(2,4),16)/255,parseInt(m[1].slice(4,6),16)/255):rgb(.9,.9,.9);};
function text(page:PDFPage,font:PDFFont,value:string,x:number,y:number,size=10,maxWidth=W-80){
 const str=value.normalize('NFC').replace(/[\r\n\t]/g,' '),width=font.widthOfTextAtSize(str,size);
 page.drawText(str,{x,y,font,size:width>maxWidth?Math.max(5,size*maxWidth/width):size,color:ink});
}
function line(page:PDFPage,x1:number,y1:number,x2:number,y2:number,c=light,width=.65){page.drawLine({start:{x:x1,y:y1},end:{x:x2,y:y2},color:c,thickness:width});}
function dimension(page:PDFPage,font:PDFFont,x1:number,y1:number,x2:number,y2:number,value:string){
 line(page,x1,y1,x2,y2,muted);const dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy)||1,nx=-dy/len*3,ny=dx/len*3;
 line(page,x1-nx,y1-ny,x1+nx,y1+ny,muted);line(page,x2-nx,y2-ny,x2+nx,y2+ny,muted);text(page,font,value,(x1+x2)/2-font.widthOfTextAtSize(value,8)/2,(y1+y2)/2+5,8);
}
function polygon(page:PDFPage,points:Point[],fit:ReturnType<typeof fitPdfDrawing>,fill:string){
 if(!points.length)return;const path=points.map((p,i)=>`${i?'L':'M'} ${fit.x(p.x)} ${H-fit.y(p.z)}`).join(' ')+' Z';
 page.drawSvgPath(path,{x:0,y:H,color:color(fill),borderColor:light,borderWidth:.4});
}
function header(doc:PDFDocument,font:PDFFont,section:PdfSection,title:string){
 const page=doc.addPage([W,H]);text(page,font,section.project.name,36,H-38,18);text(page,font,`${section.project.venue} · ${section.name}${section.project.outdoor?.mode==='outdoor'?` · 야외 ${section.project.outdoor.date} ${section.project.outdoor.time} (${section.project.outdoor.timeZone}) · 북쪽 ${section.project.outdoor.northDeg}°`:''}`,36,H-60,10);text(page,font,title,36,H-89,12);line(page,36,H-102,W-36,H-102);
 text(page,font,'공간 · 전시 배치 출력 · 내부 메모 제외',36,22,8);return page;
}
function scaleNote(page:PDFPage,font:PDFFont,fit:ReturnType<typeof fitPdfDrawing>){
 text(page,font,`치수 단위 mm · A4 가로 100% 인쇄 시 축척 약 1:${fit.denominator.toFixed(1)} · 용지 맞춤 인쇄 시 축척이 달라집니다.`,36,42,8);
}
function plan(page:PDFPage,font:PDFFont,project:Project){
 const points=[...(project.modelArtworks??[]).filter(a=>a.visible).flatMap(modelArtworkFootprint),...project.walls.flatMap(w=>[w.start,w.end]),...(project.importedFloor?.flat()??[]),...(project.dimensions??[]).filter(d=>d.view==='plan').flatMap(d=>{const r=resolveMeasurement(project,d);return [r.start,r.end];})];
 if(!points.length){text(page,font,'편집 벽이 없습니다. 참고 모델은 3D 보기에서 확인하세요.',70,280,12);return;}
 const fit=fitPdfDrawing({minX:Math.min(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.z)),maxX:Math.max(...points.map(p=>p.x)),maxY:Math.max(...points.map(p=>p.z))},{x:48,y:76,width:W-96,height:385});
 for(const surface of floorWithOpenings(project).surfaces){polygon(page,surface.outer,fit,project.floorColor);for(const hole of surface.holes)polygon(page,hole,fit,'#ffffff');}
 for(const zone of installationZones(project))page.drawRectangle({x:fit.x(zone.x),y:fit.y(zone.z+zone.depth),width:zone.width*fit.scale,height:zone.depth*fit.scale,color:rgb(.96,.82,.79),opacity:.65});
 for(const [i,wall] of project.walls.entries())if(wall.visible){
  line(page,fit.x(wall.start.x),fit.y(wall.start.z),fit.x(wall.end.x),fit.y(wall.end.z),color(wall.color),wall.thicknessMm*fit.scale);
  line(page,fit.x(wall.start.x),fit.y(wall.start.z),fit.x(wall.end.x),fit.y(wall.end.z),muted,.8);
  text(page,font,`${i+1} · ${mm(wallLength(wall))} mm`,fit.x((wall.start.x+wall.end.x)/2)+4,fit.y((wall.start.z+wall.end.z)/2)+6,7,150);
 }
 for(const o of openingSegments(project)){line(page,fit.x(o.start.x),fit.y(o.start.z),fit.x(o.end.x),fit.y(o.end.z),rgb(.09,.5,.42),1.5);text(page,font,o.kind==='door'?'출입구':o.kind==='window'?'창문':'계단 통로',fit.x((o.start.x+o.end.x)/2)+3,fit.y((o.start.z+o.end.z)/2)-11,7,100);}
 for(const [i,art] of project.artworks.entries()){const wall=project.walls.find(w=>w.id===art.wallId);if(!art.visible||!wall?.visible)continue;const t=art.alongMm/wallLength(wall),x=fit.x(wall.start.x+(wall.end.x-wall.start.x)*t),y=fit.y(wall.start.z+(wall.end.z-wall.start.z)*t);page.drawCircle({x,y,size:3,color:blue});text(page,font,String(i+1),x+4,y-11,7);}
 for(const [i,a] of (project.modelArtworks??[]).entries())if(a.visible){polygon(page,modelArtworkFootprint(a),fit,'#c5ad8e');text(page,font,`3D ${i+1} · ${a.name}`,fit.x(a.position.x),fit.y(a.position.z),7,160);}
 for(const d of project.dimensions??[])if(d.view==='plan'){const r=resolveMeasurement(project,d);dimension(page,font,fit.x(r.start.x),fit.y(r.start.z),fit.x(r.end.x),fit.y(r.end.z),`${mm(r.distanceMm)} mm`);}
 scaleNote(page,font,fit);if(project.referenceModel?.visible)text(page,font,'평면도는 편집 벽 기준입니다. 원본 3D 참고 모델의 형상은 3D 페이지에 포함됩니다.',36,60,8);
}
function elevation(page:PDFPage,font:PDFFont,section:PdfSection,images:Map<string,PDFImage>){
 const wall=section.wall!,side=section.side!,length=wallLength(wall),height=wall.heightMm;
 const fit=fitPdfDrawing({minX:0,minY:0,maxX:length,maxY:height},{x:52,y:112,width:W-104,height:320});
 page.drawRectangle({x:fit.x(0),y:fit.y(height),width:length*fit.scale,height:height*fit.scale,color:color(wall.color),borderColor:light,borderWidth:.7});
 const artworks=section.project.artworks.filter(a=>a.visible&&a.wallId===wall.id&&(a.wallSide??'front')===side&&a.imageUrl);
 for(const art of artworks){
  const pose=elevationArtPlacement(art,wall,side),angle=pose.angle*Math.PI/180,cx=fit.x(pose.x),cy=fit.y(pose.y),width=art.widthMm*fit.scale,h=art.heightMm*fit.scale;
  const lower=(w:number,h:number)=>({x:cx-w/2*Math.cos(angle)+h/2*Math.sin(angle),y:cy-w/2*Math.sin(angle)-h/2*Math.cos(angle)});
  const presentation=artworkPresentation(art),outerW=presentation.widthMm*fit.scale,outerH=presentation.heightMm*fit.scale,frame=lower(outerW,outerH),image=images.get(art.imageUrl);if(!image)throw new Error('벽면도 작품 이미지를 준비하지 못했습니다.');
  page.drawRectangle({...frame,width:outerW,height:outerH,rotate:degrees(pose.angle),color:color(frameColors[art.frame])});
  if(presentation.framed&&presentation.settings.matWidthMm>0){const iw=presentation.innerWidthMm*fit.scale,ih=presentation.innerHeightMm*fit.scale;page.drawRectangle({...lower(iw,ih),width:iw,height:ih,rotate:degrees(pose.angle),color:color(presentation.settings.matColor)});}
  page.drawImage(image,{...lower(width,h),width,height:h,rotate:degrees(pose.angle)});
  if(presentation.coverThicknessMm>0){const iw=presentation.innerWidthMm*fit.scale,ih=presentation.innerHeightMm*fit.scale;page.drawRectangle({...lower(iw,ih),width:iw,height:ih,rotate:degrees(pose.angle),color:color('#e6f0f5'),opacity:.055});}
  text(page,font,`${section.project.artworks.indexOf(art)+1}`,cx-3,cy-h/2-14,8);
 }
 dimension(page,font,fit.x(0),fit.y(0)+17,fit.x(length),fit.y(0)+17,`${mm(length)} mm`);
 text(page,font,`높이 ${mm(height)} mm · 두께 ${mm(wall.thicknessMm)} mm`,52,91,9);
 const names=artworks.map(a=>`${section.project.artworks.indexOf(a)+1}. ${a.name} (${mm(a.widthMm)}×${mm(a.heightMm)} mm)`).join(' · ');text(page,font,names,52,74,8,W-104);
 for(const d of section.project.dimensions??[])if(d.view==='elevation'&&d.elevationWallId===wall.id){const r=resolveMeasurement(section.project,d),dx=wall.end.x-wall.start.x,dz=wall.end.z-wall.start.z;const p=(point:{x:number;y:number;z:number})=>{const along=((point.x-wall.start.x)*dx+(point.z-wall.start.z)*dz)/length;return {x:fit.x(side==='back'?length-along:along),y:fit.y(height-point.y)};};const a=p(r.start),b=p(r.end);dimension(page,font,a.x,a.y,b.x,b.y,`${mm(r.distanceMm)} mm`);}
 scaleNote(page,font,fit);
}
function schedules(doc:PDFDocument,font:PDFFont,section:PdfSection){
 let page=header(doc,font,section,'치수 목록 · 표시 중인 벽과 배치 작품'),y=H-126;
 const row=(value:string,size=9)=>{if(y<65){page=header(doc,font,section,'치수 목록 · 계속');y=H-126;}text(page,font,value,42,y,size,W-84);y-=19;};
 row('벽 번호 · 이름 / 길이 × 높이 × 두께 (mm)',11);
 for(const [i,w] of section.project.walls.entries())if(w.visible)row(`${i+1}. ${w.name} / ${mm(wallLength(w))} × ${mm(w.heightMm)} × ${mm(w.thicknessMm)}`);
 for(const [i,a] of (section.project.modelArtworks??[]).entries())if(a.visible)row(`3D ${i+1}. ${a.name} / ${mm(a.widthMm)}×${mm(a.heightMm)}×${mm(a.depthMm)} mm · 위치 ${mm(a.position.x)}, ${mm(a.position.y)}, ${mm(a.position.z)} mm · 회전 ${a.rotation.x.toFixed(1)}, ${a.rotation.y.toFixed(1)}, ${a.rotation.z.toFixed(1)}°`);
 y-=12;row('작품 번호 · 이름 / 크기 · 설치 벽/면 · 시작점 거리 · 중심 높이 · 회전',11);
 for(const [i,a] of section.project.artworks.entries()){const w=section.project.walls.find(w=>w.id===a.wallId);if(a.visible&&w?.visible)row(`${i+1}. ${a.name} / ${mm(a.widthMm)}×${mm(a.heightMm)}×${mm(a.depthMm)} mm · ${w.name} ${a.wallSide==='back'?'B':'A'}면 · ${mm(a.alongMm)} mm · ${mm(a.centerHeightMm)} mm · ${a.rotationDeg??0}°${a.frame!=='none'?(()=>{const p=artworkPresentation(a);return ` · 액자 외곽 ${mm(p.widthMm)}×${mm(p.heightMm)}×${mm(p.depthMm)} mm`;})():''}`);}
}

export async function buildExhibitionPdf(sections:PdfSection[],options:PdfOptions,assets:PdfAssets):Promise<Uint8Array>{
 if(!sections.length)throw new Error('내보낼 PDF 페이지가 없습니다.');
 const doc=await PDFDocument.create();doc.registerFontkit(fontkit);doc.setTitle(sections[0].project.name);doc.setCreator('공간 — 전시 시뮬레이터');doc.setSubject('전시 배치 · 실제 치수 mm');
 // Keep the full TrueType font: fontkit's CJK composite-glyph subsetting loses outlines.
 // Contextual alternates have no Unicode mapping in pdf-lib's full-font CMap.
 const font=await doc.embedFont(assets.fontBytes,{subset:false,features:{calt:false,locl:false,liga:false,kern:false}}),images=new Map<string,PDFImage>();
 for(const [url,bytes] of assets.images)images.set(url,await doc.embedPng(bytes));
 for(const [index,section] of sections.entries()){
  const page=header(doc,font,section,section.kind==='3d'?'3D 공간':section.kind==='plan'?'평면도':`${section.wall!.name} · ${section.side==='back'?'B':'A'}면 벽면도`);
  if(section.kind==='3d'){
   const bytes=assets.previews.get(index);if(!bytes)throw new Error('PDF 3D 이미지를 준비하지 못했습니다.');const image=await doc.embedPng(bytes),s=Math.min((W-72)/image.width,390/image.height);page.drawImage(image,{x:(W-image.width*s)/2,y:65+(390-image.height*s)/2,width:image.width*s,height:image.height*s});text(page,font,'3D 이미지는 시각 참고용입니다. 실제 치수는 평면·벽면도 또는 치수 목록을 확인하세요.',36,42,8);
  }else if(section.kind==='plan')plan(page,font,section.project);else elevation(page,font,section,images);
 }
 if(options.includeSchedule){const seen=new Set<Project>();for(const section of sections)if(!seen.has(section.project)){seen.add(section.project);schedules(doc,font,section);}}
 doc.getPages().forEach((page,i)=>text(page,font,`${i+1} / ${doc.getPageCount()}`,W-75,22,8,40));
 // PDF CMaps allow at most 100 mappings per bfchar block. pdf-lib emits all
 // 22,451 CJK mappings in one block; split them for compliant readers.
 await font.embed();
 const dictionary=doc.context.lookup(font.ref,PDFDict),ref=dictionary.get(PDFName.of('ToUnicode'));
 if(!(ref instanceof PDFRef))throw new Error('PDF 한글 문자 매핑을 준비하지 못했습니다.');
 const stream=doc.context.lookup(ref);
 if(!(stream instanceof PDFRawStream))throw new Error('PDF 한글 문자 매핑을 읽지 못했습니다.');
 const cmap=new TextDecoder().decode(decodePDFRawStream(stream).decode()).replace(/\d+ beginbfchar\s*([\s\S]*?)\s*endbfchar/g,(_,body:string)=>{
  const entries=body.trim().split(/\r?\n/),blocks:string[]=[];
  for(let i=0;i<entries.length;i+=100){const block=entries.slice(i,i+100);blocks.push(`${block.length} beginbfchar\n${block.join('\n')}\nendbfchar`);}
  return blocks.join('\n');
 });
 doc.context.assign(ref,doc.context.flateStream(cmap));
 return doc.save();
}
