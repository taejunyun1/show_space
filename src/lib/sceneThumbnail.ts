import {parseSceneThumbnail,SCENE_THUMBNAIL_EDGE} from '../domain/sceneThumbnail';
import type {Project,SceneThumbnail} from '../domain/types';
import type {PdfCurrentCamera} from './pdfRender3d';
import {queueTemporaryRender} from './temporaryRenderQueue';

export async function thumbnailFromBlob(blob:Blob,view:SceneThumbnail['view'],signal:AbortSignal):Promise<SceneThumbnail>{
 signal.throwIfAborted();const bitmap=await createImageBitmap(blob),canvas=document.createElement('canvas');
 try{
  signal.throwIfAborted();canvas.width=SCENE_THUMBNAIL_EDGE;canvas.height=200;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Scene 미리보기를 만들 수 없습니다.');
  const scale=Math.min(canvas.width/bitmap.width,canvas.height/bitmap.height),width=bitmap.width*scale,height=bitmap.height*scale;
  ctx.fillStyle='#e9edf1';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,(canvas.width-width)/2,(canvas.height-height)/2,width,height);
  return parseSceneThumbnail({imageUrl:canvas.toDataURL('image/jpeg',.75),widthPx:canvas.width,heightPx:canvas.height,view});
 }finally{bitmap.close();canvas.width=canvas.height=0;}
}
export type ScenePreviewRenderer=(project:Project,camera:PdfCurrentCamera|undefined)=>Promise<Uint8Array>;
export async function renderSceneThumbnail(project:Project,camera:PdfCurrentCamera|undefined,signal:AbortSignal,render?:ScenePreviewRenderer,encode=thumbnailFromBlob):Promise<SceneThumbnail>{
 const source=structuredClone({...project,scenes:[]}),view=camera?structuredClone(camera):undefined;
 const png=await queueTemporaryRender(signal,async()=>{
  if(render)return render(source,view);
  const {renderPdf3d}=await import('./pdfRender3d');
  return renderPdf3d({project:source,name:'Scene 미리보기',kind:'3d',current:true},view,SCENE_THUMBNAIL_EDGE);
 });
 return encode(new Blob([new Uint8Array(png)],{type:'image/png'}),'3d',signal);
}
