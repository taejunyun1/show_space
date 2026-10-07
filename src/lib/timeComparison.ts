import {timeComparisonFrames,type TimeComparisonFrame,type TimeComparisonOptions} from '../domain/timeComparison';
import type {Project} from '../domain/types';
import type {PdfCurrentCamera} from './pdfRender3d';
export type ComparisonRenderer=(frame:TimeComparisonFrame,camera?:PdfCurrentCamera)=>Promise<Uint8Array>;
let rendering:Promise<unknown>=Promise.resolve();
/** Render serially so only one temporary WebGL renderer is alive at a time. */
export async function renderTimeComparison(project:Project,options:TimeComparisonOptions,camera:PdfCurrentCamera|undefined,signal:AbortSignal,onFrame:(frame:TimeComparisonFrame,png:Uint8Array,index:number)=>void,render?:ComparisonRenderer){
 const frames=timeComparisonFrames(project,options);
 signal.throwIfAborted();
 const renderer=render??(async(frame,current)=>{const {renderPdf3d}=await import('./pdfRender3d');return renderPdf3d({project:frame.project,name:frame.name,kind:'3d',current:true},current?{...current,fit:true}:undefined,1024);});
 for(const [index,frame] of frames.entries()){
  signal.throwIfAborted();
  // Cancellation cannot interrupt an active image decode/GPU render. A replacement job
  // waits for its disposal rather than starting another renderer in parallel.
  const pending=rendering.catch(()=>{}).then(()=>{signal.throwIfAborted();return renderer(frame,camera);});
  rendering=pending.then(()=>{},()=>{});
  const png=await pending;signal.throwIfAborted();onFrame(frame,png,index);
 }
}
