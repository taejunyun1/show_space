import {parseMaterialTemplate,type MaterialTemplate} from '../domain/materialLibrary';
import {MATERIAL_LIBRARY_MAX_BYTES,MATERIAL_LIBRARY_MAX_ITEMS,type MaterialLibraryBackup} from './materialLibrary';
import {libraryImageBytes} from '../domain/artworkLibrary';
async function decodeMaterialImage(imageUrl:string){
 return new Promise<HTMLImageElement>((resolve,reject)=>{
  const img=new Image(),fail=()=>{clearTimeout(timer);img.onload=null;img.onerror=null;img.src='';reject(new Error('재질 이미지를 읽지 못했습니다.'));},timer=setTimeout(fail,15000);
  img.onload=()=>{clearTimeout(timer);img.onload=null;img.onerror=null;resolve(img);};img.onerror=fail;img.src=imageUrl;
 });
}
export async function materialThumbnail(input:MaterialTemplate){
 const template=parseMaterialTemplate(input),texture=template.material.texture??template.material.normal;
 if(!texture)return;
 const image=await decodeMaterialImage(texture.imageUrl);
 const scale=Math.min(1,256/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');
 canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('재질 썸네일을 만들지 못했습니다.');ctx.drawImage(image,0,0,canvas.width,canvas.height);
 const thumbnail=canvas.toDataURL('image/webp',.85);libraryImageBytes(thumbnail,128*1024,256);return thumbnail;
}
/** Fully decode texture assets before the single atomic database restore. */
export async function readMaterialLibraryBackup(file:File):Promise<MaterialLibraryBackup>{
 if(file.size>MATERIAL_LIBRARY_MAX_BYTES)throw new Error('재질 백업은 32MB 이하여야 합니다.');
 const value=JSON.parse(await file.text()) as MaterialLibraryBackup;
 if(!value||value.format!=='gonggan-material-library'||value.schemaVersion!==1||!Array.isArray(value.items)||!value.items.length||value.items.length>MATERIAL_LIBRARY_MAX_ITEMS)throw new Error('재질 라이브러리 백업 파일을 선택하세요.');
 const items:MaterialLibraryBackup['items']=[];
 for(const item of value.items){
  if(typeof item?.archived!=='boolean')throw new Error('재질 보관 상태가 올바르지 않습니다.');
  const template=parseMaterialTemplate(item.template);if(template.material.texture&&template.material.normal)await decodeMaterialImage(template.material.normal.imageUrl);const thumbnail=await materialThumbnail(template);items.push({template,archived:item.archived,...(thumbnail?{thumbnail}:{})});
 }
 return {format:'gonggan-material-library',schemaVersion:1,items};
}
