import type {Point,Wall} from './types';
const key=(p:Point)=>`${p.x},${p.z}`;
const sub=(a:Point,b:Point)=>({x:a.x-b.x,z:a.z-b.z});
const cross=(a:Point,b:Point)=>a.x*b.z-a.z*b.x;
const compatible=(a:Wall,b:Wall)=>a.heightMm===b.heightMm&&a.thicknessMm===b.thicknessMm&&a.role===b.role&&a.color===b.color&&a.visible===b.visible&&a.locked===b.locked;
const round=(n:number)=>Math.round(n*1e6)/1e6;
/** Split at actual intersections. No gap closing, wall extrusion or inferred connections. */
export function splitWallJunctions(input:Wall[]):Wall[]|undefined{
 const walls:Wall[]=[];
 for(const wall of input){
  if(![wall.start,wall.end].every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z))||key(wall.start)===key(wall.end))return undefined;
  const duplicate=walls.find(w=>(key(w.start)===key(wall.start)&&key(w.end)===key(wall.end))||(key(w.start)===key(wall.end)&&key(w.end)===key(wall.start)));
  if(duplicate&&!compatible(duplicate,wall))return undefined;
  if(!duplicate)walls.push(wall);
 }
 const cuts=walls.map(()=>[0,1]);
 for(let i=0;i<walls.length;i++)for(let j=i+1;j<walls.length;j++){
  const a=walls[i],b=walls[j],r=sub(a.end,a.start),s=sub(b.end,b.start),delta=sub(b.start,a.start),den=cross(r,s);
  if(Math.abs(den)<1e-8){
   if(Math.abs(cross(delta,r))<1e-8){
    const length=r.x*r.x+r.z*r.z,t=(delta.x*r.x+delta.z*r.z)/length,end=sub(b.end,a.start),u=(end.x*r.x+end.z*r.z)/length;
    if(Math.min(1,Math.max(t,u))-Math.max(0,Math.min(t,u))>1e-8){
     if(!compatible(a,b))return undefined;
     for(const value of [t,u])if(value>0&&value<1)cuts[i].push(value);
     const otherLength=s.x*s.x+s.z*s.z;
     for(const p of [a.start,a.end]){const v=sub(p,b.start),value=(v.x*s.x+v.z*s.z)/otherLength;if(value>0&&value<1)cuts[j].push(value);}
    }
   }
   continue;
  }
  const t=cross(delta,s)/den,u=cross(delta,r)/den;
  if(t>=0&&t<=1&&u>=0&&u<=1){cuts[i].push(t);cuts[j].push(u);}
 }
 const result=walls.flatMap((w,i)=>{
  const sorted=[...new Set(cuts[i])].sort((a,b)=>a-b),point=(t:number):Point=>({x:round(w.start.x+(w.end.x-w.start.x)*t),z:round(w.start.z+(w.end.z-w.start.z)*t)});
  // Different intersection calculations may produce adjacent cuts that round
  // to the same coordinate. They are one junction, not a zero-length wall.
  const points=sorted.map(point).filter((p,j,all)=>!j||key(p)!==key(all[j-1]));
  if(points.length<2)return [{...w,start:point(0),end:point(1)}];
  return points.slice(1).map((end,j)=>({...w,id:points.length===2?w.id:`${w.id}:segment-${j+1}`,start:points[j],end}));
 });
 const unique=result.filter((w,i)=>!result.slice(0,i).some(other=>(key(w.start)===key(other.start)&&key(w.end)===key(other.end))||(key(w.start)===key(other.end)&&key(w.end)===key(other.start))));
 return unique.length<=200&&unique.every(w=>key(w.start)!==key(w.end))?unique:undefined;
}
export function peelOpenBranches(walls:Wall[]):Set<number>{
 const core=new Set(walls.map((_,i)=>i));let changed=true;
 while(changed){changed=false;const degree=new Map<string,number>();
  for(const i of core)for(const p of [walls[i].start,walls[i].end])degree.set(key(p),(degree.get(key(p))??0)+1);
  for(const i of core)if([walls[i].start,walls[i].end].some(p=>degree.get(key(p))===1)){core.delete(i);changed=true;}
 }
 return core;
}
/** Half-edge face walks identify the unbounded face of each connected cyclic component. */
export function exteriorWallEdges(walls:Wall[]):Set<number>|undefined{
 const core=peelOpenBranches(walls),adjacency=new Map<string,number[]>();
 const start=(edge:number)=>edge%2?walls[Math.floor(edge/2)].end:walls[Math.floor(edge/2)].start;
 const end=(edge:number)=>start(edge^1);
 for(const i of core)for(const edge of [i*2,i*2+1])adjacency.set(key(start(edge)),[...(adjacency.get(key(start(edge)))??[]),edge]);
 for(const list of adjacency.values())list.sort((a,b)=>Math.atan2(end(a).z-start(a).z,end(a).x-start(a).x)-Math.atan2(end(b).z-start(b).z,end(b).x-start(b).x));
 const visited=new Set<number>(),boundary=new Set<number>();
 for(const i of core)for(const seed of [i*2,i*2+1]){
  if(visited.has(seed))continue;
  const face:number[]=[];let edge=seed;
  do{
   if(visited.has(edge))return undefined;
   visited.add(edge);face.push(edge);
   const outgoing=adjacency.get(key(end(edge)))!,reverse=outgoing.indexOf(edge^1);
   edge=outgoing[(reverse-1+outgoing.length)%outgoing.length];
  }while(edge!==seed);
  const area=face.reduce((sum,e)=>sum+cross(start(e),end(e)),0)/2;
  if(area<0){
   // Bridges between cycles give repeated vertices; keep such ambiguous structures withheld.
   if(new Set(face.map(e=>key(start(e)))).size!==face.length)return undefined;
   for(const e of face)boundary.add(Math.floor(e/2));
  }
 }
 return boundary.size?boundary:undefined;
}
