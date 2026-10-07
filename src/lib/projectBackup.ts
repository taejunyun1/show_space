import {artPanel} from './art';
import {exportProjectPackage,importProjectPackage,projectImageUrls,projectVideos,PROJECT_PACKAGE_MAX_BYTES} from './projectPackage';
import type {Project} from '../domain/types';

async function image(url:string){
 return new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();const fail=()=>{clearTimeout(timer);img.onload=null;img.onerror=null;img.src='';reject(new Error('백업 이미지를 읽지 못했습니다. 파일을 확인해주세요.'));};const timer=setTimeout(fail,15000);
  img.onload=()=>{clearTimeout(timer);img.onload=null;img.onerror=null;if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth*img.naturalHeight>60_000_000){reject(new Error('백업 이미지는 6천만 픽셀 이하여야 합니다.'));return;}resolve(img);};img.onerror=fail;img.src=url;
 });
}
async function sampleImage(url:string){
 const panel=artPanel(url);if(panel===null)throw new Error('예제 작품 경로가 올바르지 않습니다.');
 const img=await image(url),canvas=document.createElement('canvas');canvas.width=Math.round(img.naturalWidth/5);canvas.height=img.naturalHeight;
 const context=canvas.getContext('2d');if(!context)throw new Error('예제 작품을 백업하지 못했습니다.');
 context.drawImage(img,panel*img.naturalWidth/5,0,img.naturalWidth/5,img.naturalHeight,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/png');
}
/** Historical name retained for restore callers; verifies every browser media asset. */
export async function verifyProjectBackupImages(project:Project,onProgress:(message:string)=>void=()=>{}){
 const urls=projectImageUrls(project);for(const [i,url] of urls.entries()){onProgress(`이미지 확인 중 · ${i+1}/${urls.length}`);await image(url);}
 const videos=projectVideos(project);if(videos.length){const {verifyVideoArtwork}=await import('./videoArtworkImport');for(const [i,video] of videos.entries()){onProgress(`영상 확인 중 · ${i+1}/${videos.length}`);await verifyVideoArtwork(video);}}
}
export async function exportProjectBackup(project:Project,onProgress:(message:string)=>void=()=>{}){await verifyProjectBackupImages(project,onProgress);return exportProjectPackage(project,sampleImage,onProgress);}
export async function readProjectBackup(file:File,onProgress:(message:string)=>void=()=>{}){if(file.size>PROJECT_PACKAGE_MAX_BYTES)throw new Error('프로젝트 백업은 80MB 이하로 선택해주세요.');const project=await importProjectPackage(await file.arrayBuffer(),onProgress);await verifyProjectBackupImages(project,onProgress);return project;}
