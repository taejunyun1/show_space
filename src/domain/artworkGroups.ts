import {rotatedArtworkOuterSize} from './artworkPresentation';
import type {Artwork,Project} from './types';
import {updateArtwork,wallLength} from './model';

export function artworkGroupMembers(project:Project,id:string):Artwork[]{
  const source=project.artworks.find(a=>a.id===id);
  return project.artworks.filter(a=>a.id===id || !!source?.groupId&&a.groupId===source.groupId);
}

export function groupArtworks(project:Project,ids:string[]):Project{
  const members=[...new Map(ids.flatMap(id=>artworkGroupMembers(project,id)).map(a=>[a.id,a])).values()];
  if(members.length<2)throw new Error('묶을 작품을 두 개 이상 선택해 주세요.');
  if(members.some(a=>a.locked))throw new Error('잠긴 작품은 그룹을 변경할 수 없습니다.');
  if(members.some(a=>a.wallId!==members[0].wallId||(a.wallSide??'front')!==(members[0].wallSide??'front')))throw new Error('같은 벽·같은 면의 작품만 묶을 수 있습니다.');
  const groupId=crypto.randomUUID(),selected=new Set(members.map(a=>a.id));
  return {...project,artworks:project.artworks.map(a=>selected.has(a.id)?{...a,groupId}:a)};
}

export function ungroupArtworks(project:Project,ids:string[]):Project{
  const members=ids.flatMap(id=>artworkGroupMembers(project,id)).filter(a=>a.groupId);
  if(members.some(a=>a.locked))throw new Error('잠긴 작품은 그룹을 변경할 수 없습니다.');
  const selected=new Set(members.map(a=>a.id));
  return {...project,artworks:project.artworks.map(a=>selected.has(a.id)?{...a,groupId:undefined}:a)};
}

/** Position and wall changes translate the whole group; appearance/size/rotation remain individual. */
export function patchGroupedArtwork(project:Project,id:string,patch:Partial<Artwork>,constrain=false):Project{
  const source=project.artworks.find(a=>a.id===id);
  if(!source)throw new Error('작품을 찾을 수 없습니다.');
  const members=artworkGroupMembers(project,id);
  const moving=['alongMm','centerHeightMm','wallId','wallSide'].some(key=>key in patch);
  if(members.length<2||!moving)return updateArtwork(project,id,patch);
  if(members.some(a=>a.locked))throw new Error('잠긴 작품이 포함된 그룹은 이동할 수 없습니다.');
  const wallId=patch.wallId??source.wallId,wallSide=patch.wallSide??source.wallSide??'front';
  const wall=project.walls.find(w=>w.id===wallId);
  if(!wall)throw new Error('설치 벽을 찾을 수 없습니다.');
  let dx=(patch.alongMm??source.alongMm)-source.alongMm,dy=(patch.centerHeightMm??source.centerHeightMm)-source.centerHeightMm;
  if(constrain){
    const bounds=members.map(a=>{const size=rotatedArtworkOuterSize(a);return {left:a.alongMm-size.widthMm/2,right:a.alongMm+size.widthMm/2,bottom:a.centerHeightMm-size.heightMm/2,top:a.centerHeightMm+size.heightMm/2};});
    const minX=-Math.min(...bounds.map(b=>b.left)),maxX=wallLength(wall)-Math.max(...bounds.map(b=>b.right));
    const minY=-Math.min(...bounds.map(b=>b.bottom)),maxY=wall.heightMm-Math.max(...bounds.map(b=>b.top));
    if(minX>maxX||minY>maxY)throw new Error('작품 그룹이 이 벽보다 큽니다.');
    dx=Math.max(minX,Math.min(maxX,dx));dy=Math.max(minY,Math.min(maxY,dy));
  }
  return members.reduce((next,a)=>updateArtwork(next,a.id,{...(a.id===id?patch:{}),wallId,wallSide,alongMm:a.alongMm+dx,centerHeightMm:a.centerHeightMm+dy}),project);
}
