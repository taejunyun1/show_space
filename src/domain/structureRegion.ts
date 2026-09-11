import type {WallCandidate} from './wallCandidates';
import type {PlanLabel} from './planLabels';
import {readPlanNumbers} from './planNumbers';
const distance=(p:{x:number;y:number},l:WallCandidate)=>{
 const dx=l.end.x-l.start.x,dy=l.end.y-l.start.y,t=Math.max(0,Math.min(1,((p.x-l.start.x)*dx+(p.y-l.start.y)*dy)/(dx*dx+dy*dy)));
 return Math.hypot(p.x-l.start.x-t*dx,p.y-l.start.y-t*dy);
};
/** Locate a dominant thick wall network only when all recognized spatial
 * evidence fits. This is a source-pixel region, never a room/floor boundary. */
export function structureRegion(lines:WallCandidate[],labels:PlanLabel[],width:number,height:number){
 const size=Math.max(width,height),network=lines.filter(l=>Math.hypot(l.end.x-l.start.x,l.end.y-l.start.y)>0);
 const parents=network.map((_,i)=>i),root=(i:number):number=>parents[i]===i?i:(parents[i]=root(parents[i]));
 for(let i=0;i<network.length;i++)for(let j=i+1;j<network.length;j++){
  const a=network[i],b=network[j],tolerance=Math.min(24,(a.thicknessPx+b.thicknessPx)/2+2);
  if([a.start,a.end].some(p=>distance(p,b)<=tolerance)||[b.start,b.end].some(p=>distance(p,a)<=tolerance))parents[root(j)]=root(i);
 }
 const groups=new Map<number,WallCandidate[]>();network.forEach((l,i)=>{const k=root(i);groups.set(k,[...(groups.get(k)??[]),l]);});
 const bounds=(ls:WallCandidate[])=>{const points=ls.flatMap(l=>[l.start,l.end]),x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));return {x,y,width:Math.max(...points.map(p=>p.x))-x,height:Math.max(...points.map(p=>p.y))-y};};
 const ranked=[...groups.values()].map(group=>({group,box:bounds(group)})).sort((a,b)=>b.box.width*b.box.height-a.box.width*a.box.height);
 const best=ranked[0];if(!best||best.group.filter(l=>l.thicknessPx>=6).length<4||best.box.width*best.box.height<width*height*.15)return undefined;
 const margin=Math.max(24,size*.025),x=Math.max(0,best.box.x-margin),y=Math.max(0,best.box.y-margin);
 const box={x,y,width:Math.min(width,best.box.x+best.box.width+margin)-x,height:Math.min(height,best.box.y+best.box.height+margin)-y};
 const inside=(b:{x:number;y:number;width:number;height:number})=>b.x>=box.x&&b.y>=box.y&&b.x+b.width<=box.x+box.width&&b.y+b.height<=box.y+box.height;
 // A second substantial drawing outside the padded region is not decoration.
 if(ranked.slice(1).some(g=>Math.max(g.box.width,g.box.height)>size*.15&&!inside(g.box)))return undefined;
 // The input has already passed structural-line selection: a long thin
 // wall outside the dominant network is still evidence, not decoration.
 if(lines.some(l=>Math.hypot(l.end.x-l.start.x,l.end.y-l.start.y)>size*.15&&!inside(bounds([l]))))return undefined;
 const spatial=labels.filter(l=>l.status!=='dismissed'&&l.kind!=='unit');
 const dimensions=spatial.filter(l=>l.kind==='dimension'&&readPlanNumbers(l.correctedText??l.text).some(n=>n.unit));
 if(dimensions.length<3||spatial.some(l=>!inside(l.box)))return undefined;
 return box;
}
