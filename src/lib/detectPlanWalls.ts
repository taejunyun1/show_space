import DetectionWorker from './wallDetection.worker?worker';
import type {WallCandidate} from '../domain/wallCandidates';
export async function detectPlanWalls(imageUrl:string,threshold:number,minLengthRatio:number,signal:AbortSignal,minThicknessPx=2,maxCandidates=100):Promise<WallCandidate[]>{
 const image=new Image();image.src=imageUrl;await image.decode();if(signal.aborted)throw new Error('취소됨');
 const scale=Math.min(1,1400/Math.max(image.naturalWidth,image.naturalHeight));
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
 const xScale=image.naturalWidth/canvas.width,yScale=image.naturalHeight/canvas.height;
 try{const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw new Error('이미지를 분석할 수 없습니다.');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
 return await new Promise<WallCandidate[]>((resolve,reject)=>{const worker=new DetectionWorker();let timer:ReturnType<typeof setTimeout>;const cleanup=()=>{clearTimeout(timer);worker.terminate();signal.removeEventListener('abort',abort);};const abort=()=>{cleanup();reject(new Error('취소됨'));};signal.addEventListener('abort',abort,{once:true});timer=setTimeout(()=>{cleanup();reject(new Error('분석 시간이 초과했습니다. 영역을 더 작게 잘라주세요.'));},20000);
 worker.onmessage=event=>{cleanup();if(event.data.error){reject(new Error(event.data.error));return;}resolve(event.data.candidates.map((c:WallCandidate)=>({...c,start:{x:c.start.x*xScale,y:c.start.y*yScale},end:{x:c.end.x*xScale,y:c.end.y*yScale},thicknessPx:c.thicknessPx*Math.max(xScale,yScale),...(c.solidSupportThicknessPx===undefined?{}:{solidSupportThicknessPx:c.solidSupportThicknessPx*Math.max(xScale,yScale)})})));};worker.onerror=()=>{cleanup();reject(new Error('도면 분석 중 오류가 발생했습니다.'));};if(signal.aborted){abort();return;}worker.postMessage({data:pixels.data.buffer,width:canvas.width,height:canvas.height,threshold,minThicknessPx,maxCandidates,minLengthPx:Math.max(10,Math.round(Math.max(canvas.width,canvas.height)*minLengthRatio))},[pixels.data.buffer]);});
 }finally{canvas.width=canvas.height=0;image.src='';}
}
