import type {Matrix6} from './pdfImagePlacements';
export interface PdfFilledRect {id:string;color:string;x:number;y:number;width:number;height:number}
const multiply=(a:Matrix6,b:Matrix6):Matrix6=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
/** PDF.js 6 compact DrawOPS. Read BEFORE rendering mutates arrays into Path2D.
 * Only simple axis-aligned filled rectangles are accepted, never curve bounds. */
export function pdfFilledRects(ops:{fnArray:number[];argsArray:unknown[][]},codes:Record<string,number>,viewport:Matrix6):PdfFilledRect[]{
 if(ops.fnArray.length>100000)return [];
 let state={matrix:viewport.slice() as Matrix6,color:'#000000',unsafe:false};const stack:typeof state[]=[],result:PdfFilledRect[]=[];
 for(let i=0;i<ops.fnArray.length&&i<100000;i++){
  const op=ops.fnArray[i],args=ops.argsArray[i]??[];
  if(op===codes.save){stack.push({...state,matrix:state.matrix.slice() as Matrix6});}
  else if(op===codes.restore){state=stack.pop()??{matrix:viewport.slice() as Matrix6,color:'#000000',unsafe:true};}
  else if(op===codes.transform){if(args.length===6&&args.every(Number.isFinite))state.matrix=multiply(state.matrix,args as Matrix6);else state.unsafe=true;}
  else if(op===codes.setFillRGBColor){state.color=typeof args[0]==='string'?args[0]:'';}
  else if([codes.clip,codes.eoClip,codes.setGState,codes.beginGroup,codes.paintFormXObjectBegin,codes.beginMarkedContentProps,codes.setFillColorN,codes.setFillTransparent].includes(op)){state.unsafe=true;}
  else if(op===codes.constructPath&&!state.unsafe&&[codes.fill,codes.eoFill].includes(args[0] as number)&&/^#[0-9a-f]{6}$/i.test(state.color)){
   const data=(args[1] as unknown[])?.[0];if(!Array.isArray(data)&&!ArrayBuffer.isView(data))continue;
   const path=Array.from(data as ArrayLike<number>);if(path.length!==13||path[0]!==0||path[3]!==1||path[6]!==1||path[9]!==1||path[12]!==4||!path.every(Number.isFinite))continue;
   const m=state.matrix,points=[1,4,7,10].map(j=>({x:m[0]*path[j]+m[2]*path[j+1]+m[4],y:m[1]*path[j]+m[3]*path[j+1]+m[5]}));
   if(points.some((p,j)=>{const q=points[(j+1)%4];return Math.min(Math.abs(p.x-q.x),Math.abs(p.y-q.y))>1e-5||Math.hypot(p.x-q.x,p.y-q.y)<1e-5;}))continue;
   if(new Set(points.map(p=>`${p.x},${p.y}`)).size!==4)continue;
   const xs=points.map(p=>p.x),ys=points.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys),width=Math.max(...xs)-x,height=Math.max(...ys)-y;
   if(![x,y,width,height].every(Number.isFinite)||Math.max(Math.abs(x),Math.abs(y),width,height)>1e6)continue;
   if(points.some(p=>!((Math.abs(p.x-x)<1e-5||Math.abs(p.x-x-width)<1e-5)&&(Math.abs(p.y-y)<1e-5||Math.abs(p.y-y-height)<1e-5))))continue;
   result.push({id:`pdf-rect:${i}`,color:state.color.toLowerCase(),x,y,width,height});if(result.length>=3000)return [];
  }
 }
 return result;
}
/** Corroborate the interior against the final composited page. This is sampled
 * visibility, not proof that every pixel or physical wall is present. */
export function visibleFilledRects(rects:PdfFilledRect[],pixels:Uint8ClampedArray,width:number,height:number){
 if(pixels.length!==width*height*4)return [];
 return rects.filter(r=>{
  if(r.x<0||r.y<0||r.x+r.width>width||r.y+r.height>height||Math.min(r.width,r.height)<3)return false;
  const rgb=[1,3,5].map(i=>parseInt(r.color.slice(i,i+2),16));let matched=0;
  for(let y=1;y<=9;y++)for(let x=1;x<=9;x++){const index=(Math.floor(r.y+r.height*y/10)*width+Math.floor(r.x+r.width*x/10))*4;if(pixels[index+3]===255&&rgb.every((v,c)=>Math.abs(v-pixels[index+c])<=12))matched++;}
  return matched>=78;
 });
}
