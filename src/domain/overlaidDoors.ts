import type {WallCandidate} from './wallCandidates';
import type {Wall} from './types';
export interface OverlaidDoor {id:string;band:WallCandidate;leaf:WallCandidate;brace:WallCandidate}
/** A filled closed-door mark plus an orthogonal open leaf and an internal brace.
 * Dark-pass geometry is retained separately from the wall pass that may cover it. */
export function detectOverlaidDoors(lines:WallCandidate[]):OverlaidDoor[]{
 const result:OverlaidDoor[]=[];
 for(const band of lines){
  const dx=band.end.x-band.start.x,dy=band.end.y-band.start.y,length=Math.hypot(dx,dy),thick=band.thicknessPx;
  if(Math.min(Math.abs(dx),Math.abs(dy))>1||thick<12||thick>50||length<60||length>300||length/thick<3||length/thick>10)continue;
  const u={x:dx/length,y:dy/length},v={x:-u.y,y:u.x};
  const along=(p:{x:number;y:number})=>(p.x-band.start.x)*u.x+(p.y-band.start.y)*u.y;
  const cross=(p:{x:number;y:number})=>(p.x-band.start.x)*v.x+(p.y-band.start.y)*v.y;
  const matches:{leaf:WallCandidate;brace:WallCandidate}[]=[];
  for(const leaf of lines){
   if(leaf.id===band.id||leaf.thicknessPx<4||leaf.thicknessPx>thick*.4)continue;
   const la=along(leaf.start),lb=along(leaf.end),at=(la+lb)/2;
   if(Math.abs(la-lb)>2||Math.min(Math.abs(at),Math.abs(at-length))>thick*.4)continue;
   const ca=cross(leaf.start),cb=cross(leaf.end),far=Math.abs(ca)>Math.abs(cb)?ca:cb,near=Math.abs(ca)<Math.abs(cb)?ca:cb;
   if(Math.abs(near)>thick/2+4||Math.abs(far)<length*.8||Math.abs(far)>length*1.3)continue;
   const direction=at<length/2?1:-1,side=Math.sign(far);
   const braces=lines.filter(line=>{
    if(line.id===band.id||line.id===leaf.id||line.thicknessPx>4)return false;
    const a={a:(along(line.start)-at)*direction,c:cross(line.start)*side},b={a:(along(line.end)-at)*direction,c:cross(line.end)*side};
    const onBand=a.c<b.c?a:b,onLeaf=a.c<b.c?b:a;
    return Math.abs(onBand.c-thick/2)<6&&onBand.a>length*.3&&onBand.a<length*.9&&Math.abs(onLeaf.a)<8&&onLeaf.c>length*.3&&onLeaf.c<length*.9;
   });
   if(braces.length===1)matches.push({leaf,brace:braces[0]});
  }
  if(matches.length===1)result.push({id:`overlaid-door:${band.id}`,band,...matches[0]});
 }
 return result.filter((d,i)=>!result.some((o,j)=>i!==j&&(d.leaf.id===o.leaf.id||d.brace.id===o.brace.id)));
}
/** Split only one collinear observed wall spanning the whole mark. A crossing wall
 * or an unresolved parallel boundary vetoes the split, rather than guessing jambs. */
