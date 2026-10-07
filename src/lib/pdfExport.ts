import {pdfArtworkImageKey,framedVideoPoster} from './videoPoster';
import {pdfSections,pdfNeeds3d,pdfPreviewSection,type PdfOptions} from './pdfLayout';
import {queueTemporaryRender} from './temporaryRenderQueue';
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
 for(const section of sections)for(const artwork of section.kind==='detail'&&section.artwork?[section.artwork]:section.kind==='elevation'?section.project.artworks.filter(a=>a.visible&&a.wallId===section.wall!.id&&(a.wallSide??'front')===section.side):[]){
  const key=pdfArtworkImageKey(artwork);if(!artwork.imageUrl||assets.images.has(key))continue;
  onProgress(`작품 이미지 준비 중 · ${assets.images.size+1}`);const texture=await artworkTexture(artwork.imageUrl);
  try{const image=texture.image as HTMLCanvasElement,canvas=artwork.video?framedVideoPoster(image,artwork.widthMm,artwork.heightMm,artwork.video):image,url=canvas.toDataURL('image/png');assets.images.set(key,Uint8Array.from(atob(url.split(',')[1]),c=>c.charCodeAt(0)));}finally{texture.dispose();}
 }
 if(sections.some(pdfNeeds3d)){
  const {renderPdf3d}=await import('./pdfRender3d');
  for(const [index,section] of sections.entries())if(pdfNeeds3d(section)){onProgress(`${section.name} · ${index+1}/${sections.length} 3D 이미지 만드는 중`);assets.previews.set(index,await queueTemporaryRender(new AbortController().signal,()=>renderPdf3d(pdfPreviewSection(section),currentCamera)));}
 }
 onProgress('평면·벽면도와 한글 PDF 만드는 중');
 const bytes=await buildExhibitionPdf(sections,options,assets);
 return new Blob([bytes.slice().buffer as ArrayBuffer],{type:'application/pdf'});
}
