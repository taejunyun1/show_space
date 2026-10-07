import {wallLength} from './model';
import {rotatedArtworkOuterSize} from './artworkPresentation';
import {groupArtworks} from './artworkGroups';
import type {Artwork,Project} from './types';

export interface ArtworkSeriesOptions {
 artworkIds:string[];count:number;wallId:string;wallSide:'front'|'back';axis:'horizontal'|'vertical';gapMm:number;centerHeightMm:number;group:boolean
}
const EPS=1e-6;
/** Pure preview: explicit order, existing works only, physical rotated outer bounds. */
export function planArtworkSeries(project:Project,options:ArtworkSeriesOptions){
 const {artworkIds,count,wallId,wallSide,axis,gapMm,centerHeightMm}=options;
 if(project.planDraft&&!project.planReference?.calibrated)throw new Error('도면 축척을 먼저 보정해 주세요.');
 if(!Number.isInteger(count)||count<2||count>artworkIds.length)throw new Error('배열할 작품 수는 선택한 목록 안에서 2점 이상 정수로 입력해 주세요.');
 if(new Set(artworkIds).size!==artworkIds.length)throw new Error('시리즈에 같은 작품을 두 번 넣을 수 없습니다.');
 if(axis!=='horizontal'&&axis!=='vertical')throw new Error('배열 방향을 선택해 주세요.');
 if(wallSide!=='front'&&wallSide!=='back')throw new Error('설치 면을 선택해 주세요.');
 if(typeof options.group!=='boolean')throw new Error('배열 후 그룹 설정을 선택해 주세요.');
 if(!Number.isFinite(gapMm)||gapMm<0||!Number.isFinite(centerHeightMm))throw new Error('간격과 중심 높이를 올바른 숫자로 입력해 주세요.');
 const all=[...project.artworks,...project.unplacedArtworks??[]],byId=new Map(all.map(a=>[a.id,a]));
 if(artworkIds.some(id=>!byId.has(id)))throw new Error('작품 목록이 변경됐습니다. 시리즈 작품을 다시 선택해 주세요.');
 const ids=artworkIds.slice(0,count),selected=new Set(ids),works=ids.map(id=>byId.get(id)!);
 if(works.some(a=>a.locked))throw new Error('잠긴 작품을 해제한 뒤 배열해 주세요.');
 if(works.some(a=>!a.visible))throw new Error('숨긴 작품을 표시한 뒤 배열해 주세요.');
 const groups=new Set(works.map(a=>a.groupId).filter(Boolean));
 if(all.some(a=>a.groupId&&groups.has(a.groupId)&&!selected.has(a.id)))throw new Error('기존 그룹의 작품을 모두 포함해 주세요. 작품 수와 선택 목록을 확인하세요.');
 const wall=project.walls.find(w=>w.id===wallId);if(!wall)throw new Error('설치할 벽을 선택해 주세요.');
 const wallWidthMm=wallLength(wall),sizes=works.map(rotatedArtworkOuterSize),horizontal=axis==='horizontal';
 const widthMm=horizontal?sizes.reduce((sum,s)=>sum+s.widthMm,0)+gapMm*(count-1):Math.max(...sizes.map(s=>s.widthMm));
 const heightMm=horizontal?Math.max(...sizes.map(s=>s.heightMm)):sizes.reduce((sum,s)=>sum+s.heightMm,0)+gapMm*(count-1);
 let cursor=horizontal?(wallWidthMm-widthMm)/2:centerHeightMm+heightMm/2;
 const items=works.map((source,index)=>{
  const size=sizes[index],x=horizontal?cursor+size.widthMm/2:wallWidthMm/2,y=horizontal?centerHeightMm:cursor-size.heightMm/2;
  cursor+=horizontal?size.widthMm+gapMm:-(size.heightMm+gapMm);
  return {x,y,...size,artwork:{...source,wallId,wallSide,alongMm:wallSide==='back'?wallWidthMm-x:x,centerHeightMm:y} as Artwork};
 });
 if(items.some(i=>!Number.isFinite(i.x)||!Number.isFinite(i.y)||i.widthMm<=0||i.heightMm<=0||i.x-i.widthMm/2<-EPS||i.x+i.widthMm/2>wallWidthMm+EPS||i.y-i.heightMm/2<-EPS||i.y+i.heightMm/2>wall.heightMm+EPS))throw new Error('시리즈가 벽 범위를 벗어납니다. 작품 수·간격·중심 높이 또는 설치 벽을 조정해 주세요.');
 const occupied=project.artworks.filter(a=>!selected.has(a.id)&&a.visible&&a.wallId===wallId&&(a.wallSide??'front')===wallSide).map(a=>({id:a.id,name:a.name,x:wallSide==='back'?wallWidthMm-a.alongMm:a.alongMm,y:a.centerHeightMm,...rotatedArtworkOuterSize(a)}));
 const overlapping=occupied.filter(a=>items.some(i=>Math.abs(a.x-i.x)<(a.widthMm+i.widthMm)/2-EPS&&Math.abs(a.y-i.y)<(a.heightMm+i.heightMm)/2-EPS));
 return {wall,wallWidthMm,widthMm,heightMm,items,occupied,overlapping};
}

/** One atomic edit. Unplaced works become mounted works; all image/body data stays intact. */
export function applyArtworkSeries(project:Project,options:ArtworkSeriesOptions):Project{
 const plan=planArtworkSeries(project,options),existing=new Map(project.artworks.map(a=>[a.id,a]));
 const updated=new Map(plan.items.map(({artwork})=>{
  const a=existing.get(artwork.id),same=a&&a.wallId===artwork.wallId&&(a.wallSide??'front')===artwork.wallSide&&Math.abs(a.alongMm-artwork.alongMm)<EPS&&Math.abs(a.centerHeightMm-artwork.centerHeightMm)<EPS;
  return [artwork.id,same?a:artwork] as const;
 }));
 const installed=plan.items.filter(i=>!existing.has(i.artwork.id)).map(i=>i.artwork),changed=installed.length>0||project.artworks.some(a=>updated.has(a.id)&&updated.get(a.id)!==a);
 let next=changed?{...project,artworks:[...project.artworks.map(a=>updated.get(a.id)??a),...installed],...(project.unplacedArtworks?{unplacedArtworks:project.unplacedArtworks.filter(a=>!updated.has(a.id))}:{})}:project;
 if(options.group){
  const works=next.artworks.filter(a=>updated.has(a.id)),groupId=works[0].groupId;
  if(!groupId||works.some(a=>a.groupId!==groupId))next=groupArtworks(next,plan.items.map(i=>i.artwork.id));
 }
 return next;
}
