import type {WallCandidate} from './wallCandidates';
/** Centerline intersections correct stroke-cap offsets without tilting walls or filling openings. */
export function alignRasterCorners(input:WallCandidate[]):WallCandidate[]{
 const proposals:{a:number;ae:'start'|'end';b:number;be:'start'|'end';point:{x:number;y:number}}[]=[];
 for(let i=0;i<input.length;i++)for(let j=i+1;j<input.length;j++){
  const a=input[i],b=input[j],ah=Math.abs(a.start.y-a.end.y)<.01,bh=Math.abs(b.start.y-b.end.y)<.01;
  if(a.thicknessPx<3||b.thicknessPx<3)continue;
  const aAxis=ah||Math.abs(a.start.x-a.end.x)<.01,bAxis=bh||Math.abs(b.start.x-b.end.x)<.01;
  let point:{x:number;y:number};
  if(aAxis&&bAxis){
   if(ah===bh)continue;
   point=ah?{x:b.start.x,y:a.start.y}:{x:a.start.x,y:b.start.y};
  }else{
   const ax=a.end.x-a.start.x,ay=a.end.y-a.start.y,bx=b.end.x-b.start.x,by=b.end.y-b.start.y,den=ax*by-ay*bx;
   if(Math.abs(den)<.2*Math.hypot(ax,ay)*Math.hypot(bx,by)||!den)continue;
   const t=((b.start.x-a.start.x)*by-(b.start.y-a.start.y)*bx)/den;
   point={x:a.start.x+t*ax,y:a.start.y+t*ay};
  }
  const aTolerance=Math.min(12,Math.max(4,b.thicknessPx/2+2)),bTolerance=Math.min(12,Math.max(4,a.thicknessPx/2+2));
  for(const ae of ['start','end'] as const)for(const be of ['start','end'] as const){
   if(Math.hypot(a[ae].x-point.x,a[ae].y-point.y)<=aTolerance&&Math.hypot(b[be].x-point.x,b[be].y-point.y)<=bTolerance)proposals.push({a:i,ae,b:j,be,point});
  }
 }
 const targets=new Map<string,Set<string>>(),key=(p:{x:number;y:number})=>`${p.x},${p.y}`;
 for(const p of proposals)for(const endpoint of [`${p.a}:${p.ae}`,`${p.b}:${p.be}`]){const values=targets.get(endpoint)??new Set();values.add(key(p.point));targets.set(endpoint,values);}
 const result=input.map(l=>({...l,start:{...l.start},end:{...l.end}}));
 for(const p of proposals){if(targets.get(`${p.a}:${p.ae}`)!.size!==1||targets.get(`${p.b}:${p.be}`)!.size!==1)continue;result[p.a][p.ae]={...p.point};result[p.b][p.be]={...p.point};}
 // Never collapse an entire short segment through endpoint correction.
 if(result.some(l=>Math.hypot(l.end.x-l.start.x,l.end.y-l.start.y)<1))return input.map(l=>({...l,start:{...l.start},end:{...l.end}}));
 return result;
}
