import type {WallCandidate} from './wallCandidates';
/** Only capped, unambiguous parallel outlines qualify. Proximity alone never merges two walls. */
export function pairWallEdges(lines:WallCandidate[]):WallCandidate[]{
 const proposals:{a:number;b:number;caps:number[];wall:WallCandidate}[]=[];
 for(let i=0;i<lines.length;i++)for(let j=i+1;j<lines.length;j++){
  const a=lines[i],b=lines[j];
  const dx=a.end.x-a.start.x,dy=a.end.y-a.start.y,length=Math.hypot(dx,dy);
  if(!Number.isFinite(length)||length<60)continue;
  // Project onto the observed edge, so the same evidence rules also apply to
  // rotated drawings. Canonical direction makes reversed endpoints equivalent.
  const sign=dx<0||(Math.abs(dx)<1e-8&&dy<0)?-1:1;
  const ux=sign*dx/length,uy=sign*dy/length;
  const along=(p:{x:number;y:number})=>p.x*ux+p.y*uy,across=(p:{x:number;y:number})=>-p.x*uy+p.y*ux;
  if(Math.abs(across(a.start)-across(a.end))>=1||Math.abs(across(b.start)-across(b.end))>=1)continue;
  const a0=Math.min(along(a.start),along(a.end)),a1=Math.max(along(a.start),along(a.end)),b0=Math.min(along(b.start),along(b.end)),b1=Math.max(along(b.start),along(b.end));
  const gap=Math.abs(across(a.start)-across(b.start));
  if(gap<6||gap>80||a1-a0<Math.max(60,gap*6)||Math.abs(a0-b0)>3||Math.abs(a1-b1)>3||a.thicknessPx>gap/3||b.thicknessPx>gap/3)continue;
  const low=Math.min(across(a.start),across(b.start)),high=Math.max(across(a.start),across(b.start));
  const caps=[a0,a1].map(position=>lines.flatMap((l,k)=>k!==i&&k!==j&&Math.abs(along(l.start)-along(l.end))<1&&Math.abs(along(l.start)-position)<=3&&Math.abs(Math.min(across(l.start),across(l.end))-low)<=3&&Math.abs(Math.max(across(l.start),across(l.end))-high)<=3?[k]:[]));
  if(caps.some(c=>c.length!==1)||caps[0][0]===caps[1][0])continue;
  const cross=(low+high)/2,point=(n:number)=>({x:n*ux-cross*uy,y:n*uy+cross*ux});
  proposals.push({a:i,b:j,caps:caps.flat(),wall:{id:`paired:${i}:${j}`,start:point((a0+b0)/2),end:point((a1+b1)/2),thicknessPx:gap+(a.thicknessPx+b.thicknessPx)/2}});
 }
 const indices=(p:typeof proposals[number])=>[p.a,p.b,...p.caps];
 const accepted=proposals.filter((p,i)=>!proposals.some((q,j)=>i!==j&&indices(p).some(n=>indices(q).includes(n))));
 const used=new Set(accepted.flatMap(indices));
 return [...lines.filter((_,i)=>!used.has(i)),...accepted.map(p=>p.wall)];
}
