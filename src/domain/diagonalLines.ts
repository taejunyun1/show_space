import type {WallCandidate} from './wallCandidates';
/** Fit straight, elongated connected ink components after removing known axis
 * stripes. Connectivity preserves real gaps; a fit never joins separate islands. */
export function detectDiagonalLines(dark:Uint8Array,width:number,height:number,axis:WallCandidate[],minLength:number,minThickness:number):WallCandidate[]{
 const ink=dark.slice();
 for(const line of axis){
  if(line.thicknessPx<3)continue;
  const horizontal=line.start.y===line.end.y;
  const x0=Math.max(0,Math.floor(Math.min(line.start.x,line.end.x)-(horizontal?0:line.thicknessPx/2)));
  const x1=Math.min(width,Math.ceil(Math.max(line.start.x,line.end.x)+(horizontal?0:line.thicknessPx/2)));
  const y0=Math.max(0,Math.floor(Math.min(line.start.y,line.end.y)-(horizontal?line.thicknessPx/2:0)));
  const y1=Math.min(height,Math.ceil(Math.max(line.start.y,line.end.y)+(horizontal?line.thicknessPx/2:0)));
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)ink[y*width+x]=0;
 }
 const result:WallCandidate[]=[];
 for(let seed=0;seed<ink.length;seed++){
  if(!ink[seed])continue;
  const pixels=[seed];ink[seed]=0;
  let sx=0,sy=0,sxx=0,syy=0,sxy=0;
  for(let cursor=0;cursor<pixels.length;cursor++){
   const index=pixels[cursor],x=index%width,y=Math.floor(index/width);
   sx+=x+.5;sy+=y+.5;sxx+=(x+.5)**2;syy+=(y+.5)**2;sxy+=(x+.5)*(y+.5);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=width||ny>=height)continue;
    const next=ny*width+nx;if(ink[next]){ink[next]=0;pixels.push(next);}
   }
  }
  if(pixels.length<minLength*minThickness)continue;
  const n=pixels.length,cx=sx/n,cy=sy/n,xx=sxx/n-cx*cx,yy=syy/n-cy*cy,xy=sxy/n-cx*cy;
  const angle=.5*Math.atan2(2*xy,xx-yy),ux=Math.cos(angle),uy=Math.sin(angle);
  // Axis lines remain the responsibility of the stripe detector.
  if(Math.min(Math.abs(ux),Math.abs(uy))<.05)continue;
  const major=(xx+yy+Math.hypot(xx-yy,2*xy))/2,minor=(xx+yy-Math.hypot(xx-yy,2*xy))/2;
  if(major<40*Math.max(minor,.1))continue;
  let lo=Infinity,hi=-Infinity,maxAcross=0;
  const projected=pixels.map(index=>{
   const x=index%width+.5-cx,y=Math.floor(index/width)+.5-cy,t=x*ux+y*uy;
   lo=Math.min(lo,t);hi=Math.max(hi,t);maxAcross=Math.max(maxAcross,Math.abs(-x*uy+y*ux));return t;
  });
  const length=hi-lo+1,thickness=n/length;
  if(length<Math.max(30,minLength,thickness*8)||thickness<minThickness||maxAcross>thickness/2+1.5)continue;
  const bins=new Uint8Array(Math.floor((hi-lo)/2)+1);for(const t of projected)bins[Math.min(bins.length-1,Math.floor((t-lo)/2))]=1;
  if(bins.some(value=>!value))continue;
  const point=(t:number)=>({x:Math.max(0,Math.min(width,cx+ux*t)),y:Math.max(0,Math.min(height,cy+uy*t))});
  result.push({id:`diagonal:${seed}`,start:point(lo),end:point(hi),thicknessPx:thickness});
 }
 return result;
}
