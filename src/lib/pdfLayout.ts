import {sceneProject} from '../domain/sceneProject';
import {wallLength} from '../domain/model';
import type {Artwork,CameraView,ModelArtwork,Project,Wall} from '../domain/types';
import {createStandardView} from '../components/cameraView3d';
export type PdfPageKind='cover'|'3d'|'plan'|'elevation'|'detail'|'schedule';
export type PdfCameraMode='saved'|'bird'|'front'|'left'|'right'|'perspective';
export interface PdfPageRequest {id:string;sceneId?:string;kind:PdfPageKind;title?:string;cameraMode?:PdfCameraMode;wallId?:string;side?:'front'|'back';artworkId?:string}
export interface PdfOptions {current:boolean;sceneIds:string[];threeD:boolean;plan:boolean;elevation:boolean;allWallFaces:boolean;includeSchedule?:boolean;pages?:PdfPageRequest[]}
export interface PdfSection {project:Project;name:string;sceneId?:string;current?:boolean;kind:PdfPageKind;wall?:Wall;side?:'front'|'back';camera?:CameraView;fitCamera?:boolean;title?:string;artwork?:Artwork;modelArtwork?:ModelArtwork}
export function pdfBatch(project:Project,sceneId?:string){
 if(!sceneId)return {project:structuredClone(project),name:'현재 배치',current:true};
 const scene=project.scenes.find(s=>s.id===sceneId);if(!scene)throw new Error('선택한 Scene을 찾지 못했습니다.');
 return {project:sceneProject(project,scene),name:scene.name,sceneId:scene.id,camera:scene.cameraView};
}
export function pdfDetailArtworks(project:Project){return [...project.artworks.filter(a=>a.visible&&a.imageUrl&&project.walls.some(w=>w.id===a.wallId&&w.visible)),...(project.modelArtworks??[]).filter(a=>a.visible)];}
export function pdfNeeds3d(section:PdfSection){return section.kind==='3d'||section.kind==='detail'&&!!section.modelArtwork;}
/** A model detail shows the selected object, preserving its real size/rotation, without venue geometry. */
export function pdfPreviewSection(section:PdfSection):PdfSection{
 if(section.kind!=='detail'||!section.modelArtwork)return section;
 const project={...section.project,walls:[],artworks:[],modelArtworks:[section.modelArtwork],referenceModel:undefined,importedFloor:[],openings:[],dimensions:[],scenes:[]};
 return {...section,current:false,camera:createStandardView(project,'bird',{width:1920,height:1200}),project};
}
function orderedSections(project:Project,pages:PdfPageRequest[]):PdfSection[]{
 if(!pages.length)throw new Error('내보낼 페이지를 하나 이상 추가하세요.');
 const batches=new Map<string,ReturnType<typeof pdfBatch>>();
 return pages.map(page=>{
  if(!['cover','3d','plan','elevation','detail','schedule'].includes(page.kind))throw new Error('PDF 보기 종류가 올바르지 않습니다.');
  const key=page.sceneId??'',batch=batches.get(key)??pdfBatch(project,page.sceneId);batches.set(key,batch);
  const section:PdfSection={...batch,kind:page.kind,title:page.title?.trim().slice(0,120)||undefined};
  if(page.kind==='elevation'){
   const wall=batch.project.walls.find(w=>w.visible&&w.id===page.wallId);if(!wall)throw new Error(`${batch.name}: 벽면도에 넣을 표시 벽을 선택하세요.`);
   if(page.side!=='front'&&page.side!=='back')throw new Error('벽의 A·B면을 선택하세요.');section.wall=wall;section.side=page.side;
  }
  if(page.kind==='detail'){
   const art=pdfDetailArtworks(batch.project).find(a=>a.id===page.artworkId);if(!art)throw new Error(`${batch.name}: 상세 페이지에 넣을 표시 작품을 선택하세요.`);
   if('imageUrl' in art)section.artwork=art;else section.modelArtwork=art;
  }
  if(page.kind==='3d'&&page.cameraMode&&page.cameraMode!=='saved'){
   if(!['bird','front','left','right','perspective'].includes(page.cameraMode))throw new Error('PDF 3D 시점이 올바르지 않습니다.');
   const view=createStandardView(batch.project,page.cameraMode==='perspective'?'bird':page.cameraMode,{width:1920,height:1200});
   section.camera=page.cameraMode==='perspective'?{...view,projection:'perspective',zoom:1,fov:50}:view;section.current=false;section.fitCamera=true;
  }
  return section;
 });
}
export function pdfSections(project:Project,options:PdfOptions):PdfSection[]{
 if(project.planReference&&!project.planReference.calibrated)throw new Error('도면 축척을 설정한 뒤 PDF를 내보내세요.');
 if(options.pages!==undefined)return orderedSections(project,options.pages);
 if(!options.current&&!options.sceneIds.length)throw new Error('내보낼 배치를 선택하세요.');
 if(!options.threeD&&!options.plan&&!options.elevation)throw new Error('내보낼 보기를 하나 이상 선택하세요.');
 const batches:Array<{project:Project;name:string;sceneId?:string;current?:boolean;camera?:CameraView}>=options.current?[{project:structuredClone(project),name:'현재 배치',current:true}]:[];
 for(const id of new Set(options.sceneIds)){
  const scene=project.scenes.find(s=>s.id===id);if(!scene)throw new Error('선택한 Scene을 찾지 못했습니다.');
  const p=sceneProject(project,scene);
  batches.push({project:p,name:scene.name,sceneId:scene.id,camera:scene.cameraView});
 }
 const result:PdfSection[]=[];
 for(const batch of batches){
  if(options.threeD)result.push({...batch,kind:'3d'});
  if(options.plan)result.push({...batch,kind:'plan'});
  if(options.elevation)for(const wall of batch.project.walls.filter(w=>w.visible))for(const side of ['front','back'] as const){
   if(options.allWallFaces||batch.project.artworks.some(a=>a.visible&&a.imageUrl&&a.wallId===wall.id&&(a.wallSide??'front')===side))result.push({...batch,kind:'elevation',wall,side});
  }
 }
 if(!result.length)throw new Error('선택한 보기에 내보낼 벽면이 없습니다.');
 return result;
}
/** Seed a editable page list from the existing batch export without changing its order. */
export function pdfDefaultPages(project:Project,options:PdfOptions):PdfPageRequest[]{
 const base=pdfSections(project,{...options,pages:undefined}),ids=[...(options.current?['']:[]),...new Set(options.sceneIds)];
 const pages:PdfPageRequest[]=base.map((s,i)=>({id:`pdf-${i}`,sceneId:s.sceneId,kind:s.kind,wallId:s.wall?.id,side:s.side,cameraMode:'saved'}));
 if(options.includeSchedule)for(const sceneId of ids)pages.push({id:`pdf-${pages.length}`,sceneId:sceneId||undefined,kind:'schedule'});
 return pages;
}
/** PDF points use Y-up; drawing coordinates (plan Z and elevation from top) use Y-down. */
export function fitPdfDrawing(bounds:{minX:number;minY:number;maxX:number;maxY:number},box:{x:number;y:number;width:number;height:number}){
 const width=Math.max(1,bounds.maxX-bounds.minX),height=Math.max(1,bounds.maxY-bounds.minY);
 const scale=Math.min((box.width-40)/width,(box.height-40)/height);
 const left=box.x+(box.width-width*scale)/2,top=box.y+(box.height+height*scale)/2;
 return {scale,x:(x:number)=>left+(x-bounds.minX)*scale,y:(y:number)=>top-(y-bounds.minY)*scale,denominator:1/(scale*25.4/72)};
}
export function elevationArtPlacement(art:Artwork,wall:Wall,side:'front'|'back'){
 return {x:side==='back'?wallLength(wall)-art.alongMm:art.alongMm,y:wall.heightMm-art.centerHeightMm,angle:art.rotationDeg??0};
}
