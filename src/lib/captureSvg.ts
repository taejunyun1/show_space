import {artPanel} from './art';

export interface CaptureRatio {width:number;height:number}
export interface CaptureOptions {longEdge:1920|2560|3840;aspectRatio?:CaptureRatio;includeDimensions:boolean;includeGrid:boolean;includePlan:boolean}

export function capturePixelSize(width:number,height:number,longEdge:number,aspectRatio?:CaptureRatio){
 if(![width,height,longEdge].every(Number.isFinite)||width<=0||height<=0||longEdge<1||longEdge>8192)throw new Error('캡처 해상도가 올바르지 않습니다.');
 if(aspectRatio){
  if(![aspectRatio.width,aspectRatio.height].every(n=>Number.isFinite(n)&&n>=1&&n<=10000))throw new Error('사용자 지정 비율은 1~10,000 사이의 숫자로 입력해 주세요.');
  width=aspectRatio.width;height=aspectRatio.height;
 }
 const scale=longEdge/Math.max(width,height);
 return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
}

/** Fit the complete source into the output without cropping or changing its proportions. */
export function captureFit(source:CaptureRatio,target:CaptureRatio){
 if(![source.width,source.height,target.width,target.height].every(n=>Number.isFinite(n)&&n>0))throw new Error('캡처 화면 크기가 올바르지 않습니다.');
 const scale=Math.min(target.width/source.width,target.height/source.height);
 const width=source.width*scale,height=source.height*scale;
 return {x:(target.width-width)/2,y:(target.height-height)/2,width,height,scale};
}

function loadImage(src:string):Promise<HTMLImageElement>{
 return new Promise((resolve,reject)=>{
  const image=new Image();
  image.crossOrigin='anonymous';
  image.onload=()=>resolve(image);
  image.onerror=()=>reject(new Error('캡처에 필요한 작품 이미지를 읽지 못했습니다.'));
  image.src=src;
 });
}

async function replaceArtworkImages(clone:SVGSVGElement,pixelsPerUnit:number){
 for(const item of [...clone.querySelectorAll('foreignObject[data-artwork-url]')]){
  const url=item.getAttribute('data-artwork-url');
  const x=Number(item.getAttribute('x')),y=Number(item.getAttribute('y')),width=Number(item.getAttribute('width')),height=Number(item.getAttribute('height'));
  if(![x,y,width,height].every(Number.isFinite)||width<=0||height<=0)throw new Error('캡처 작품 이미지 위치가 올바르지 않습니다.');
  if(!url){const placeholder=document.createElementNS('http://www.w3.org/2000/svg','rect');placeholder.setAttribute('x',String(x));placeholder.setAttribute('y',String(y));placeholder.setAttribute('width',String(width));placeholder.setAttribute('height',String(height));placeholder.setAttribute('fill','#eee8dc');item.replaceWith(placeholder);continue;}
  const source=await loadImage(url),panel=artPanel(url);
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.min(2048,Math.round(width*pixelsPerUnit)));canvas.height=Math.max(1,Math.min(2048,Math.round(height*pixelsPerUnit)));
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('캡처 이미지를 만들 수 없습니다.');
  const sourceWidth=panel===null?source.naturalWidth:source.naturalWidth/5;
  ctx.drawImage(source,panel===null?0:panel*sourceWidth,0,sourceWidth,source.naturalHeight,0,0,canvas.width,canvas.height);
  const image=document.createElementNS('http://www.w3.org/2000/svg','image');
  image.setAttribute('x',String(x));image.setAttribute('y',String(y));image.setAttribute('width',String(width));image.setAttribute('height',String(height));
  image.setAttribute('href',canvas.toDataURL('image/png'));image.setAttribute('preserveAspectRatio','none');
  item.replaceWith(image);
 }
}

function inlineStyles(source:SVGSVGElement,clone:SVGSVGElement){
 const originals=[source,...source.querySelectorAll('*')],copies=[clone,...clone.querySelectorAll('*')];
 const properties=['font-family','font-size','font-weight','fill','stroke','stroke-width','stroke-dasharray','opacity','text-anchor','paint-order'];
 originals.forEach((original,index)=>{
  const copy=copies[index] as Element | undefined;if(!copy)return;
  const style=getComputedStyle(original);
  for(const name of properties){const value=style.getPropertyValue(name);if(value)(copy as HTMLElement).style.setProperty(name,value);}
 });
}

function toBlob(canvas:HTMLCanvasElement):Promise<Blob>{
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG 파일을 만들지 못했습니다.')),'image/png'));
}

export async function captureSvg(svg:SVGSVGElement,options:Omit<CaptureOptions,'longEdge'>&{longEdge:number}):Promise<Blob>{
 const box=svg.viewBox.baseVal;
 const size=capturePixelSize(box.width,box.height,options.longEdge,options.aspectRatio);
 const fit=captureFit({width:box.width,height:box.height},size);
 const clone=svg.cloneNode(true) as SVGSVGElement;
 inlineStyles(svg,clone);
 clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.setAttribute('width',String(size.width));clone.setAttribute('height',String(size.height));
 clone.setAttribute('preserveAspectRatio','xMidYMid meet');
 clone.querySelectorAll('.drag-handle,[data-capture-draft]').forEach(el=>el.remove());
 clone.querySelectorAll('g.draggable-art rect[stroke="#365cf5"],g.selectable rect[stroke="#365cf5"],.svg-dimensions.blue').forEach(el=>el.remove());
 clone.querySelectorAll<SVGElement>('line.selectable[stroke="#365cf5"]').forEach(el=>{el.setAttribute('stroke','#697789');el.style.stroke='#697789';});
 clone.querySelectorAll<SVGElement>('g.selectable rect[fill="#365cf5"]').forEach(el=>{el.setAttribute('fill','#c5ad8e');el.style.fill='#c5ad8e';});
 if(!options.includeDimensions)clone.querySelectorAll('text,.svg-dimensions,[aria-label="평면 치수선"],[aria-label="벽면 치수선"]').forEach(el=>el.remove());
 if(!options.includeGrid)clone.querySelectorAll<SVGElement>('rect[fill="url(#plan-grid)"]').forEach(el=>{el.setAttribute('fill','#ffffff');el.style.fill='#ffffff';});
 if(!options.includePlan)clone.querySelectorAll('image[data-source-plan]').forEach(el=>el.remove());
 await document.fonts.ready;
 await replaceArtworkImages(clone,fit.scale);
 const markup=new XMLSerializer().serializeToString(clone),blob=new Blob([markup],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob);
 try{
  const image=await loadImage(url),canvas=document.createElement('canvas');canvas.width=size.width;canvas.height=size.height;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('PNG 캔버스를 만들 수 없습니다.');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,size.width,size.height);ctx.drawImage(image,0,0,size.width,size.height);
  return await toBlob(canvas);
 }finally{URL.revokeObjectURL(url);}
}
