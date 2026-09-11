import type {Wall} from './types';
import type {StairRegion} from './stairRegions';
/** Resolve a stair approach only from a detected tread region and opposing
 * wall ends. Stair-side strokes remain in recognition evidence, not floor walls. */
export function detectStairAccess(walls:Wall[],regions:StairRegion[],maxGap:number){
 const proposals:{wall:Wall;kind:'stair-access';labelId:string;excludedWallIds:string[]}[]=[];
 const ends=walls.flatMap(w=>[{wall:w,p:w.start,q:w.end},{wall:w,p:w.end,q:w.start}]);
 for(const region of regions){
  if(region.evidence==='shape')continue; // A possible stair footprint does not prove an entrance.
  const matches:typeof proposals=[];
  for(let i=0;i<ends.length;i++)for(let j=i+1;j<ends.length;j++){
   const a=ends[i],b=ends[j],vertical=Math.abs(a.p.x-b.p.x)<1;
   if(a.wall.id===b.wall.id||(!vertical&&Math.abs(a.p.z-b.p.z)>=1))continue;
   const along=(p:Wall['start'])=>vertical?p.z:p.x,across=(p:Wall['start'])=>vertical?p.x:p.z;
   const from=Math.min(along(a.p),along(b.p)),to=Math.max(along(a.p),along(b.p)),cross=across(a.p);
   if(to-from<30||to-from>maxGap||Math.abs(across(a.q)-cross)>1||Math.abs(across(b.q)-cross)>1)continue;
   if((along(a.q)-along(a.p))*(along(b.p)-along(a.p))>=0||(along(b.q)-along(b.p))*(along(a.p)-along(b.p))>=0)continue;
   const rFrom=vertical?region.box.y:region.box.x,rTo=rFrom+(vertical?region.box.height:region.box.width),rLow=vertical?region.box.x:region.box.y,rHigh=rLow+(vertical?region.box.width:region.box.height);
   if(Math.abs(from-rFrom)>8||Math.abs(to-rTo)>8)continue;
   const side=cross>=rHigh&&cross-rHigh<=30?-1:cross<=rLow&&rLow-cross<=30?1:0;if(!side)continue;
   const rails=walls.filter(w=>![a.wall.id,b.wall.id].includes(w.id)&&Math.abs(along(w.start)-along(w.end))<1&&[from,to].some(t=>Math.abs(along(w.start)-t)<4)&&Math.min(Math.abs(across(w.start)-cross),Math.abs(across(w.end)-cross))<4&&side*((across(w.start)+across(w.end))/2-cross)>0);
   if(![from,to].every(t=>rails.some(w=>Math.abs(along(w.start)-t)<4)))continue;
   const outer=side<0?Math.min(rLow,...rails.flatMap(w=>[across(w.start),across(w.end)])):Math.max(rHigh,...rails.flatMap(w=>[across(w.start),across(w.end)]));
   const excludedWallIds=walls.filter(w=>![a.wall.id,b.wall.id].includes(w.id)&&[w.start,w.end].every(p=>along(p)>=from-4&&along(p)<=to+4&&across(p)>=Math.min(outer,cross)-1&&across(p)<=Math.max(outer,cross)+1)).map(w=>w.id);
   matches.push({kind:'stair-access',labelId:region.labelId!,excludedWallIds,wall:{...a.wall,id:`stair-access:${region.id}`,name:'계단 통로',start:a.p,end:b.p,note:'계단 단 선 및 양쪽 벽 끝점으로 검출한 통로. 실제 벽을 생성하지 않습니다.'}});
  }
  if(matches.length===1)proposals.push(matches[0]);
 }
 return proposals.filter((p,i)=>!proposals.some((q,j)=>i!==j&&p.excludedWallIds.some(id=>q.excludedWallIds.includes(id))));
}
