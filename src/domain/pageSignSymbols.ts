import {matchFireHoseSymbol} from './signSymbols';
export interface PageSignSymbol {box:{x:number;y:number;width:number;height:number};symbol:NonNullable<ReturnType<typeof matchFireHoseSymbol>>}
/** Locate compact red panels before template comparison. Red CAD strokes and
 * furniture remain candidates only; color alone never assigns equipment. */
export function redSignPanels(data:Uint8ClampedArray,width:number,height:number):PageSignSymbol['box'][] {
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>2400||height>2400||data.length!==width*height*4)throw new Error('표지 분석 이미지 크기가 올바르지 않습니다.');
 const mask=new Uint8Array(width*height);let redCount=0;
 for(let i=0;i<mask.length;i++)if(data[i*4+3]>=250&&data[i*4]>150&&data[i*4]-data[i*4+1]>70&&data[i*4]-data[i*4+2]>70){mask[i]=1;redCount++;}
 const queue=new Int32Array(redCount),candidates:PageSignSymbol['box'][]=[];
 for(let i=0;i<mask.length;i++){
  if(mask[i]!==1)continue;
  let read=0,end=1;queue[0]=i;mask[i]=2;
  let left=i%width,right=left,top=Math.floor(i/width),bottom=top;
  while(read<end){
   const p=queue[read++],x=p%width,y=Math.floor(p/width);
   left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
   for(const q of [x>0?p-1:-1,x<width-1?p+1:-1,y>0?p-width:-1,y<height-1?p+width:-1])if(q>=0&&mask[q]===1){mask[q]=2;queue[end++]=q;}
  }
  const w=right-left+1,h=bottom-top+1;
  // Rasterization can connect the icon panel to its caption with a one-pixel
  // red bridge. Accept either the square icon or the complete portrait panel.
  const ratio=h/w,shape=(ratio>=.85&&ratio<=1.15)||(ratio>=1.35&&ratio<=1.7);
  // This is only a candidate filter: thin outer red frames lose a row under
  // different rasterizers. The complete cropped symbol is checked below.
  if(w>=24&&w<=240&&shape&&end/(w*h)>=.25)candidates.push({x:left,y:top,width:w,height:h});
 }
 return candidates;
}
export function pageSignSymbols(data:Uint8ClampedArray,width:number,height:number):PageSignSymbol[]{
 const candidates=redSignPanels(data,width,height),results:PageSignSymbol[]=[];
 for(const b of candidates.sort((a,b)=>b.width*b.height-a.width*a.height).slice(0,200)){
  let best:PageSignSymbol|undefined;
  for(const pad of new Set([0,.02,.04,.06,.08,.1].map(r=>Math.round(b.width*r))))for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
   const x=b.x-pad+dx,y=b.y-pad+dy,w=b.width+pad*2,h=Math.round(w*1.455);
   if(x<0||y<0||x+w>width||y+h>height)continue;
   // The visible lower red caption panel corroborates a complete sign.
   let footerRed=0,footerCount=0;
   for(let sy=Math.ceil(h*.74);sy<h*.95;sy++)for(let sx=Math.ceil(w*.1);sx<w*.9;sx++){footerCount++;const i=((y+sy)*width+x+sx)*4;if(data[i+3]>=250&&data[i]>150&&data[i]-data[i+1]>70&&data[i]-data[i+2]>70)footerRed++;}
   if(!footerCount||footerRed/footerCount<.4)continue;
   const crop=new Uint8ClampedArray(w*h*4);
   for(let row=0;row<h;row++)crop.set(data.subarray(((y+row)*width+x)*4,((y+row)*width+x+w)*4),row*w*4);
   const symbol=matchFireHoseSymbol(crop,w,h);
   if(symbol&&(!best||symbol.similarity>best.symbol.similarity))best={box:{x,y,width:w,height:h},symbol};
  }
  if(best&&!results.some(r=>{
   const a=r.box,b=best!.box,overlap=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
   return overlap/Math.min(a.width*a.height,b.width*b.height)>.5;
  }))results.push(best);
  if(results.length===50)break;
 }
 return results;
}
