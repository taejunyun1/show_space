import {artPanel} from './art';
import {artworkTemplate,parseArtworkTemplate,libraryImageBytes,type ArtworkTemplate} from '../domain/artworkLibrary';
import {ARTWORK_LIBRARY_MAX_BYTES,ARTWORK_LIBRARY_MAX_ITEMS,type ArtworkLibraryInput,type ArtworkLibraryBackup} from './artworkLibrary';
import type {Artwork,ModelArtwork,Project} from '../domain/types';
import {artworkLibraryThumbnailView} from './artworkLibraryThumbnail';
function image(url:string){return new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image(),fail=()=>{clearTimeout(timer);img.onload=null;img.onerror=null;img.src='';reject(new Error('작품 이미지를 읽지 못했습니다.'));},timer=setTimeout(fail,15000);img.onload=()=>{clearTimeout(timer);img.onload=null;img.onerror=null;resolve(img);};img.onerror=fail;img.src=url;});}
function canvasImage(source:CanvasImageSource,width:number,height:number,longEdge:number,panel:number|null=null){
 const scale=Math.min(1,longEdge/Math.max(width,height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));const context=canvas.getContext('2d');if(!context)throw new Error('작품 썸네일을 만들지 못했습니다.');context.drawImage(source,panel===null?0:panel*width,0,width,height,0,0,canvas.width,canvas.height);return canvas;
}
async function modelThumbnail(template:Extract<ArtworkTemplate,{kind:'model'}>){
 const a=template.artwork;
 const project:Project={schemaVersion:1,id:'library-thumbnail',name:a.name,venue:'',walls:[],artworks:[],scenes:[],floorColor:'#ffffff',modelArtworks:[{...a,id:'library-model',position:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0},visible:true,locked:false,note:''}]};
 const view=artworkLibraryThumbnailView([a.widthMm,a.heightMm,a.depthMm]);
 const {renderPdf3d}=await import('./pdfRender3d');const png=await renderPdf3d({kind:'3d',project,name:a.name,current:true},{view,width:256,height:256,cutaway:false},256);const bitmap=await createImageBitmap(new Blob([png.slice().buffer],{type:'image/png'}));try{return canvasImage(bitmap,bitmap.width,bitmap.height,256).toDataURL('image/webp',.85);}finally{bitmap.close();}
}
export async function prepareArtworkLibraryInput(kind:'image'|'model',source:Artwork|ModelArtwork):Promise<ArtworkLibraryInput>{
 const original=structuredClone(source);
 if(kind==='image'){
  const a=original as Artwork,panel=artPanel(a.imageUrl);
  if(a.video)await (await import('./videoArtworkImport')).verifyVideoArtwork(a.video);
  if(panel!==null&&!/^\/artworks\/artwork-[1-5]\.png$/.test(a.imageUrl))throw new Error('예제 작품 경로가 올바르지 않습니다.');
  if(panel===null)libraryImageBytes(a.imageUrl);
  const img=await image(a.imageUrl),width=panel===null?img.naturalWidth:img.naturalWidth/5,height=img.naturalHeight;
  if(!width||!height||width*height>60_000_000)throw new Error('작품 이미지 해상도가 올바르지 않습니다.');
  if(panel!==null)a.imageUrl=canvasImage(img,width,height,2048,panel).toDataURL('image/png');
  const thumbnail=canvasImage(img,width,height,256,panel).toDataURL('image/webp',.85);libraryImageBytes(thumbnail,128*1024,256);
  return {template:artworkTemplate('image',a),thumbnail};
 }
 const template=artworkTemplate('model',original) as Extract<ArtworkTemplate,{kind:'model'}>;
 const thumbnail=await modelThumbnail(template);libraryImageBytes(thumbnail,128*1024,256);return {template,thumbnail};
}
/** Decode every image before the atomic restore, so a damaged file never creates blank cards. */
export async function readArtworkLibraryBackup(file:File):Promise<ArtworkLibraryBackup>{
 if(file.size>ARTWORK_LIBRARY_MAX_BYTES)throw new Error('라이브러리 백업은 80MB 이하여야 합니다.');
 let backup:ArtworkLibraryBackup;try{backup=JSON.parse(await file.text()) as ArtworkLibraryBackup;}catch{throw new Error('라이브러리 JSON을 읽지 못했습니다.');}
 if(backup?.format!=='gonggan-artwork-library'||backup.schemaVersion!==1||!Array.isArray(backup.items)||!backup.items.length||backup.items.length>ARTWORK_LIBRARY_MAX_ITEMS)throw new Error('작품 라이브러리 백업 파일을 선택하세요.');
 const items:ArtworkLibraryInput[]=[];
 for(const item of backup.items){
  if(!item||typeof item!=='object'||(item.archived!==undefined&&typeof item.archived!=='boolean'))throw new Error('라이브러리 작품 정보가 올바르지 않습니다.');
  const template=parseArtworkTemplate(item.template);libraryImageBytes(item.thumbnail,128*1024,256);await image(item.thumbnail);
  if(template.kind==='image'){await image(template.artwork.imageUrl);if(template.artwork.video)await (await import('./videoArtworkImport')).verifyVideoArtwork(template.artwork.video);if(template.artwork.material?.texture)await image(template.artwork.material.texture.imageUrl);if(template.artwork.material?.normal)await image(template.artwork.material.normal.imageUrl);}
  else{
   const bytes=Uint8Array.from(atob(template.artwork.model.dataUrl.split(',')[1]),c=>c.charCodeAt(0));
   const {readModelFile}=await import('./modelImport');const model=await readModelFile(new File([bytes],template.artwork.model.name));
   if(model.sizeMm.some((n,i)=>Math.abs(n-template.artwork.model.sizeMm[i])>1e-4)||model.sourceOffsetM.some((n,i)=>Math.abs(n-template.artwork.model.sourceOffsetM[i])>1e-7))throw new Error('라이브러리 3D 모델의 원본 범위가 일치하지 않습니다.');
  }
  items.push({template,thumbnail:item.thumbnail,archived:item.archived});
 }
 return {format:'gonggan-artwork-library',schemaVersion:1,items};
}
