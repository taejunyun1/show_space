import type {PdfFilledRect} from './pdfFilledRects';
import type {WallCandidate} from './wallCandidates';
/** A candidate pass from a repeated neutral fill style. Color alone is not wall
 * semantics; the ordinary topology/dimension checks still control adoption. */
export function vectorWallBands(rects:PdfFilledRect[],imageMaxDimension=2400):WallCandidate[]{
 const scale=imageMaxDimension/2400;if(!Number.isFinite(scale)||scale<=0)return [];
 const groups=new Map<string,PdfFilledRect[]>();
 for(const r of rects){const rgb=[1,3,5].map(i=>parseInt(r.color.slice(i,i+2),16)),short=Math.min(r.width,r.height),long=Math.max(r.width,r.height);
  if(Math.max(...rgb)-Math.min(...rgb)>8||rgb[0]<40||rgb[0]>210||short<8*scale||short>60*scale||long/short<1.2)continue;
  groups.set(r.color,[...(groups.get(r.color)??[]),r]);
 }
 const eligible=[...groups.values()].filter(g=>g.filter(r=>Math.max(r.width,r.height)/Math.min(r.width,r.height)>4).length>=4&&g.some(r=>r.width>r.height*4)&&g.some(r=>r.height>r.width*4));
 if(eligible.length!==1)return [];
 const lines:WallCandidate[]=eligible[0].map(r=>({id:r.id,start:r.width>r.height?{x:r.x,y:r.y+r.height/2}:{x:r.x+r.width/2,y:r.y},end:r.width>r.height?{x:r.x+r.width,y:r.y+r.height/2}:{x:r.x+r.width/2,y:r.y+r.height},thicknessPx:Math.min(r.width,r.height)}));
 // Merge only overlapping/touching rectangles on the exact same centerline.
 for(let i=0;i<lines.length;i++)for(let j=i+1;j<lines.length;j++){
  const a=lines[i],b=lines[j],horizontal=a.start.y===a.end.y,along=horizontal?'x':'y',cross=horizontal?'y':'x';
  if(Math.abs(a.start[cross]-b.start[cross])>1e-4||Math.abs(b.end[cross]-a.start[cross])>1e-4||Math.abs(a.thicknessPx-b.thicknessPx)>1e-4||Math.max(a.start[along],b.start[along])>Math.min(a.end[along],b.end[along])+1e-4)continue;
  a.start[along]=Math.min(a.start[along],b.start[along]);a.end[along]=Math.max(a.end[along],b.end[along]);lines.splice(j--,1);i=-1;break;
 }
 return lines;
}
