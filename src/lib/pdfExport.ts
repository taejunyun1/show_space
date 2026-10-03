import {pdfSections,type PdfOptions} from './pdfLayout';
import {buildExhibitionPdf,type PdfAssets} from './pdfDocument';
import type {Project} from '../domain/types';
import type {PdfCurrentCamera} from './pdfRender3d';

export async function exportProjectPdf(project:Project,options:PdfOptions,currentCamera:PdfCurrentCamera|undefined,onProgress:(message:string)=>void=()=>{}):Promise<Blob>{
 const sections=pdfSections(project,options);
 onProgress('한글 글꼴 준비 중');
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000);let fontBytes:Uint8Array;
 try{const response=await fetch('/fonts/NotoSansKR-Regular.ttf',{signal:controller.signal});if(!response.ok)throw new Error();fontBytes=new Uint8Array(await response.arrayBuffer());}
 catch{throw new Error('PDF 한글 글꼴을 읽지 못했습니다. 연결 상태를 확인하고 다시 내보내세요.');}
 finally{clearTimeout(timeout);}
 const assets:PdfAssets={fontBytes,images:new Map(),previews:new Map()};
 const {artworkTexture}=await import('./modelExport');
 for(const section of sections)if(section.kind==='elevation')for(const artwork of section.project.artworks){
  if(!artwork.visible||artwork.wallId!==section.wall!.id||(artwork.wallSide??'front')!==section.side||!artwork.imageUrl||assets.images.has(artwork.imageUrl))continue;
  onProgress(`작품 이미지 준비 중 · ${assets.images.size+1}`);const texture=await artworkTexture(artwork.imageUrl);
  try{const url=(texture.image as HTMLCanvasElement).toDataURL('image/png');assets.images.set(artwork.imageUrl,Uint8Array.from(atob(url.split(',')[1]),c=>c.charCodeAt(0)));}finally{texture.dispose();}
 }
 if(sections.some(s=>s.kind==='3d')){
  const {renderPdf3d}=await import('./pdfRender3d');
  for(const [index,section] of sections.entries())if(section.kind==='3d'){onProgress(`${section.name} · 3D 이미지 만드는 중`);assets.previews.set(index,await renderPdf3d(section,currentCamera));}
 }
 onProgress('평면·벽면도와 한글 PDF 만드는 중');
 const bytes=await buildExhibitionPdf(sections,options,assets);
 return new Blob([bytes.slice().buffer as ArrayBuffer],{type:'application/octet-stream'});
}
