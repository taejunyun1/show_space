import { transformPlanLabels } from '../domain/planLabels';
import type {PlanPage} from './planImport';
export interface PixelPoint{x:number;y:number}
export interface CropRect{x:number;y:number;width:number;height:number}
export function rotatedSize(width:number,height:number,rotation:number){
 if(![0,90,180,270].includes(rotation)||![width,height].every(n=>Number.isFinite(n)&&n>0))throw new Error('회전 각도 또는 이미지 크기가 올바르지 않습니다.');
 return rotation%180?{width:height,height:width}:{width,height};
}
export function cropRect(a:PixelPoint,b:PixelPoint,width:number,height:number):CropRect{
 if(![a.x,a.y,b.x,b.y,width,height].every(Number.isFinite)||width<=0||height<=0)throw new Error('영역 좌표가 올바르지 않습니다.');
 const x=Math.max(0,Math.floor(Math.min(a.x,b.x))),y=Math.max(0,Math.floor(Math.min(a.y,b.y)));
 const right=Math.min(width,Math.ceil(Math.max(a.x,b.x))),bottom=Math.min(height,Math.ceil(Math.max(a.y,b.y)));
 if(right-x<10||bottom-y<10)throw new Error('가로·세로 10픽셀 이상의 영역을 선택하세요.');
 return {x,y,width:right-x,height:bottom-y};
}
export async function transformPlan(page:PlanPage,rotation:number,crop?:CropRect):Promise<PlanPage>{
 const size=rotatedSize(page.widthPx,page.heightPx,rotation);
 if(crop&&(![crop.x,crop.y,crop.width,crop.height].every(Number.isFinite)||crop.x<0||crop.y<0||crop.width<10||crop.height<10||crop.x+crop.width>size.width||crop.y+crop.height>size.height))throw new Error('선택 영역은 이미지 안에 있어야 하며 가로·세로 10픽셀 이상이어야 합니다.');
 const region=crop?cropRect({x:crop.x,y:crop.y},{x:crop.x+crop.width,y:crop.y+crop.height},size.width,size.height):{x:0,y:0,...size};
 const img=new Image();img.src=page.imageUrl;await img.decode();
 const canvas=document.createElement('canvas');canvas.width=region.width;canvas.height=region.height;
 try{const ctx=canvas.getContext('2d');if(!ctx)throw new Error('도면 변환을 지원하지 않습니다.');
 ctx.translate(-region.x,-region.y);if(rotation===90)ctx.translate(page.heightPx,0);if(rotation===180)ctx.translate(page.widthPx,page.heightPx);if(rotation===270)ctx.translate(0,page.widthPx);ctx.rotate(rotation*Math.PI/180);ctx.drawImage(img,0,0);
 const imageUrl=canvas.toDataURL('image/png');if(imageUrl.length>12*1024*1024)throw new Error('변환 이미지가 저장 한도를 초과합니다. 더 작은 영역을 선택하세요.');
 return {imageUrl,widthPx:region.width,heightPx:region.height,labels:page.labels?transformPlanLabels(page.labels,page.widthPx,page.heightPx,rotation as 0|90|180|270,region):undefined,textSource:page.textSource,diagnostics:page.diagnostics?{warnings:[...page.diagnostics.warnings,...(crop?['품질 안내는 자르기 전 페이지 기준입니다. 선택 영역의 치수를 다시 확인하세요.']:[])]}:undefined};
 }finally{canvas.width=canvas.height=0;img.src='';}
}
