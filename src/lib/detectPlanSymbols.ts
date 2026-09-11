import SymbolWorker from './signDetection.worker?worker';
import type {PageSignSymbol} from '../domain/pageSignSymbols';
export async function detectPlanSymbols(imageUrl:string,signal:AbortSignal):Promise<PageSignSymbol[]>{
 const image=new Image();let canvas:HTMLCanvasElement|undefined;
 try{
  if(signal.aborted)throw new Error('표지 분석을 취소했습니다.');
  image.src=imageUrl;await image.decode();if(signal.aborted)throw new Error('표지 분석을 취소했습니다.');
  const scale=Math.min(1,2400/Math.max(image.naturalWidth,image.naturalHeight));
  canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw new Error('표지 분석 이미지를 만들 수 없습니다.');
  ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),sx=image.naturalWidth/canvas.width,sy=image.naturalHeight/canvas.height;
  return await new Promise((resolve,reject)=>{
   const worker=new SymbolWorker();let timer:ReturnType<typeof setTimeout>;
   const cleanup=()=>{clearTimeout(timer);worker.terminate();signal.removeEventListener('abort',abort);};
   const fail=(message:string)=>{cleanup();reject(new Error(message));};
   const abort=()=>fail('표지 분석을 취소했습니다.');
   signal.addEventListener('abort',abort,{once:true});timer=setTimeout(()=>fail('표지 분석 시간이 초과됐습니다.'),20000);
   worker.onerror=()=>fail('표지 분석 엔진을 실행하지 못했습니다.');
   worker.onmessage=(event:MessageEvent<{error?:string;symbols:PageSignSymbol[]}>)=>{
    if(event.data.error){fail(event.data.error);return;}cleanup();
    resolve(event.data.symbols.map(s=>({...s,box:{x:s.box.x*sx,y:s.box.y*sy,width:s.box.width*sx,height:s.box.height*sy}})));
   };
   if(signal.aborted){abort();return;}
   worker.postMessage({data:pixels.data.buffer,width:canvas!.width,height:canvas!.height},[pixels.data.buffer]);
  });
 }finally{image.src='';if(canvas)canvas.width=canvas.height=0;}
}
