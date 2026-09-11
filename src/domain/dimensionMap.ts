import type {Point} from './types';
import type {solveDimensionConstraints} from './dimensionConstraints';
import type {PlanText} from './planLabels';

type Solution=ReturnType<typeof solveDimensionConstraints>;
interface Knot {pixel:number;mm:number}
/** A separable piecewise map. Interpolation locates image content, not new measured dimensions.
 * Outside the constrained extent is deliberately unmapped; callers must crop the source. */
export function createDimensionMap(solution:Solution){
 if(solution.status!=='determined'||solution.rejected.length)return undefined;
 const axes=solution.axes.map(a=>{
  const knots:Knot[]=a.coordinates.map(n=>({pixel:n.pixel,mm:n.mm})).sort((p,q)=>p.pixel-q.pixel);
  if(a.status!=='determined'||a.conflicts.length||a.reversed||new Set(a.coordinates.map(n=>n.component)).size!==1||knots.length<2)return undefined;
  if(knots.some((n,i)=>!Number.isFinite(n.pixel)||!Number.isFinite(n.mm)||(i>0&&(n.pixel<=knots[i-1].pixel||n.mm<=knots[i-1].mm))))return undefined;
  return {axis:a.axis,knots};
 });
 const x=axes.find(a=>a?.axis==='x')?.knots,z=axes.find(a=>a?.axis==='z')?.knots;
 if(!x||!z)return undefined;
 // The solver merges evidenced jamb axes. Preserve that merge on geometry
 // endpoints too; interpolating an alias would reintroduce a false wall offset.
 const canonical=solution.axes.map(a=>{
  const aliases=new Map<number,number>(),round=(n:number)=>Math.round(n*1e6)/1e6;
  const root=(n:number):number=>aliases.has(n)?root(aliases.get(n)!):n;
  for(const e of a.appliedEqualities){const p=root(round(e.from)),q=root(round(e.to));if(p!==q)aliases.set(Math.max(p,q),Math.min(p,q));}
  return {axis:a.axis,resolve:(n:number)=>aliases.has(round(n))?root(round(n)):n};
 });
 const sample=(knots:Knot[],value:number,inverse=false):number|undefined=>{
  if(!Number.isFinite(value))return undefined;
  const from=inverse?'mm':'pixel',to=inverse?'pixel':'mm';
  if(value<knots[0][from]||value>knots.at(-1)![from])return undefined;
  for(let i=1;i<knots.length;i++)if(value<=knots[i][from]){
   const a=knots[i-1],b=knots[i];return a[to]+(b[to]-a[to])*(value-a[from])/(b[from]-a[from]);
  }
 };
 const transform=(point:Point,inverse=false):Point|undefined=>{
  const a=sample(x,inverse?point.x:canonical.find(a=>a.axis==='x')!.resolve(point.x),inverse),b=sample(z,inverse?point.z:canonical.find(a=>a.axis==='z')!.resolve(point.z),inverse);
  return a===undefined||b===undefined?undefined:{x:a,z:b};
 };
 return {
  axes:{x,z},
  sourceBounds:{x:x[0].pixel,y:z[0].pixel,width:x.at(-1)!.pixel-x[0].pixel,height:z.at(-1)!.pixel-z[0].pixel},
  toWorld:(p:Point)=>transform(p),toSource:(p:Point)=>transform(p,true),
  boxToWorld:(box:PlanText['box'])=>{
   if(!Number.isFinite(box.width)||!Number.isFinite(box.height)||box.width<0||box.height<0)return undefined;
   const a=transform({x:box.x,z:box.y}),b=transform({x:box.x+box.width,z:box.y+box.height});
   return a&&b&&b.x>=a.x&&b.z>=a.z?{x:a.x,z:a.z,width:b.x-a.x,depth:b.z-a.z}:undefined;
  },
  // A diagonal crossing scale knots bends under a piecewise map. Preserve its path.
  segmentToWorld:(a:Point,b:Point):Point[]|undefined=>{
   if(!transform(a)||!transform(b))return undefined;
   const cuts=[0,1];
   for(const [axis,knots] of [['x',x],['z',z]] as const){
    const delta=b[axis]-a[axis];if(!delta)continue;
    for(const knot of knots){const t=(knot.pixel-a[axis])/delta;if(t>0&&t<1)cuts.push(t);}
   }
   return [...new Set(cuts)].sort((a,b)=>a-b).map(t=>transform({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t})!);
  },
 };
}
