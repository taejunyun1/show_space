import type {Project} from './types';
import {wallLength} from './model';
import {rotatedArtworkOuterSize} from './artworkPresentation';

export type ArtworkLayout =
 | {kind:'align';edge:'left'|'right'|'top'|'bottom'|'center-x'|'center-y'}
 | {kind:'spacing';axis:'horizontal'|'vertical';gapMm?:number}
 | {kind:'center-height';heightMm:number}
 | {kind:'center-wall'};

const EPS=1e-6;
/** Layout uses the visible outer frame bounds, including rotation, in wall elevation coordinates. */
export function layoutArtworks(project:Project,ids:string[],layout:ArtworkLayout):Project {
 const selected=new Set(ids),works=project.artworks.filter(a=>selected.has(a.id));
 if(selected.size<2||works.length!==selected.size)throw new Error('정렬할 작품을 두 개 이상 선택해 주세요.');
 if(project.planDraft&&!project.planReference?.calibrated)throw new Error('도면 축척을 먼저 보정해 주세요.');
 if(works.some(a=>a.locked))throw new Error('잠긴 작품을 해제한 뒤 배치해 주세요.');
 const first=works[0],back=first.wallSide==='back';
 if(works.some(a=>a.wallId!==first.wallId||(a.wallSide??'front')!==(first.wallSide??'front')))throw new Error('같은 벽·같은 면의 작품을 선택해 주세요.');
 const groups=new Set(works.map(a=>a.groupId).filter(Boolean));
 if(project.artworks.some(a=>a.groupId&&groups.has(a.groupId)&&!selected.has(a.id)))throw new Error('그룹의 작품을 모두 선택해 주세요.');
 const wall=project.walls.find(w=>w.id===first.wallId);
 if(!wall)throw new Error('작품의 설치 벽을 찾을 수 없습니다.');
 const width=wallLength(wall),height=wall.heightMm;
 const items=works.map(a=>({a,x:back?width-a.alongMm:a.alongMm,y:a.centerHeightMm,...rotatedArtworkOuterSize(a)}));
 const left=Math.min(...items.map(i=>i.x-i.widthMm/2)),right=Math.max(...items.map(i=>i.x+i.widthMm/2));
 const bottom=Math.min(...items.map(i=>i.y-i.heightMm/2)),top=Math.max(...items.map(i=>i.y+i.heightMm/2));
 switch(layout.kind){
  case 'align':
   for(const i of items)switch(layout.edge){
    case 'left':i.x=left+i.widthMm/2;break;
    case 'right':i.x=right-i.widthMm/2;break;
    case 'top':i.y=top-i.heightMm/2;break;
    case 'bottom':i.y=bottom+i.heightMm/2;break;
    case 'center-x':i.x=(left+right)/2;break;
    case 'center-y':i.y=(bottom+top)/2;break;
    default:throw new Error('올바른 정렬 방향을 선택해 주세요.');
   }
   break;
  case 'center-wall':for(const i of items)i.x+=width/2-(left+right)/2;break;
  case 'center-height':
   if(!Number.isFinite(layout.heightMm))throw new Error('중심 높이를 숫자로 입력해 주세요.');
   for(const i of items)i.y=layout.heightMm;
   break;
  case 'spacing':{
   if(layout.axis!=='horizontal'&&layout.axis!=='vertical')throw new Error('간격 방향을 선택해 주세요.');
   const horizontal=layout.axis==='horizontal';
   const sorted=[...items].sort((a,b)=>(horizontal?a.x-b.x:b.y-a.y)||a.a.id.localeCompare(b.a.id));
   const span=horizontal?right-left:top-bottom,total=items.reduce((sum,i)=>sum+(horizontal?i.widthMm:i.heightMm),0);
   const gap=layout.gapMm??(span-total)/(items.length-1);
   if(!Number.isFinite(gap)||(layout.gapMm===undefined?gap<-EPS:gap<0))throw new Error(layout.gapMm===undefined?'등간격으로 배치할 공간이 부족합니다.':'간격은 0 이상의 숫자로 입력해 주세요.');
   let cursor=horizontal?left:top;
   for(const i of sorted){const size=horizontal?i.widthMm:i.heightMm;if(horizontal){i.x=cursor+size/2;cursor+=size+Math.max(0,gap);}else{i.y=cursor-size/2;cursor-=size+Math.max(0,gap);}}
   break;
  }
  default:throw new Error('올바른 작품 배치 방법을 선택해 주세요.');
 }
 if(items.some(i=>!Number.isFinite(i.x)||!Number.isFinite(i.y)||i.x-i.widthMm/2<-EPS||i.x+i.widthMm/2>width+EPS||i.y-i.heightMm/2<-EPS||i.y+i.heightMm/2>height+EPS))throw new Error('작품이 벽 범위를 벗어납니다. 간격이나 중심 높이를 줄여 주세요.');
 const updated=new Map(items.map(i=>{const alongMm=back?width-i.x:i.x;return [i.a.id,Math.abs(alongMm-i.a.alongMm)<=EPS&&Math.abs(i.y-i.a.centerHeightMm)<=EPS?i.a:{...i.a,alongMm,centerHeightMm:i.y}];}));
 if(items.every(i=>updated.get(i.a.id)===i.a))return project;
 return {...project,artworks:project.artworks.map(a=>updated.get(a.id)??a)};
}