export function applyOverlaidDoors(input:Wall[],doors:OverlaidDoor[]){
 let walls=input.slice();const gaps:{kind:'door';labelId:string;wall:Wall}[]=[];
 for(const door of doors){
  const {band}=door,dx=band.end.x-band.start.x,dy=band.end.y-band.start.y,length=Math.hypot(dx,dy);
  const along=(p:Wall['start'])=>((p.x-band.start.x)*dx+(p.z-band.start.y)*dy)/length;
  const across=(p:Wall['start'])=>Math.abs((p.x-band.start.x)*dy-(p.z-band.start.y)*dx)/length;
  const matches=walls.filter(w=>across(w.start)<4&&across(w.end)<4&&Math.min(along(w.start),along(w.end))< -8&&Math.max(along(w.start),along(w.end))>length+8);
  if(matches.length!==1)continue;
  const wall=matches[0];
  if(walls.some(w=>w.id!==wall.id&&across(w.start)<band.thicknessPx/2+2&&across(w.end)<band.thicknessPx/2+2&&Math.min(length,Math.max(along(w.start),along(w.end)))-Math.max(0,Math.min(along(w.start),along(w.end)))>length*.8))continue;
  const ordered=along(wall.start)<along(wall.end)?[wall.start,wall.end]:[wall.end,wall.start];
  const point=(t:number)=>({x:ordered[0].x+(ordered[1].x-ordered[0].x)*(t-along(ordered[0]))/(along(ordered[1])-along(ordered[0])),z:ordered[0].z+(ordered[1].z-ordered[0].z)*(t-along(ordered[0]))/(along(ordered[1])-along(ordered[0]))});
  const start=point(0),end=point(length);
  const matchesStroke=(w:Wall,l:WallCandidate)=>{
   const near=(a:Wall['start'],b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.z-b.y)<6;
   return (near(w.start,l.start)&&near(w.end,l.end))||(near(w.start,l.end)&&near(w.end,l.start));
  };
  const symbolIds=new Set(walls.filter(w=>matchesStroke(w,door.leaf)||matchesStroke(w,door.brace)).map(w=>w.id));
  const crossesGap=(w:Wall)=>{
   const ax=end.x-start.x,az=end.z-start.z,bx=w.end.x-w.start.x,bz=w.end.z-w.start.z,den=ax*bz-az*bx;
   if(Math.abs(den)<1e-8)return false;
   const px=w.start.x-start.x,pz=w.start.z-start.z,t=(px*bz-pz*bx)/den,u=(px*az-pz*ax)/den;
   return t>0&&t<1&&u>=0&&u<=1;
  };
  // Through-going or branching construction cannot be reclassified as a door symbol.
  if(walls.some(w=>w.id!==wall.id&&!symbolIds.has(w.id)&&(crossesGap(w)||[w.start,w.end].some(p=>across(p)<4&&along(p)>4&&along(p)<length-4))))continue;
  walls=walls.filter(w=>w.id!==wall.id&&!symbolIds.has(w.id));
  walls.push({...wall,id:`${wall.id}:before:${door.id}`,start:ordered[0],end:start},{...wall,id:`${wall.id}:after:${door.id}`,start:end,end:ordered[1]});
  gaps.push({kind:'door',labelId:door.id,wall:{...wall,id:door.id,name:'문 기호 개구부',start,end,note:'짙은 닫힘 표시·직각 문짝·내부 사선과 연속 벽을 대조한 개구부. 실제 폭·높이는 치수 검증 전 미확정.'}});
 }
 return {walls,gaps};
}
export function doorSymbolBox(door:OverlaidDoor){
 const b=door.band,h=Math.abs(b.start.x-b.end.x)>Math.abs(b.start.y-b.end.y);
 return {x:Math.min(b.start.x,b.end.x)-(h?0:b.thicknessPx/2),y:Math.min(b.start.y,b.end.y)-(h?b.thicknessPx/2:0),width:h?Math.abs(b.end.x-b.start.x):b.thicknessPx,height:h?b.thicknessPx:Math.abs(b.end.y-b.start.y)};
}
const overlap=(a:import('./planLabels').PlanLabel['box'],b:import('./planLabels').PlanLabel['box'])=>Math.min(a.x+a.width,b.x+b.width)>Math.max(a.x,b.x)&&Math.min(a.y+a.height,b.y+b.height)>Math.max(a.y,b.y);
export function activeOverlaidDoors(doors:OverlaidDoor[],labels:import('./planLabels').PlanLabel[]){
 return doors.filter(d=>!labels.some(l=>['door','entrance'].includes(l.kind)&&l.status==='dismissed'&&overlap(doorSymbolBox(d),l.box)));
}
export function mergeDoorSymbols(labels:import('./planLabels').PlanLabel[],doors:OverlaidDoor[]){
 const result=labels.slice();
 for(const door of doors){const box=doorSymbolBox(door);if(result.length>=500||result.some(l=>l.id===door.id||(['door','entrance'].includes(l.kind)&&overlap(box,l.box))))continue;
  result.push({id:door.id,kind:'door',source:'symbol',status:'unreviewed',text:'출입문 · 문짝 기호',box,note:'닫힘 막대·직각 문짝·안쪽 사선의 도형 근거입니다. 기호 위치이며 실제 개구부 폭과 높이는 치수 검증 전 미확정입니다.'});
 }
 return result;
}
